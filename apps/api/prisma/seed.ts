import { PrismaClient, PlatformRole, TenantRole, StoreRole, MembershipStatus, TenantStatus, StoreStatus, BillingCycle, SubscriptionStatus } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminEmail = (process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@ecomesta.local')
    .trim()
    .toLowerCase();
  const adminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!adminPassword || adminPassword.trim().length < 12) {
    throw new Error(
      'SEED_SUPER_ADMIN_PASSWORD must be set in .env (min 12 characters) before seeding.',
    );
  }

  const passwordHash = await hash(adminPassword, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      platformRole: PlatformRole.SUPER_ADMIN,
      status: 'ACTIVE',
      firstName: 'Platform',
      lastName: 'Admin',
      emailVerifiedAt: new Date(),
    },
    create: {
      email: adminEmail,
      passwordHash,
      platformRole: PlatformRole.SUPER_ADMIN,
      status: 'ACTIVE',
      firstName: 'Platform',
      lastName: 'Admin',
      emailVerifiedAt: new Date(),
    },
  });

  const plan = await prisma.subscriptionPlan.upsert({
    where: { slug: 'starter' },
    update: {
      name: 'Starter',
      description: 'Development starter plan for demo tenants.',
      monthlyPrice: 29,
      yearlyPrice: 290,
      active: true,
    },
    create: {
      name: 'Starter',
      slug: 'starter',
      description: 'Development starter plan for demo tenants.',
      monthlyPrice: 29,
      yearlyPrice: 290,
      active: true,
      configuration: {
        maxStores: 3,
        maxProducts: 500,
      },
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-merchant' },
    update: {
      name: 'Demo Merchant',
      status: TenantStatus.ACTIVE,
    },
    create: {
      name: 'Demo Merchant',
      slug: 'demo-merchant',
      status: TenantStatus.ACTIVE,
    },
  });

  await prisma.tenantUser.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: superAdmin.id,
      },
    },
    update: {
      role: TenantRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
    create: {
      tenantId: tenant.id,
      userId: superAdmin.id,
      role: TenantRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });

  const store = await prisma.store.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: 'demo-store',
      },
    },
    update: {
      name: 'Demo Store',
      description: 'Seeded demo store for local development.',
      status: StoreStatus.ACTIVE,
      currency: 'USD',
      timezone: 'UTC',
      locale: 'en-US',
    },
    create: {
      tenantId: tenant.id,
      name: 'Demo Store',
      slug: 'demo-store',
      description: 'Seeded demo store for local development.',
      status: StoreStatus.ACTIVE,
      currency: 'USD',
      timezone: 'UTC',
      locale: 'en-US',
    },
  });

  await prisma.storeUser.upsert({
    where: {
      storeId_userId: {
        storeId: store.id,
        userId: superAdmin.id,
      },
    },
    update: {
      role: StoreRole.STORE_MANAGER,
      status: MembershipStatus.ACTIVE,
    },
    create: {
      storeId: store.id,
      userId: superAdmin.id,
      role: StoreRole.STORE_MANAGER,
      status: MembershipStatus.ACTIVE,
    },
  });

  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      tenantId: tenant.id,
      planId: plan.id,
    },
  });

  if (!existingSubscription) {
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        startsAt: new Date(),
        trialEndsAt: null,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed completed:');
  // eslint-disable-next-line no-console
  console.log(`  Super Admin: ${superAdmin.email}`);
  // eslint-disable-next-line no-console
  console.log(`  Tenant: ${tenant.slug}`);
  // eslint-disable-next-line no-console
  console.log(`  Store: ${store.slug}`);
  // eslint-disable-next-line no-console
  console.log(`  Plan: ${plan.slug}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
