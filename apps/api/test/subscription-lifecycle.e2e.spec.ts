import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PlatformRole, StoreStatus, SubscriptionStatus, UserStatus } from '@prisma/client';
import { addCalendarDays, addCalendarMonths, paymentDeadline } from '@ecomesta/utils';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SubscriptionLifecycleService } from '../src/modules/billing/subscription-lifecycle.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const TEST_EMAIL = /^sub\.(owner|other|held|payer|legacy|admin)\.\d+-\d+@example\.com$/;
const TEST_PLAN = /^e2e-(starter|growth|business)-\d+-\d+$/;

/**
 * Removes only what this spec creates (matched by its exact naming pattern,
 * so leftovers from an interrupted run go too). Audit entries are kept.
 */
async function removeTestData(prisma: PrismaService) {
  const users = (
    await prisma.user.findMany({
      where: { email: { startsWith: 'sub.', endsWith: '@example.com' }, platformRole: { in: [PlatformRole.USER, PlatformRole.SUPER_ADMIN] } },
      select: { id: true, email: true, tenantMemberships: { select: { tenantId: true } } },
    })
  ).filter((user) => TEST_EMAIL.test(user.email));
  const tenantIds = users.flatMap((user) => user.tenantMemberships.map((m) => m.tenantId));
  const stores = await prisma.store.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true } });
  const storeIds = stores.map((store) => store.id);
  const plans = (
    await prisma.subscriptionPlan.findMany({ where: { slug: { startsWith: 'e2e-' } }, select: { id: true, slug: true } })
  ).filter((plan) => TEST_PLAN.test(plan.slug));

  await prisma.$transaction(async (tx) => {
    await tx.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await tx.storeTheme.deleteMany({ where: { storeId: { in: storeIds } } });
    await tx.domain.deleteMany({ where: { storeId: { in: storeIds } } });
    await tx.store.deleteMany({ where: { id: { in: storeIds } } });
    await tx.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await tx.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    await tx.subscriptionPlan.deleteMany({
      where: { id: { in: plans.map((plan) => plan.id) }, subscriptions: { none: {} } },
    });
  });
}

