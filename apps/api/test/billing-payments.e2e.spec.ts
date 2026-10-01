import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PlatformRole, StoreStatus, SubscriptionStatus, UserStatus } from '@prisma/client';
import { addCalendarDays, addCalendarMonths } from '@ecomesta/utils';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SubscriptionLifecycleService } from '../src/modules/billing/subscription-lifecycle.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

const TEST_EMAIL = /^pay\.[a-z]+\.\d+-\d+@example\.com$/;

/** Removes only what this spec created (matched by its email pattern). */
async function removeTestData(prisma: PrismaService) {
  const users = (
    await prisma.user.findMany({
      where: { email: { startsWith: 'pay.', endsWith: '@example.com' } },
      select: { id: true, email: true, tenantMemberships: { select: { tenantId: true } } },
    })
  ).filter((user) => TEST_EMAIL.test(user.email));
  const userIds = users.map((user) => user.id);
  const tenantIds = users.flatMap((user) => user.tenantMemberships.map((m) => m.tenantId));
  const storeIds = (
    await prisma.store.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true } })
  ).map((store) => store.id);
  await prisma.$transaction(async (tx) => {
    await tx.billingPayment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await tx.emailDelivery.deleteMany({ where: { userId: { in: userIds } } });
    await tx.coupon.deleteMany({ where: { storeId: { in: storeIds } } });
    await tx.paymentProviderConfig.deleteMany({ where: { storeId: { in: storeIds } } });
    await tx.inventoryItem.deleteMany({ where: { storeId: { in: storeIds } } });
    await tx.product.deleteMany({ where: { storeId: { in: storeIds } } });
    await tx.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await tx.storeTheme.deleteMany({ where: { storeId: { in: storeIds } } });
    await tx.store.deleteMany({ where: { id: { in: storeIds } } });
    await tx.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });
}

