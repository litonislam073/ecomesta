import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { CouponType, PlatformRole, UserStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, uniqueTransactionId, withPayment } from './support/onboarding';

/**
 * Coupons are a plan feature (Growth and Business; not Starter). The rule must
 * hold at checkout, not only when creating coupons: a store that moves to a
 * plan without coupons keeps its coupons stored, but shoppers cannot redeem
 * them until the store is back on a plan that includes coupons.
 */
describe('Coupons follow the store’s current plan at checkout (e2e)', () => {
  jest.setTimeout(180_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  interface Shop {
    key: string;
    plan: string;
    token: string;
    tenantId: string;
    storeId: string;
    storeSlug: string;
    productId: string;
    shippingMethodId: string;
    couponId: string;
    couponCode: string;
  }
  const shop = (key: string, plan: string): Shop => ({
    key,
    plan,
    token: '',
    tenantId: '',
    storeId: '',
    storeSlug: `cpn-${key}-${suffix}`,
    productId: '',
    shippingMethodId: '',
    couponId: '',
    couponCode: `CPN${key.toUpperCase()}${suffix.replace('-', '')}`.slice(0, 40),
  });
  const starter = shop('starter', 'starter');
  const growth = shop('growth', 'growth');
  const business = shop('business', 'business');
  const admin = { token: '', id: '' };

  const server = () => app.getHttpServer();
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function register(email: string) {
    const res = await request(server())
      .post('/api/v1/auth/register')
      .send({ email, password: 'SecurePass1', firstName: 'Coupon', lastName: 'Plan' })
      .expect(201);
    return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string };
  }

  async function openShop(s: Shop) {
    s.token = (await register(`cpn.${s.key}.${suffix}@example.com`)).token;
    const res = await request(server())
      .post('/api/v1/onboarding/store')
      .set(bearer(s.token))
      .send(withPayment({
        businessName: `Coupon ${s.key} ${suffix}`,
        tenantSlug: s.storeSlug,
        storeName: `Coupon ${s.key}`,
        storeSlug: s.storeSlug,
        planSlug: s.plan,
      }))
      .expect(201)
      .then(activateOnboarded(app));
    s.tenantId = res.body.data.tenant.id;
    s.storeId = res.body.data.store.id;

    const product = await request(server())
      .post(`/api/v1/stores/${s.storeId}/products`)
      .set(bearer(s.token))
      .send({ name: 'Panjabi', slug: `panjabi-${suffix}`, status: 'ACTIVE', basePrice: '1000.00', trackInventory: false })
      .expect(201);
    s.productId = product.body.data.id;
    const shipping = await request(server())
      .post(`/api/v1/stores/${s.storeId}/shipping-methods`)
      .set(bearer(s.token))
      .send({ name: 'Free Shipping', type: 'FREE', price: '0', active: true })
      .expect(201);
    s.shippingMethodId = shipping.body.data.id;
  }

  async function createCouponThroughApi(s: Shop) {
    const res = await request(server())
      .post(`/api/v1/stores/${s.storeId}/coupons`)
      .set(bearer(s.token))
      .send({ code: s.couponCode, type: 'PERCENTAGE', value: '10', active: true })
      .expect(201);
    s.couponId = res.body.data.id;
  }

  const validate = (s: Shop) =>
    request(server())
      .post(`/api/v1/public/stores/${s.storeSlug}/coupons/validate`)
      .send({ code: s.couponCode, items: [{ productId: s.productId, quantity: 1 }] });

  const quote = (s: Shop) =>
    request(server())
      .post(`/api/v1/public/stores/${s.storeSlug}/checkout/quote`)
      .send({
        items: [{ productId: s.productId, quantity: 1 }],
        shippingMethodId: s.shippingMethodId,
        couponCode: s.couponCode,
      })
      .expect(200);

  let orderSeq = 0;
  const checkout = (s: Shop) =>
    request(server())
      .post(`/api/v1/public/stores/${s.storeSlug}/checkout`)
      .set('Idempotency-Key', `cpn-${s.key}-${suffix}-${(orderSeq += 1)}`)
      .send({
        items: [{ productId: s.productId, quantity: 1 }],
        customer: { name: 'Coupon Shopper', phone: '01711000000' },
        shippingAddress: { name: 'Coupon Shopper', addressLine1: '1 Main', city: 'Dhaka', country: 'BD' },
        billingSameAsShipping: true,
        shippingMethodId: s.shippingMethodId,
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
        couponCode: s.couponCode,
      });

  async function expectCouponWorks(s: Shop) {
    const valid = await validate(s).expect(200);
    expect(valid.body.data.discount).toBe('100.00');

    const priced = await quote(s);
    expect(priced.body.data.couponCode).toBe(s.couponCode);
    expect(priced.body.data.couponError).toBeNull();
    expect(priced.body.data.discountTotal).toBe('100.00');

    const placed = await checkout(s).expect(201);
    const order = await prisma.order.findFirstOrThrow({
      where: { storeId: s.storeId, publicReference: placed.body.data.publicReference },
    });
    expect(order.couponCode).toBe(s.couponCode);
    expect(order.discountTotal.toFixed(2)).toBe('100.00');
    expect(order.grandTotal.toFixed(2)).toBe('900.00');
  }

  async function expectCouponRefused(s: Shop) {
    const refused = await validate(s).expect(422);
    expect(refused.body.error.code).toBe('PLAN_UPGRADE_REQUIRED');
    expect(refused.body.error.message).toBe('Coupons are not available at this store.');

    // The summary still prices the cart — just without a discount.
    const priced = await quote(s);
    expect(priced.body.data.couponCode).toBeNull();
    expect(priced.body.data.couponError).toBe('Coupons are not available at this store.');
    expect(priced.body.data.discountTotal).toBe('0.00');
    expect(priced.body.data.total).toBe('1000.00');

    // Placing the order with the coupon is refused: no order, no discount, no redemption.
    const ordersBefore = await prisma.order.count({ where: { storeId: s.storeId } });
    const usagesBefore = await prisma.couponUsage.count({ where: { couponId: s.couponId } });
    const { usageCount } = await prisma.coupon.findUniqueOrThrow({ where: { id: s.couponId } });
    const placed = await checkout(s).expect(422);
    expect(placed.body.error.code).toBe('PLAN_UPGRADE_REQUIRED');
    expect(await prisma.order.count({ where: { storeId: s.storeId } })).toBe(ordersBefore);
    expect(await prisma.couponUsage.count({ where: { couponId: s.couponId } })).toBe(usagesBefore);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: s.couponId } })).usageCount).toBe(usageCount);
  }

  async function changePlan(s: Shop, planSlug: string) {
    const payment = await request(server())
      .post('/api/v1/billing/payments')
      .set(bearer(s.token))
      .send({ planSlug, billingCycle: 'MONTHLY', method: 'NAGAD', senderNumber: '01812345678', transactionId: uniqueTransactionId() })
      .expect(201);
    await request(server())
      .post(`/api/v1/admin/billing-payments/${payment.body.data.id}/approve`)
      .set(bearer(admin.token))
      .expect((res) => expect([200, 201]).toContain(res.status));
    const current = await prisma.subscription.findFirstOrThrow({
      where: { tenantId: s.tenantId },
      include: { plan: true },
      orderBy: { updatedAt: 'desc' },
    });
    expect(current.plan.slug).toBe(planSlug);
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
    const redis = app.get(RedisService);
    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }

    Object.assign(admin, await register(`cpn.admin.${suffix}@example.com`));
    await prisma.user.update({
      where: { id: admin.id },
      data: { platformRole: PlatformRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
    });
    admin.token = (
      await request(server())
        .post('/api/v1/auth/login')
        .send({ email: `cpn.admin.${suffix}@example.com`, password: 'SecurePass1' })
        .expect(200)
    ).body.data.accessToken;

    for (const s of [starter, growth, business]) await openShop(s);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('Starter: a coupon already stored for the store cannot be redeemed', async () => {
    // Starter cannot create coupons; this one predates the plan (e.g. imported or left from an older plan).
    const coupon = await prisma.coupon.create({
      data: { storeId: starter.storeId, code: starter.couponCode, type: CouponType.PERCENTAGE, value: '10', active: true },
    });
    starter.couponId = coupon.id;
    await expectCouponRefused(starter);
  });

  it('Growth: a valid coupon discounts the order', async () => {
    await createCouponThroughApi(growth);
    await expectCouponWorks(growth);
  });

  it('Business: a valid coupon discounts the order', async () => {
    await createCouponThroughApi(business);
    await expectCouponWorks(business);
  });

  it('Growth → Starter: the coupon stays stored but cannot be used', async () => {
    await changePlan(growth, 'starter');

    const stored = await prisma.coupon.findUniqueOrThrow({ where: { id: growth.couponId } });
    expect(stored.code).toBe(growth.couponCode);
    expect(stored.active).toBe(true);
    await expectCouponRefused(growth);
  });

  it('Starter → Growth again: the same coupon works again', async () => {
    await changePlan(growth, 'growth');
    await expectCouponWorks(growth);
  });
});
