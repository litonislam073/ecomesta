import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PlatformRole, StoreStatus, SubscriptionStatus, UserStatus } from '@prisma/client';
import { addCalendarMonths } from '@ecomesta/utils';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { withPayment } from './support/onboarding';

/**
 * Super Admin coupons for plan payments: created and managed by a Super Admin,
 * checked by the merchant before paying, applied again (with limits) when the
 * payment is recorded — on the billing page and at sign-up.
 */
describe('Plan payment coupons and admin counters (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const tag = suffix.replace('-', '').slice(-8);
  let txnSeq = 0;
  const txn = () => `CPN${tag}${(txnSeq += 1)}`.slice(0, 30);

  interface User { email: string; token: string; id: string; tenantId: string; slug: string }
  const user = (key: string): User => ({ email: `coup.${key}.${suffix}@example.com`, token: '', id: '', tenantId: '', slug: `coup-${key}-${suffix}` });
  const admin = user('admin');
  const alpha = user('alpha');
  const beta = user('beta');
  const gamma = user('gamma');
  const newbie = user('newbie');

  const server = () => app.getHttpServer();
  const bearer = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });
  const codes: string[] = [];
  const code = (name: string) => {
    const c = `${name}${tag}`;
    codes.push(c);
    return c;
  };

  async function register(u: User) {
    const res = await request(server())
      .post('/api/v1/auth/register')
      .send({ email: u.email, password: 'SecurePass1', firstName: 'Coupon', lastName: 'Test' })
      .expect(201);
    u.token = res.body.data.accessToken;
    u.id = res.body.data.user.id;
  }

  /** A business on a Starter trial with no payment waiting. */
  async function onboard(u: User) {
    const res = await request(server())
      .post('/api/v1/onboarding/store')
      .set(bearer(u))
      .send(withPayment({ businessName: `Coupon ${u.slug}`, tenantSlug: u.slug, storeName: 'Coupon', storeSlug: u.slug }))
      .expect(201);
    u.tenantId = res.body.data.tenant.id;
    await prisma.billingPayment.deleteMany({ where: { tenantId: u.tenantId } });
    const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { slug: 'starter' } });
    const startsAt = new Date();
    await prisma.subscription.create({
      data: { tenantId: u.tenantId, planId: plan.id, billingCycle: 'MONTHLY', status: SubscriptionStatus.TRIALING, startsAt, trialEndsAt: addCalendarMonths(startsAt, 2) },
    });
    await prisma.store.updateMany({ where: { tenantId: u.tenantId }, data: { status: StoreStatus.ACTIVE, awaitingFirstPayment: false } });
  }

  const createCoupon = (body: Record<string, unknown>, as: { token: string } = admin) =>
    request(server()).post('/api/v1/admin/billing-coupons').set(bearer(as)).send(body);
  const quote = (u: User, body: Record<string, unknown>) =>
    request(server()).post('/api/v1/billing/coupons/quote').set(bearer(u)).send({ planSlug: 'growth', billingCycle: 'MONTHLY', ...body });
  const submit = (u: User, body: Record<string, unknown>) =>
    request(server())
      .post('/api/v1/billing/payments')
      .set(bearer(u))
      .send({ planSlug: 'growth', billingCycle: 'MONTHLY', method: 'BKASH', senderNumber: '01712345678', transactionId: txn(), ...body });
  const review = (paymentId: string, action: 'approve' | 'reject') =>
    request(server())
      .post(`/api/v1/admin/billing-payments/${paymentId}/${action}`)
      .set(bearer(admin))
      .send(action === 'reject' ? { reason: 'Not received in our account' } : {});

  let eid: { id: string; code: string };

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
    const redis = app.get(RedisService);
    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }
    for (const u of [admin, alpha, beta, gamma, newbie]) await register(u);
    await prisma.user.update({ where: { id: admin.id }, data: { platformRole: PlatformRole.SUPER_ADMIN, status: UserStatus.ACTIVE } });
    for (const u of [alpha, beta, gamma]) await onboard(u);
  });

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({ where: { email: { endsWith: `.${suffix}@example.com` } }, select: { id: true } });
      const memberships = await prisma.tenantUser.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { tenantId: true } });
      const tenantIds = memberships.map((m) => m.tenantId);
      const storeIds = (await prisma.store.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true } })).map((s) => s.id);
      await prisma.$transaction(async (tx) => {
        await tx.billingPayment.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.billingCoupon.deleteMany({ where: { code: { in: codes } } });
        await tx.emailDelivery.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
        await tx.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.storeTheme.deleteMany({ where: { storeId: { in: storeIds } } });
        await tx.shippingMethod.deleteMany({ where: { storeId: { in: storeIds } } });
        await tx.shippingZone.deleteMany({ where: { storeId: { in: storeIds } } });
        await tx.store.deleteMany({ where: { id: { in: storeIds } } });
        await tx.tenant.deleteMany({ where: { id: { in: tenantIds } } });
        await tx.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
      });
    }
    await app?.close();
  });

  it('admin sidebar counters: new accounts since Users was opened, and payments to review', async () => {
    const badges = () => request(server()).get('/api/v1/admin/badges').set(bearer(admin));
    await request(server()).get('/api/v1/admin/badges').set(bearer(alpha)).expect(403);
    // Opening Users starts the count again.
    await request(server()).post('/api/v1/admin/badges/users-seen').set(bearer(admin)).expect(200);
    expect((await badges().expect(200)).body.data.newUsers).toBe(0);
    const late = user('late');
    await register(late);
    const after = (await badges().expect(200)).body.data;
    expect(after.newUsers).toBe(1);
    const pending = await prisma.billingPayment.count({ where: { status: 'PENDING' } });
    expect(after.pendingPayments).toBe(pending);
    expect((await request(server()).post('/api/v1/admin/badges/users-seen').set(bearer(admin)).expect(200)).body.data.newUsers).toBe(0);
  });

  it('only Super Admins manage coupons; codes are checked and unique', async () => {
    await createCoupon({ code: code('NOPE'), type: 'PERCENTAGE', value: 10 }, alpha).expect(403);
    await request(server()).get('/api/v1/admin/billing-coupons').set(bearer(alpha)).expect(403);
    await createCoupon({ code: 'a b', type: 'PERCENTAGE', value: 10 }).expect(400);
    await createCoupon({ code: code('TOOMUCH'), type: 'PERCENTAGE', value: 100 }).expect(400);

    const res = await createCoupon({
      code: code('eid').toLowerCase(),
      description: 'Eid offer',
      type: 'PERCENTAGE',
      value: 25,
      planSlugs: ['growth'],
      maxRedemptions: 2,
    }).expect(201);
    eid = { id: res.body.data.id, code: res.body.data.code };
    // Codes are stored upper-case and match whatever case the merchant types.
    expect(eid.code).toBe(`EID${tag}`);
    expect(res.body.data).toMatchObject({ type: 'PERCENTAGE', value: 25, planSlugs: ['growth'], maxRedemptions: 2, maxPerTenant: 1, active: true, usedCount: 0 });
    await createCoupon({ code: eid.code, type: 'FIXED_AMOUNT', value: 50 }).expect(409);
  });

  it('quotes the discounted price before paying, with clear reasons when it does not apply', async () => {
    const res = await quote(alpha, { code: eid.code.toLowerCase() }).expect(200);
    // Growth monthly ৳299: 25% off rounds down to ৳74.
    expect(res.body.data).toEqual({ code: eid.code, description: 'Eid offer', listAmount: 299, discountAmount: 74, amount: 225 });
    expect((await quote(alpha, { code: eid.code, planSlug: 'business' }).expect(400)).body.error.message).toMatch(/not for the Business plan/);
    expect((await quote(alpha, { code: 'NOSUCHCODE1' }).expect(400)).body.error.message).toBe('This coupon code is not valid.');
  });

  it('records a billing payment at the discounted price; a business uses it once', async () => {
    const res = await submit(alpha, { couponCode: eid.code }).expect(201);
    expect(res.body.data).toMatchObject({ amount: 225, listAmount: 299, discountAmount: 74, couponCode: eid.code });
    // Without a coupon the full price is charged, as before.
    const plain = await submit(beta, {}).expect(201);
    expect(plain.body.data).toMatchObject({ amount: 299, listAmount: null, discountAmount: 0, couponCode: null });
    await review(plain.body.data.id, 'reject').expect(200);

    await review(res.body.data.id, 'approve').expect(200);
    expect((await quote(alpha, { code: eid.code }).expect(400)).body.error.message).toBe('You have already used this coupon.');
  });

  it('applies at sign-up too, and stops at the total use limit; a rejected payment gives the use back', async () => {
    const signup = await request(server())
      .post('/api/v1/onboarding/store')
      .set(bearer(newbie))
      .send(withPayment({ businessName: 'Coupon newbie', tenantSlug: newbie.slug, storeName: 'Newbie', storeSlug: newbie.slug, planSlug: 'growth', billingCycle: 'YEARLY', couponCode: eid.code }))
      .expect(201);
    newbie.tenantId = signup.body.data.tenant.id;
    const payment = await prisma.billingPayment.findFirstOrThrow({ where: { tenantId: newbie.tenantId } });
    // Growth yearly ৳2,691: 25% off is ৳672.
    expect({ amount: Number(payment.amount), list: Number(payment.listAmount), off: Number(payment.discountAmount) }).toEqual({ amount: 2019, list: 2691, off: 672 });

    // Two uses (alpha approved, newbie pending): the limit is reached.
    expect((await submit(gamma, { couponCode: eid.code }).expect(400)).body.error.message).toBe('This coupon has been fully used.');
    await review(payment.id, 'reject').expect(200);
    await submit(gamma, { couponCode: eid.code }).expect(201);

    const list = await request(server()).get('/api/v1/admin/billing-coupons').set(bearer(admin)).expect(200);
    expect(list.body.data.find((c: { id: string }) => c.id === eid.id)).toMatchObject({ usedCount: 2, pendingCount: 1, approvedDiscountTotal: 74 });
  });

  it('turning a coupon off, dates, periods and too-large fixed amounts all refuse it', async () => {
    await request(server()).patch(`/api/v1/admin/billing-coupons/${eid.id}`).set(bearer(admin)).send({ active: false }).expect(200);
    expect((await quote(beta, { code: eid.code }).expect(400)).body.error.message).toBe('This coupon code is not valid.');

    const yearly = (await createCoupon({ code: code('YEARLY'), type: 'FIXED_AMOUNT', value: 100, billingCycles: ['YEARLY'] }).expect(201)).body.data;
    expect((await quote(beta, { code: yearly.code }).expect(400)).body.error.message).toMatch(/only with yearly billing/i);
    expect((await quote(beta, { code: yearly.code, billingCycle: 'YEARLY' }).expect(200)).body.data).toMatchObject({ discountAmount: 100, amount: 2591 });

    const future = (await createCoupon({ code: code('SOON'), type: 'PERCENTAGE', value: 10, startsAt: new Date(Date.now() + 86_400_000).toISOString() }).expect(201)).body.data;
    expect((await quote(beta, { code: future.code }).expect(400)).body.error.message).toBe('This coupon is not active yet.');
    const past = (await createCoupon({ code: code('GONE'), type: 'PERCENTAGE', value: 10, endsAt: new Date(Date.now() - 1000).toISOString() }).expect(201)).body.data;
    expect((await quote(beta, { code: past.code }).expect(400)).body.error.message).toBe('This coupon has expired.');
    const huge = (await createCoupon({ code: code('HUGE'), type: 'FIXED_AMOUNT', value: 5000 }).expect(201)).body.data;
    expect((await quote(beta, { code: huge.code }).expect(400)).body.error.message).toBe('This coupon cannot be used for this plan.');
  });
});