describe('Plans, entitlements and manual billing payments (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let lifecycle: SubscriptionLifecycleService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  let txnSeq = 0;
  const txn = () => `TXN${suffix.replace('-', '')}${(txnSeq += 1)}`.slice(0, 30);

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
    email: `pay.${key}.${suffix}@example.com`,
    token: '',
    id: '',
    tenantId: '',
    tenantSlug: `pay-${key}-${suffix}`,
    storeId: '',
    storeSlug: `pay-${key}-${suffix}`,
  });
  const starter = merchant('starter');
  const upgrader = merchant('upgrader');
  const renewer = merchant('renewer');
  const outsider = merchant('outsider');
  const admin = { email: `pay.admin.${suffix}@example.com`, token: '', id: '' };

  const server = () => app.getHttpServer();
  const bearer = (user: { token: string }) => ({ Authorization: `Bearer ${user.token}` });

  async function register(user: { email: string; token: string; id: string }) {
    const res = await request(server())
      .post('/api/v1/auth/register')
      .send({ email: user.email, password: 'SecurePass1', firstName: 'Pay', lastName: 'Test' })
      .expect(201);
    user.token = res.body.data.accessToken;
    user.id = res.body.data.user.id;
  }

  async function onboard(user: Merchant, planSlug: string, cycle = 'MONTHLY') {
    const res = await request(server())
      .post('/api/v1/onboarding/store')
      .set(bearer(user))
      .send({
        businessName: `Pay ${user.tenantSlug}`,
        tenantSlug: user.tenantSlug,
        storeName: `Pay ${user.storeSlug}`,
        storeSlug: user.storeSlug,
        planSlug,
        billingCycle: cycle,
      })
      .expect(201);
    user.tenantId = res.body.data.tenant.id;
    user.storeId = res.body.data.store.id;
    await prisma.store.update({ where: { id: user.storeId }, data: { status: StoreStatus.ACTIVE } });
  }

  const subscriptionOf = (user: Merchant) =>
    prisma.subscription.findFirstOrThrow({
      where: { tenantId: user.tenantId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

  const submit = (user: Merchant, body: Record<string, unknown>) =>
    request(server()).post('/api/v1/billing/payments').set(bearer(user)).send({
      planSlug: 'growth',
      billingCycle: 'MONTHLY',
      method: 'BKASH',
      senderNumber: '01712345678',
      transactionId: txn(),
      ...body,
    });

  const createCoupon = (user: Merchant) =>
    request(server())
      .post(`/api/v1/stores/${user.storeId}/coupons`)
      .set(bearer(user))
      .send({ code: `SAVE${txnSeq += 1}`, type: 'PERCENTAGE', value: '10' });

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
    lifecycle = app.get(SubscriptionLifecycleService);
    const redis = app.get(RedisService);
    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }

    for (const user of [starter, upgrader, renewer, outsider, admin]) await register(user);
    await prisma.user.update({
      where: { id: admin.id },
      data: { platformRole: PlatformRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
    });
    await onboard(starter, 'starter');
    await onboard(upgrader, 'starter', 'YEARLY');
    await onboard(renewer, 'starter');
    await onboard(outsider, 'business');
  });

  afterAll(async () => {
    if (prisma) await removeTestData(prisma);
    await app?.close();
  });

  describe('plans', () => {
    it('publishes Starter ৳99, Growth ৳299 and Business ৳699 with their limits', async () => {
      const res = await request(server()).get('/api/v1/public/plans').expect(200);
      type Plan = { slug: string; prices: { amount: number }[]; limits: Record<string, unknown> };
      const bySlug: Record<string, Plan> = Object.fromEntries(
        (res.body.data as Plan[]).map((plan) => [plan.slug, plan]),
      );
      expect(bySlug.starter!.prices.map((p) => p.amount)).toEqual([99, 535, 891]);
      expect(bySlug.growth!.prices.map((p) => p.amount)).toEqual([299, 1615, 2691]);
      expect(bySlug.business!.prices.map((p) => p.amount)).toEqual([699, 3775, 6291]);
      expect(bySlug.starter!.limits).toMatchObject({ maxProducts: 50, coupons: false, customDomain: false });
      expect(bySlug.growth!.limits).toMatchObject({ maxProducts: 500, coupons: true, stripe: false });
      expect(bySlug.business!.limits).toMatchObject({ maxProducts: null, stripe: true });
    });
  });

  describe('Starter limits', () => {
    it('refuses coupons, delivery zones, custom domains, SSLCommerz, Stripe and premium themes', async () => {
      const coupon = await createCoupon(starter).expect(403);
      expect(coupon.body.error.code).toBe('PLAN_UPGRADE_REQUIRED');
      expect(coupon.body.error.message).toMatch(/Upgrade to Growth or Business in Plan & billing/);

      const zone = await request(server())
        .post(`/api/v1/stores/${starter.storeId}/shipping-zones`)
        .set(bearer(starter))
        .send({ name: 'Dhaka', locations: [] })
        .expect(403);
      expect(zone.body.error.code).toBe('PLAN_UPGRADE_REQUIRED');

      await request(server())
        .post(`/api/v1/stores/${starter.storeId}/domains`)
        .set(bearer(starter))
        .send({ hostname: `shop-${suffix}.example.com` })
        .expect(403);

      for (const provider of ['SSL_COMMERZ', 'STRIPE']) {
        const res = await request(server())
          .post(`/api/v1/stores/${starter.storeId}/payment-providers`)
          .set(bearer(starter))
          .send({ provider, enabled: true, mode: 'test' })
          .expect(403);
        expect(res.body.error.message).toMatch(provider === 'STRIPE' ? /Upgrade to Business/ : /Growth or Business/);
      }

      const minimal = await prisma.theme.findFirstOrThrow({ where: { slug: 'minimal' } });
      await request(server())
        .patch(`/api/v1/stores/${starter.storeId}/theme`)
        .set(bearer(starter))
        .send({ themeId: minimal.id })
        .expect(403);
    });

    it('allows up to 50 products and refuses the 51st', async () => {
      const make = (i: number) =>
        request(server())
          .post(`/api/v1/stores/${starter.storeId}/products`)
          .set(bearer(starter))
          .send({ name: `Item ${i}`, slug: `item-${i}-${suffix}`, basePrice: '10.00', trackInventory: false });
      for (let i = 1; i <= 50; i += 1) await make(i).expect(201);
      const refused = await make(51).expect(403);
      expect(refused.body.error.message).toMatch(/up to 50 products and you have 50/);
      expect(await prisma.product.count({ where: { storeId: starter.storeId } })).toBe(50);
    });

    it('hides an online provider the plan does not include from shoppers', async () => {
      await prisma.paymentProviderConfig.create({
        data: { storeId: starter.storeId, provider: 'SSL_COMMERZ', enabled: true, mode: 'test' },
      });
      const res = await request(server())
        .get(`/api/v1/public/stores/${starter.storeSlug}/payment-providers`)
        .expect(200);
      expect(res.body.data.online.map((p: { provider: string }) => p.provider)).not.toContain('SSL_COMMERZ');
    });
  });

  describe('plan changes during the trial', () => {
    it('refuses an upgrade without payment but allows a cheaper plan or another billing period', async () => {
      const up = await request(server())
        .post('/api/v1/billing/subscription')
        .set(bearer(outsider))
        .send({ planSlug: 'business', billingCycle: 'YEARLY' })
        .expect(201);
      expect(up.body.data.subscription.billingCycle).toBe('YEARLY');

      const refused = await request(server())
        .post('/api/v1/billing/subscription')
        .set(bearer(upgrader))
        .send({ planSlug: 'growth', billingCycle: 'YEARLY' })
        .expect(402);
      expect(refused.body.error.message).toMatch(/Growth unlocks once your payment is confirmed/);
      expect((await subscriptionOf(upgrader)).plan.slug).toBe('starter');

      await request(server())
        .post('/api/v1/billing/subscription')
        .set(bearer(outsider))
        .send({ planSlug: 'growth', billingCycle: 'MONTHLY' })
        .expect(201);
      expect((await subscriptionOf(outsider)).plan.slug).toBe('growth');
    });
  });

  describe('reporting a payment', () => {
    it('lists the wallet numbers to pay', async () => {
      const res = await request(server()).get('/api/v1/billing/payment-accounts').set(bearer(starter)).expect(200);
      expect(res.body.data).toEqual([
        { method: 'BKASH', label: 'bKash', number: '01309093407', transferType: 'Send Money' },
        { method: 'NAGAD', label: 'Nagad', number: '01309093407', transferType: 'Send Money' },
        { method: 'ROCKET', label: 'Rocket', number: '01757591788', transferType: 'Send Money' },
        { method: 'UPAY', label: 'Upay', number: '01318090622', transferType: 'Send Money' },
      ]);
    });

    it('validates the sender number, transaction ID and method', async () => {
      expect((await submit(upgrader, { senderNumber: '12345' }).expect(400)).body.error.message).toMatch(/11-digit/);
      expect((await submit(upgrader, { transactionId: 'ab' }).expect(400)).body.error.message).toMatch(/transaction ID/);
      await submit(upgrader, { method: 'PAYPAL' }).expect(400);
      await submit(upgrader, { amount: 1 }).expect(400);
    });

    it('records a pending payment at the server price without unlocking anything', async () => {
      const res = await submit(upgrader, {
        planSlug: 'growth',
        billingCycle: 'YEARLY',
        senderNumber: '+880 1712-345678',
        transactionId: 'abc 123 xyz',
      }).expect(201);
      expect(res.body.data).toMatchObject({
        planSlug: 'growth',
        billingCycle: 'YEARLY',
        amount: 2691,
        method: 'BKASH',
        senderNumber: '01712345678',
        transactionId: 'ABC123XYZ',
        status: 'PENDING',
      });
      expect((await subscriptionOf(upgrader)).plan.slug).toBe('starter');
      await createCoupon(upgrader).expect(403);

      const sub = await request(server()).get('/api/v1/billing/subscription').set(bearer(upgrader)).expect(200);
      expect(sub.body.data.pendingPayment).toMatchObject({ status: 'PENDING', amount: 2691 });

      const notice = await prisma.emailDelivery.findFirstOrThrow({
        where: { eventType: 'BILLING_PAYMENT_SUBMITTED', userId: upgrader.id },
      });
      expect(notice.payload).toMatchObject({ amount: 2691, transactionId: 'ABC123XYZ', payToNumber: '01309093407' });
    });

    it('allows one payment under review at a time and never the same transaction ID twice', async () => {
      const second = await submit(upgrader, {}).expect(409);
      expect(second.body.error.message).toMatch(/already have a payment waiting/);
      const reused = await submit(renewer, { transactionId: 'ABC123XYZ' }).expect(409);
      expect(reused.body.error.message).toMatch(/already been submitted/);
    });

    it('keeps payments within the business', async () => {
      const res = await request(server()).get('/api/v1/billing/payments').set(bearer(outsider)).expect(200);
      expect(res.body.data).toEqual([]);
      await request(server())
        .get(`/api/v1/billing/payments?tenant=${upgrader.tenantSlug}`)
        .set(bearer(outsider))
        .expect((r) => expect([403, 404]).toContain(r.status));
    });
  });

  describe('admin review', () => {
    let pendingId: string;

    beforeAll(async () => {
      pendingId = (await prisma.billingPayment.findFirstOrThrow({ where: { tenantId: upgrader.tenantId } })).id;
    });

    it('is only for Super Admins', async () => {
      await request(server()).get('/api/v1/admin/billing-payments').set(bearer(upgrader)).expect(403);
      await request(server()).post(`/api/v1/admin/billing-payments/${pendingId}/approve`).set(bearer(upgrader)).expect(403);
    });

    it('lists pending payments with the business and current plan', async () => {
      const res = await request(server())
        .get('/api/v1/admin/billing-payments?status=PENDING&limit=100')
        .set(bearer(admin))
        .expect(200);
      const row = res.body.data.items.find((item: { id: string }) => item.id === pendingId);
      expect(row).toMatchObject({
        status: 'PENDING',
        amount: 2691,
        payToNumber: '01309093407',
        tenant: { slug: upgrader.tenantSlug },
        submittedBy: { email: upgrader.email },
        currentSubscription: { status: 'TRIALING', planName: 'Starter' },
      });
      expect(res.body.data.pendingCount).toBeGreaterThanOrEqual(1);
    });

    it('approving a trial payment switches the plan now and starts the paid year when the trial ends', async () => {
      const before = await subscriptionOf(upgrader);
      const res = await request(server())
        .post(`/api/v1/admin/billing-payments/${pendingId}/approve`)
        .set(bearer(admin))
        .expect(200);
      expect(res.body.data).toMatchObject({ status: 'APPROVED', reviewedBy: { email: admin.email } });

      const after = await subscriptionOf(upgrader);
      expect(after.status).toBe(SubscriptionStatus.ACTIVE);
      expect(after.plan.slug).toBe('growth');
      expect(after.billingCycle).toBe('YEARLY');
      expect(after.endsAt).toEqual(addCalendarMonths(before.trialEndsAt!, 12));

      // Growth features unlock immediately.
      await createCoupon(upgrader).expect(201);
      const approved = await prisma.emailDelivery.findFirstOrThrow({
        where: { eventType: 'BILLING_PAYMENT_APPROVED', userId: upgrader.id },
      });
      expect(approved.payload).toMatchObject({ paidThrough: after.endsAt!.toISOString() });

      // Approving again is harmless and sends nothing new.
      await request(server()).post(`/api/v1/admin/billing-payments/${pendingId}/approve`).set(bearer(admin)).expect(200);
      expect(await prisma.emailDelivery.count({ where: { eventType: 'BILLING_PAYMENT_APPROVED', userId: upgrader.id } })).toBe(1);
      await request(server())
        .post(`/api/v1/admin/billing-payments/${pendingId}/reject`)
        .set(bearer(admin))
        .send({ reason: 'Too late' })
        .expect(409);
    });

    it('rejecting requires a reason, tells the merchant and leaves the plan unchanged', async () => {
      const payment = (await submit(renewer, { planSlug: 'starter' }).expect(201)).body.data;
      await request(server())
        .post(`/api/v1/admin/billing-payments/${payment.id}/reject`)
        .set(bearer(admin))
        .send({ reason: '' })
        .expect(400);
      const res = await request(server())
        .post(`/api/v1/admin/billing-payments/${payment.id}/reject`)
        .set(bearer(admin))
        .send({ reason: 'No payment with this transaction ID reached our bKash number.' })
        .expect(200);
      expect(res.body.data).toMatchObject({ status: 'REJECTED', rejectionReason: expect.stringMatching(/No payment/) });
      expect((await subscriptionOf(renewer)).status).toBe(SubscriptionStatus.TRIALING);
      const mail = await prisma.emailDelivery.findFirstOrThrow({
        where: { eventType: 'BILLING_PAYMENT_REJECTED', userId: renewer.id },
      });
      expect(mail.payload).toMatchObject({ rejectionReason: expect.stringMatching(/No payment/) });
      await request(server())
        .post(`/api/v1/admin/billing-payments/${payment.id}/approve`)
        .set(bearer(admin))
        .expect(409);
    });

    it('renewing the same plan extends the paid period', async () => {
      const payment = (await submit(renewer, { planSlug: 'starter' }).expect(201)).body.data;
      await request(server()).post(`/api/v1/admin/billing-payments/${payment.id}/approve`).set(bearer(admin)).expect(200);
      const first = await subscriptionOf(renewer);
      expect(first.status).toBe(SubscriptionStatus.ACTIVE);

      const renewal = (await submit(renewer, { planSlug: 'starter' }).expect(201)).body.data;
      await request(server()).post(`/api/v1/admin/billing-payments/${renewal.id}/approve`).set(bearer(admin)).expect(200);
      const second = await subscriptionOf(renewer);
      expect(second.endsAt).toEqual(addCalendarMonths(first.endsAt!, 1));
    });
  });

  describe('when a paid period ends', () => {
    it('moves the subscription to payment due with a grace period', async () => {
      const sub = await subscriptionOf(renewer);
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { endsAt: addCalendarDays(new Date(), -1) },
      });
      await lifecycle.evaluateTenant(renewer.tenantId);
      expect((await subscriptionOf(renewer)).status).toBe(SubscriptionStatus.PAST_DUE);
      const res = await request(server()).get('/api/v1/billing/subscription').set(bearer(renewer)).expect(200);
      expect(res.body.data.subscription.phase).toBe('GRACE');
    });
  });
});
