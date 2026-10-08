import {
  PrismaClient,
  Prisma,
  PlatformRole,
  TenantRole,
  StoreRole,
  MembershipStatus,
  TenantStatus,
  StoreStatus,
  BillingCycle,
  SubscriptionStatus,
} from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { DEFAULT_TRIAL_MONTHS, billingCyclePrice } from '@ecomesta/utils';
import { BUILT_IN_THEMES } from '../src/modules/themes/theme-config.types';
import { DEFAULT_PLANS } from '../src/modules/billing/plan-defaults';
import { seedBangladeshLocations } from './seed-bangladesh-locations';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const bdLocations = await seedBangladeshLocations(prisma);

  const adminEmail = (
    process.env.SEED_SUPER_ADMIN_EMAIL?.trim() || 'admin@ecomesta.local'
  ).toLowerCase();
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

  // BDT prices; 6-month and yearly prices are derived from monthlyPrice.
  const plans = DEFAULT_PLANS;
  let plan: { id: string; slug: string } | null = null;
  for (const item of plans) {
    const data = {
      name: item.name,
      description: item.tagline,
      monthlyPrice: item.monthlyPrice,
      yearlyPrice: billingCyclePrice(item.monthlyPrice, 'YEARLY'),
      active: true,
      configuration: {
        trialMonths: DEFAULT_TRIAL_MONTHS,
        tagline: item.tagline,
        highlighted: item.highlighted,
        sortOrder: item.sortOrder,
        features: item.features,
        limits: item.limits,
      } as unknown as Prisma.InputJsonValue,
    };
    const saved = await prisma.subscriptionPlan.upsert({
      where: { slug: item.slug },
      update: data,
      create: { slug: item.slug, ...data },
    });
    plan ??= saved;
  }
  if (!plan) throw new Error('No subscription plan seeded');

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
    where: { slug: 'demo-store' },
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

  for (const theme of BUILT_IN_THEMES) {
    await prisma.theme.upsert({
      where: { slug: theme.slug },
      update: {
        name: theme.name,
        version: theme.version,
        description: theme.description,
        previewImageUrl: theme.previewImageUrl,
        configuration: theme.configuration as Prisma.InputJsonValue,
        priceBdt: theme.priceBdt,
        active: true,
      },
      create: {
        slug: theme.slug,
        name: theme.name,
        version: theme.version,
        description: theme.description,
        previewImageUrl: theme.previewImageUrl,
        configuration: theme.configuration as Prisma.InputJsonValue,
        priceBdt: theme.priceBdt,
        active: true,
      },
    });
  }

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
  console.log(`  Plans: ${plans.map((item) => item.slug).join(', ')}`);
  // eslint-disable-next-line no-console
  console.log(
    `  Themes: ${BUILT_IN_THEMES.map((theme) => theme.slug).join(', ')}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `  BD locations: ${bdLocations.divisions} divisions, ${bdLocations.districts} districts, ${bdLocations.upazilas} upazilas`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
