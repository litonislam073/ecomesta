/**
 * Removes the merchant accounts created during local UI QA (see
 * qa-local-guard.ts), together with the tenant/store each one onboarded and
 * the tenant's platform subscription. Nothing else.
 *
 *   NODE_ENV=development CONFIRM_QA_CLEANUP=yes pnpm --filter @ecomesta/api qa:cleanup-local
 *
 * Without CONFIRM_QA_CLEANUP=yes it only prints what it would delete. It
 * refuses to run against anything but the local `ecomesta` database, and
 * aborts without deleting anything if an account owns data beyond what
 * onboarding creates (products, orders, customers, payments, …).
 */
import { DomainType, PlatformRole, PrismaClient } from '@prisma/client';
import { QA_ACCOUNTS, checkEnvironment } from './qa-local-guard';

/** Store relations that onboarding (or browsing the dashboard) may create. */
const ALLOWED_STORE_RELATIONS = new Set([
  'memberships',
  'storeThemes',
  'domains',
  'auditLogs',
  'notifications',
]);

interface Plan {
  userIds: string[];
  tenantIds: string[];
  storeIds: string[];
  subdomainIds: string[];
  subscriptionIds: string[];
}

async function buildPlan(prisma: PrismaClient): Promise<Plan> {
  const plan: Plan = {
    userIds: [],
    tenantIds: [],
    storeIds: [],
    subdomainIds: [],
    subscriptionIds: [],
  };
  const problems: string[] = [];

  for (const account of QA_ACCOUNTS) {
    console.log(`\n${account.email}`);
    const user = await prisma.user.findUnique({
      where: { email: account.email },
      select: {
        id: true,
        platformRole: true,
        tenantMemberships: {
          select: { tenantId: true, tenant: { select: { slug: true } } },
        },
        storeMemberships: {
          select: { storeId: true, store: { select: { slug: true } } },
        },
        _count: { select: { mediaUploads: true } },
      },
    });
    if (!user) {
      console.log('  not found — nothing to delete');
      continue;
    }
    if (user.platformRole !== PlatformRole.USER) {
      problems.push(`${account.email}: platform role ${user.platformRole}`);
      continue;
    }
    if (user._count.mediaUploads > 0) {
      problems.push(`${account.email}: has uploaded media`);
    }

    const tenantSlugs = user.tenantMemberships.map((m) => m.tenant.slug);
    const storeSlugs = user.storeMemberships.map((m) => m.store.slug);
    const expected = account.slug ? [account.slug] : [];
    console.log(`  user:    found (platform role USER)`);
    console.log(`  tenants: ${tenantSlugs.join(', ') || 'none'}`);
    console.log(`  stores:  ${storeSlugs.join(', ') || 'none'}`);
    if (
      JSON.stringify(tenantSlugs) !== JSON.stringify(expected) ||
      JSON.stringify(storeSlugs) !== JSON.stringify(expected)
    ) {
      problems.push(
        `${account.email}: expected tenant/store ${expected.join(', ') || 'none'}`,
      );
      continue;
    }
    plan.userIds.push(user.id);

    for (const { tenantId } of user.tenantMemberships) {
      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: {
          slug: true,
          _count: { select: { memberships: true, subscriptions: true } },
          stores: {
            select: {
              id: true,
              slug: true,
              _count: {
                select: {
                  memberships: true,
                  products: true,
                  productVariants: true,
                  categories: true,
                  inventoryItems: true,
                  inventoryMovements: true,
                  customers: true,
                  orders: true,
                  payments: true,
                  paymentProviderConfigs: true,
                  paymentWebhookEvents: true,
                  shippingMethods: true,
                  shippingZones: true,
                  shipments: true,
                  coupons: true,
                  media: true,
                  storeThemes: true,
                  domains: true,
                  auditLogs: true,
                  notifications: true,
                },
              },
            },
          },
        },
      });
      if (tenant._count.memberships !== 1) {
        problems.push(`tenant ${tenant.slug}: has other members`);
      }
      const subscriptions = await prisma.subscription.findMany({
        where: { tenantId },
        select: { id: true },
      });
      plan.subscriptionIds.push(...subscriptions.map((s) => s.id));
      plan.tenantIds.push(tenantId);

      for (const store of tenant.stores) {
        if (store.slug !== account.slug) {
          problems.push(`tenant ${tenant.slug}: unexpected store ${store.slug}`);
          continue;
        }
        if (store._count.memberships !== 1) {
          problems.push(`store ${store.slug}: has other members`);
        }
        for (const [relation, count] of Object.entries(store._count)) {
          if (count > 0 && !ALLOWED_STORE_RELATIONS.has(relation)) {
            problems.push(`store ${store.slug}: has ${count} ${relation}`);
          }
        }
        const domains = await prisma.domain.findMany({
          where: { storeId: store.id },
          select: { id: true, hostname: true, type: true },
        });
        for (const domain of domains) {
          if (domain.type !== DomainType.SUBDOMAIN) {
            problems.push(`store ${store.slug}: custom domain ${domain.hostname}`);
          } else {
            plan.subdomainIds.push(domain.id);
          }
        }
        plan.storeIds.push(store.id);
      }
    }
  }

  if (problems.length > 0) {
    console.error('\nUnexpected data — nothing was deleted:');
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }
  return plan;
}

async function main(): Promise<void> {
  checkEnvironment();

  const prisma = new PrismaClient();
  try {
    const plan = await buildPlan(prisma);
    console.log(
      `\nPlan: ${plan.userIds.length} user(s), ${plan.tenantIds.length} tenant(s), ` +
        `${plan.storeIds.length} store(s), ${plan.subdomainIds.length} platform subdomain row(s), ` +
        `${plan.subscriptionIds.length} subscription(s).`,
    );
    console.log(
      'Sessions and memberships cascade; audit log entries are kept (their links are set to null).',
    );

    if (process.env.CONFIRM_QA_CLEANUP !== 'yes') {
      console.log('\nDry run. Set CONFIRM_QA_CLEANUP=yes to delete.');
      return;
    }
    if (plan.userIds.length === 0) {
      console.log('\nNothing to delete.');
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.domain.deleteMany({ where: { id: { in: plan.subdomainIds } } });
      await tx.store.deleteMany({ where: { id: { in: plan.storeIds } } });
      await tx.subscription.deleteMany({
        where: { id: { in: plan.subscriptionIds }, tenantId: { in: plan.tenantIds } },
      });
      await tx.tenant.deleteMany({ where: { id: { in: plan.tenantIds } } });
      const users = await tx.user.deleteMany({
        where: {
          id: { in: plan.userIds },
          email: { in: QA_ACCOUNTS.map((account) => account.email) },
          platformRole: PlatformRole.USER,
        },
      });
      if (users.count !== plan.userIds.length) {
        throw new Error('User count changed during cleanup; rolled back');
      }
    });
    console.log('\nDeleted.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