describe('Subscription lifecycle (e2e)', () => {
  jest.setTimeout(90_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let lifecycle: SubscriptionLifecycleService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const planSlug = (name: string) => `e2e-${name}-${suffix}`;

  interface Merchant {
    email: string;
    token: string;
    id: string;
    tenantId: string;
    tenantSlug: string;
    storeId: string;
    storeSlug: string;
  }
  const merchant = (key: string): Merchant => ({
    email: `sub.${key}.${suffix}@example.com`,
    token: '',
    id: '',
    tenantId: '',
    tenantSlug: `sub-${key}-${suffix}`,
    storeId: '',
    storeSlug: `sub-${key}-${suffix}`,
  });
  const owner = merchant('owner');
  const other = merchant('other');
  const adminHeld = merchant('held');
  const payer = merchant('payer');
  const legacy = merchant('legacy');
  const admin = { email: `sub.admin.${suffix}@example.com`, token: '', id: '' };

  const server = () => app.getHttpServer();
  const bearer = (user: { token: string }) => ({ Authorization: `Bearer ${user.token}` });

  async function register(user: { email: string; token: string; id: string }) {
    const res = await request(server())
      .post('/api/v1/auth/register')
      .send({ email: user.email, password: 'SecurePass1', firstName: 'Sub', lastName: 'Test' })
      .expect(201);
    user.token = res.body.data.accessToken;
    user.id = res.body.data.user.id;
  }

  async function onboard(user: Merchant, plan?: { slug: string; cycle: string }) {
    const res = await request(server())
      .post('/api/v1/onboarding/store')
      .set(bearer(user))
      .send({
        businessName: `Sub ${user.tenantSlug}`,
        tenantSlug: user.tenantSlug,
        storeName: `Sub ${user.storeSlug}`,
        storeSlug: user.storeSlug,
        ...(plan ? { planSlug: plan.slug, billingCycle: plan.cycle } : {}),
      })
      .expect(201);
    user.tenantId = res.body.data.tenant.id;
    user.storeId = res.body.data.store.id;
    await prisma.store.update({ where: { id: user.storeId }, data: { status: StoreStatus.ACTIVE } });
    return res;
  }

  const subscriptionOf = (user: Merchant) =>
    prisma.subscription.findFirstOrThrow({ where: { tenantId: user.tenantId }, orderBy: { createdAt: 'desc' } });

  /** Moves the trial end relative to now; the API's own evaluation does the rest. */
  async function trialEndedDaysAgo(user: Merchant, days: number) {
    const sub = await subscriptionOf(user);
    const trialEndsAt = addCalendarDays(new Date(), -days);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { trialEndsAt, startsAt: addCalendarMonths(trialEndsAt, -2) },
    });
    return trialEndsAt;
  }

  const checkoutBody = {
    items: [{ productId: '00000000-0000-4000-8000-000000000001', quantity: 1 }],
    customer: { name: 'Guest', email: `guest.${suffix}@example.com`, phone: '01700000000' },
    shippingAddress: {
      name: 'Guest',
      phone: '01700000000',
      addressLine1: 'House 1, Road 1',
      city: 'Dhaka',
      country: 'BD',
    },
    billingSameAsShipping: true,
    shippingMethodId: '00000000-0000-4000-8000-000000000002',
    paymentProvider: 'COD',
    paymentMethod: 'CASH',
  };

  async function storeDataCounts(storeId: string) {
    const [products, categories, customers, orders, payments, domains, themes, memberships] = await Promise.all([
      prisma.product.count({ where: { storeId } }),
      prisma.category.count({ where: { storeId } }),
      prisma.customer.count({ where: { storeId } }),
      prisma.order.count({ where: { storeId } }),
      prisma.payment.count({ where: { storeId } }),
      prisma.domain.count({ where: { storeId } }),
      prisma.storeTheme.count({ where: { storeId } }),
      prisma.storeUser.count({ where: { storeId } }),
    ]);
    return { products, categories, customers, orders, payments, domains, themes, memberships };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    lifecycle = app.get(SubscriptionLifecycleService);

    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }

    for (const [name, monthly, order] of [
      ['starter', '499', 1],
      ['growth', '999', 2],
      ['business', '1999', 3],
    ] as const) {
      await prisma.subscriptionPlan.create({
        data: {
          name: `E2E ${name}`,
          slug: planSlug(name),
          monthlyPrice: monthly,
          yearlyPrice: '0',
          active: true,
          configuration: { trialMonths: 2, sortOrder: order, highlighted: name === 'growth' },
        },
      });
    }

    for (const user of [owner, other, adminHeld, payer, legacy, admin]) await register(user);
    await prisma.user.update({
      where: { id: admin.id },
      data: { platformRole: PlatformRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
    });
  });

  afterAll(async () => {
    if (prisma) await removeTestData(prisma);
    await app?.close();
  });

  it('starts a 2-calendar-month free trial for the plan and cycle chosen at onboarding', async () => {
    const before = new Date();
    const res = await onboard(owner, { slug: planSlug('growth'), cycle: 'YEARLY' });
    const sub = res.body.data.subscription;
    expect(sub).toMatchObject({ status: 'TRIALING', billingCycle: 'YEARLY', plan: { slug: planSlug('growth') } });
    const startsAt = new Date(sub.startsAt);
    expect(startsAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(new Date(sub.trialEndsAt)).toEqual(addCalendarMonths(startsAt, 2));
    expect(await prisma.payment.count({ where: { storeId: owner.storeId } })).toBe(0);
  });

  it.each([
    ['starter', 'MONTHLY', 499],
    ['business', 'SEMI_ANNUAL', 10795],
  ])('onboards on %s / %s with the right amount after the trial', async (name, cycle, amount) => {
    const user = name === 'starter' ? adminHeld : payer;
    await onboard(user, { slug: planSlug(name), cycle });
    const res = await request(server()).get('/api/v1/billing/subscription').set(bearer(user)).expect(200);
    expect(res.body.data.subscription).toMatchObject({ phase: 'TRIAL', billingCycle: cycle, amountDue: amount });
  });

  it('lists active plans publicly with BDT prices for every cycle and no ids', async () => {
    const res = await request(server()).get('/api/v1/public/plans').expect(200);
    const growth = res.body.data.find((p: { slug: string }) => p.slug === planSlug('growth'));
    expect(growth).toMatchObject({ currency: 'BDT', monthlyPrice: 999, trialMonths: 2, highlighted: true });
    expect(growth.prices.map((p: { amount: number }) => p.amount)).toEqual([999, 5395, 8991]);
    expect(JSON.stringify(res.body)).not.toMatch(UUID);
  });

  it('shows the merchant their trial without internal ids', async () => {
    const res = await request(server()).get('/api/v1/billing/subscription').set(bearer(owner)).expect(200);
    expect(res.body.data).toMatchObject({
      canManage: true,
      onlinePaymentAvailable: false,
      subscription: { status: 'TRIALING', phase: 'TRIAL', billingCycle: 'YEARLY', amountDue: 8991, currency: 'BDT' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(UUID);
  });

  it('changes plan and cycle during the trial without moving the trial dates', async () => {
    const before = await subscriptionOf(owner);
    const res = await request(server())
      .post('/api/v1/billing/subscription')
      .set(bearer(owner))
      .send({ planSlug: planSlug('growth'), billingCycle: 'SEMI_ANNUAL' })
      .expect(201);
    expect(res.body.data.subscription).toMatchObject({ billingCycle: 'SEMI_ANNUAL', amountDue: 5395 });
    const after = await subscriptionOf(owner);
    expect(after.trialEndsAt).toEqual(before.trialEndsAt);
    expect(after.id).toBe(before.id);

    await request(server())
      .post('/api/v1/billing/subscription')
      .set(bearer(owner))
      .send({ planSlug: planSlug('growth'), billingCycle: 'WEEKLY' })
      .expect(400);
    await request(server())
      .post('/api/v1/billing/subscription')
      .set(bearer(owner))
      .send({ planSlug: 'no-such-plan', billingCycle: 'MONTHLY' })
      .expect(422);
  });

  it('keeps one tenant out of another tenant’s billing', async () => {
    await onboard(other);
    await request(server())
      .get(`/api/v1/billing/subscription?tenant=${owner.tenantSlug}`)
      .set(bearer(other))
      .expect((res) => expect([403, 404]).toContain(res.status));
    await request(server())
      .post('/api/v1/billing/subscription')
      .set(bearer(other))
      .send({ planSlug: planSlug('starter'), billingCycle: 'MONTHLY', tenant: owner.tenantSlug })
      .expect((res) => expect([403, 404]).toContain(res.status));
    const res = await request(server()).get('/api/v1/billing/subscription').set(bearer(other)).expect(200);
    expect(res.body.data.subscription).toBeNull();
  });

  describe('after the trial ends', () => {
    let trialEndsAt: Date;

    beforeAll(async () => {
      trialEndsAt = await trialEndedDaysAgo(owner, 1);
    });

    it('enters a 7-day grace period with the store still open', async () => {
      const res = await request(server()).get('/api/v1/billing/subscription').set(bearer(owner)).expect(200);
      expect(res.body.data.subscription).toMatchObject({ status: 'PAST_DUE', phase: 'GRACE' });
      expect(new Date(res.body.data.subscription.paymentDueBy)).toEqual(paymentDeadline(trialEndsAt));

      await request(server()).get(`/api/v1/public/stores/${owner.storeSlug}`).expect(200);
      const checkout = await request(server())
        .post(`/api/v1/public/stores/${owner.storeSlug}/checkout`)
        .set('Idempotency-Key', `grace-${suffix}`)
        .send(checkoutBody);
      expect(checkout.body?.error?.code).not.toBe('STORE_UNAVAILABLE');
      expect((await prisma.store.findUniqueOrThrow({ where: { id: owner.storeId } })).status).toBe(StoreStatus.ACTIVE);
    });

    it('is idempotent when evaluated repeatedly', async () => {
      const again = await lifecycle.evaluateTenant(owner.tenantId);
      expect(again).toEqual({ movedToGrace: 0, suspended: 0, storesSuspended: 0 });
    });
  });

  describe('after the grace period ends', () => {
    let dataBefore: Awaited<ReturnType<typeof storeDataCounts>>;

    beforeAll(async () => {
      dataBefore = await storeDataCounts(owner.storeId);
      await trialEndedDaysAgo(owner, 8);
    });

    it('shows shoppers a neutral unavailable message and suspends the store', async () => {
      const res = await request(server()).get(`/api/v1/public/stores/${owner.storeSlug}`).expect(403);
      expect(res.body.error).toMatchObject({ code: 'STORE_UNAVAILABLE', message: 'This store is currently unavailable.' });
      expect(JSON.stringify(res.body)).not.toMatch(UUID);
      expect(JSON.stringify(res.body)).not.toMatch(/payment|subscription|suspend|trial/i);

      const store = await prisma.store.findUniqueOrThrow({ where: { id: owner.storeId } });
      expect(store.status).toBe(StoreStatus.SUSPENDED);
      expect(store.statusBeforeBillingSuspension).toBe(StoreStatus.ACTIVE);
      expect((await subscriptionOf(owner)).status).toBe(SubscriptionStatus.EXPIRED);
      const audit = await prisma.auditLog.findMany({
        where: { tenantId: owner.tenantId, action: { in: ['SUBSCRIPTION_SUSPENDED_NON_PAYMENT', 'STORE_SUSPENDED_BILLING'] } },
      });
      expect(audit.map((a) => a.action).sort()).toEqual(['STORE_SUSPENDED_BILLING', 'SUBSCRIPTION_SUSPENDED_NON_PAYMENT']);
    });

    it('blocks checkout, product listing and the platform host server-side', async () => {
      const checkout = await request(server())
        .post(`/api/v1/public/stores/${owner.storeSlug}/checkout`)
        .set('Idempotency-Key', `suspended-${suffix}`)
        .send(checkoutBody)
        .expect(403);
      expect(checkout.body.error.code).toBe('STORE_UNAVAILABLE');
      await request(server()).get(`/api/v1/public/stores/${owner.storeSlug}/products`).expect(403);

      const domain = await prisma.domain.findFirst({ where: { storeId: owner.storeId } });
      if (domain) {
        const resolved = await request(server())
          .get('/api/v1/public/domain/resolve')
          .query({ host: domain.hostname })
          .expect(403);
        expect(resolved.body.error.code).toBe('STORE_UNAVAILABLE');
      }
      expect(await prisma.order.count({ where: { storeId: owner.storeId } })).toBe(0);
    });

    it('keeps unknown stores a plain 404', async () => {
      await request(server()).get(`/api/v1/public/stores/no-such-store-${suffix}`).expect(404);
    });

    it('lets the merchant sign in and see the suspended subscription, but not operate the store', async () => {
      const res = await request(server()).get('/api/v1/billing/subscription').set(bearer(owner)).expect(200);
      expect(res.body.data.subscription).toMatchObject({ status: 'EXPIRED', phase: 'SUSPENDED', amountDue: 5395 });

      await request(server()).get(`/api/v1/stores/${owner.storeId}`).set(bearer(owner)).expect(403);
      const created = await request(server())
        .post(`/api/v1/tenants/${owner.tenantId}/stores`)
        .set(bearer(owner))
        .send({ name: 'Second store', slug: `sub-second-${suffix}` })
        .expect(402);
      expect(created.body.error.message).toBe(
        'Your subscription payment is overdue. Complete your payment to reactivate your store.',
      );
    });

    it('deletes no store data', async () => {
      expect(await storeDataCounts(owner.storeId)).toEqual(dataBefore);
      expect(await prisma.tenant.count({ where: { id: owner.tenantId } })).toBe(1);
    });

    it('is idempotent when evaluated repeatedly', async () => {
      expect(await lifecycle.evaluateTenant(owner.tenantId)).toEqual({ movedToGrace: 0, suspended: 0, storesSuspended: 0 });
    });

    it('leaves other tenants untouched', async () => {
      await request(server()).get(`/api/v1/public/stores/${other.storeSlug}`).expect(200);
    });
  });

  describe('payment confirmation', () => {
    it('reactivates the subscription and store only through a confirmed activation', async () => {
      const sub = await subscriptionOf(owner);
      await request(server())
        .patch(`/api/v1/admin/subscriptions/${sub.id}/status`)
        .set(bearer(owner))
        .send({ status: 'ACTIVE' })
        .expect(403);

      const before = new Date();
      await request(server())
        .patch(`/api/v1/admin/subscriptions/${sub.id}/status`)
        .set(bearer(admin))
        .send({ status: 'ACTIVE' })
        .expect(200);

      const active = await subscriptionOf(owner);
      expect(active.status).toBe(SubscriptionStatus.ACTIVE);
      // Reactivating after suspension starts a fresh 6-month paid period.
      expect(active.endsAt!.getTime()).toBeGreaterThanOrEqual(addCalendarMonths(before, 6).getTime() - 1000);
      const store = await prisma.store.findUniqueOrThrow({ where: { id: owner.storeId } });
      expect(store.status).toBe(StoreStatus.ACTIVE);
      expect(store.statusBeforeBillingSuspension).toBeNull();
      await request(server()).get(`/api/v1/public/stores/${owner.storeSlug}`).expect(200);

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: sub.id, action: 'SUBSCRIPTION_ACTIVATED' },
      });
      expect(audit?.metadata).toMatchObject({ source: 'ADMIN_CONFIRMED' });
      expect(await prisma.payment.count({ where: { storeId: owner.storeId } })).toBe(0);
    });

    it('is idempotent', async () => {
      const sub = await subscriptionOf(owner);
      await expect(
        lifecycle.activateAfterConfirmedPayment({ subscriptionId: sub.id, source: 'ADMIN_CONFIRMED' }),
      ).resolves.toEqual({ activated: false, storesRestored: 0 });
    });

    it('never suspends a paid subscription', async () => {
      await trialEndedDaysAgo(owner, 60);
      expect(await lifecycle.evaluateTenant(owner.tenantId)).toEqual({ movedToGrace: 0, suspended: 0, storesSuspended: 0 });
      expect((await prisma.store.findUniqueOrThrow({ where: { id: owner.storeId } })).status).toBe(StoreStatus.ACTIVE);
    });

    it('lets a payment made during grace win over a later evaluation', async () => {
      const trialEndsAt = await trialEndedDaysAgo(payer, 2);
      const sub = await subscriptionOf(payer);
      await lifecycle.activateAfterConfirmedPayment({ subscriptionId: sub.id, source: 'ADMIN_CONFIRMED' });
      const paid = await subscriptionOf(payer);
      // Paying in grace covers the period from the original due date.
      expect(paid.endsAt).toEqual(addCalendarMonths(trialEndsAt, 6));

      await trialEndedDaysAgo(payer, 30);
      expect(await lifecycle.evaluateTenant(payer.tenantId)).toEqual({ movedToGrace: 0, suspended: 0, storesSuspended: 0 });
      await request(server()).get(`/api/v1/public/stores/${payer.storeSlug}`).expect(200);
    });
  });

  it('does not reopen a store a Super Admin suspended for another reason', async () => {
    await request(server())
      .patch(`/api/v1/admin/stores/${adminHeld.storeId}/status`)
      .set(bearer(admin))
      .send({ status: 'SUSPENDED' })
      .expect(200);
    await trialEndedDaysAgo(adminHeld, 8);
    await lifecycle.evaluateTenant(adminHeld.tenantId);
    const sub = await subscriptionOf(adminHeld);
    expect(sub.status).toBe(SubscriptionStatus.EXPIRED);

    await lifecycle.activateAfterConfirmedPayment({ subscriptionId: sub.id, source: 'ADMIN_CONFIRMED' });
    const store = await prisma.store.findUniqueOrThrow({ where: { id: adminHeld.storeId } });
    expect(store.status).toBe(StoreStatus.SUSPENDED);
    expect(store.statusBeforeBillingSuspension).toBeNull();
  });

  it('never suspends businesses that have no subscription', async () => {
    await onboard(legacy);
    expect(await lifecycle.evaluateTenant(legacy.tenantId)).toEqual({ movedToGrace: 0, suspended: 0, storesSuspended: 0 });
    await request(server()).get(`/api/v1/public/stores/${legacy.storeSlug}`).expect(200);
  });
});
