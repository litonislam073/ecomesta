import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { MembershipStatus, StoreRole, StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Phase 14 coupons (e2e)', () => {
  jest.setTimeout(90_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const manager = {
    email: `phase14.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staff = {
    email: `phase14.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const otherManager = {
    email: `phase14.other.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeId = '';
  const storeSlug = `p14-store-${suffix}`;
  let otherStoreId = '';
  const otherStoreSlug = `p14-other-${suffix}`;
  let productId = '';
  let freeShippingId = '';
  let flatShippingId = '';
  let summerCouponId = '';

  const shippingAddress = {
    name: 'Coupon Guest',
    phone: '+15551414',
    addressLine1: '14 Coupon St',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    country: 'US',
  };

  function checkoutBody(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      items: [{ productId, quantity: 1 }],
      customer: {
        name: 'Coupon Guest',
        email: `guest.p14.${suffix}@example.com`,
        phone: '+15551414',
      },
      shippingAddress,
      billingSameAsShipping: true,
      shippingMethodId: freeShippingId,
      paymentProvider: 'COD',
      paymentMethod: 'CASH',
      ...overrides,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(RedisService);

    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) {
        await redis.getClient().del(...keys);
      }
    }

    for (const user of [manager, staff, otherManager]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Fourteen',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        businessName: 'P14 Tenant',
        tenantSlug: `p14-tenant-${suffix}`,
        storeName: 'P14 Store',
        storeSlug,
      })
      .expect(201);
    storeId = onboard.body.data.store.id;

    const otherOnboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${otherManager.token}`)
      .send({
        businessName: 'P14 Other Tenant',
        tenantSlug: `p14-tenant-b-${suffix}`,
        storeName: 'P14 Other Store',
        storeSlug: otherStoreSlug,
      })
      .expect(201);
    otherStoreId = otherOnboard.body.data.store.id;

    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });
    await prisma.store.update({
      where: { id: otherStoreId },
      data: { status: StoreStatus.ACTIVE },
    });

    await prisma.storeUser.create({
      data: {
        storeId,
        userId: staff.id,
        role: StoreRole.STORE_STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });
    const loginStaff = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: staff.email, password: staff.password })
      .expect(200);
    staff.token = loginStaff.body.data.accessToken;

    const product = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'P14 Widget',
        slug: `p14-widget-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '100.00',
        trackInventory: true,
        allowBackorder: false,
        sku: `P14-${suffix}`,
      })
      .expect(201);
    productId = product.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/inventory/adjust`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        productId,
        quantity: 50,
        type: 'ADJUSTMENT',
        note: 'Stock for phase 14',
      })
      .expect(201);

    const freeShip = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Free Coupon Ship',
        type: 'FREE',
        price: '0',
        active: true,
      })
      .expect(201);
    freeShippingId = freeShip.body.data.id;

    const flatShip = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Flat Coupon Ship',
        type: 'FLAT',
        price: '5.00',
        active: true,
      })
      .expect(201);
    flatShippingId = flatShip.body.data.id;
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  it('supports merchant coupon CRUD with code normalization', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/coupons`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        code: 'summer10',
        type: 'PERCENTAGE',
        value: '10',
        active: true,
      })
      .expect(201);

    expect(created.body.data.code).toBe('SUMMER10');
    expect(created.body.data.type).toBe('PERCENTAGE');
    expect(created.body.data.value).toBe('10.00');
    summerCouponId = created.body.data.id;

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/coupons`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);
    expect(
      listed.body.data.items.some((c: { code: string }) => c.code === 'SUMMER10'),
    ).toBe(true);

    const got = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/coupons/${summerCouponId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);
    expect(got.body.data.code).toBe('SUMMER10');

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/coupons/${summerCouponId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ maximumDiscountAmount: '50.00' })
      .expect(200);
    expect(updated.body.data.maximumDiscountAmount).toBe('50.00');
  });

  it('allows staff to read coupons but not write', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/coupons`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/coupons/${summerCouponId}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/coupons`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        code: `STAFF${suffix}`.slice(0, 16),
        type: 'PERCENTAGE',
        value: '5',
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/coupons/${summerCouponId}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ active: false })
      .expect(403);
  });

  it('validates coupons publicly against catalog items', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/coupons/validate`)
      .send({
        code: 'summer10',
        items: [{ productId, quantity: 1 }],
      })
      .expect(200);

    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.code).toBe('SUMMER10');
    expect(res.body.data.subtotal).toBe('100.00');
    expect(res.body.data.discount).toBe('10.00');
    expect(res.body.data.finalSubtotal).toBe('90.00');
  });

  it('applies coupon at checkout, records usage, and computes grand total', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p14-apply-${suffix}`)
      .send(
        checkoutBody({
          couponCode: 'SUMMER10',
          shippingMethodId: flatShippingId,
          customer: {
            name: 'Coupon Guest',
            email: `guest.apply.${suffix}@example.com`,
            phone: '+15551414',
          },
        }),
      )
      .expect(201);

    // grandTotal = subtotal - discount + shipping = 100 - 10 + 5
    expect(res.body.data.subtotal).toBe('100.00');
    expect(res.body.data.discountTotal).toBe('10.00');
    expect(res.body.data.shippingTotal).toBe('5.00');
    expect(res.body.data.total).toBe('95.00');
    expect(res.body.data.couponCode).toBe('SUMMER10');

    const order = await prisma.order.findFirstOrThrow({
      where: { publicReference: res.body.data.publicReference },
    });
    expect(order.couponCode).toBe('SUMMER10');
    expect(Number(order.discountTotal)).toBe(10);

    const usage = await prisma.couponUsage.findFirst({
      where: { orderId: order.id },
    });
    expect(usage).toBeTruthy();
    expect(usage?.couponId).toBe(summerCouponId);

    const coupon = await prisma.coupon.findUniqueOrThrow({
      where: { id: summerCouponId },
    });
    expect(coupon.usageCount).toBeGreaterThanOrEqual(1);
  });

  it('rejects client-sent discountTotal on public checkout', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p14-forbid-discount-${suffix}`)
      .send(
        checkoutBody({
          discountTotal: '99.00',
          customer: {
            name: 'Coupon Guest',
            email: `guest.forbid.${suffix}@example.com`,
            phone: '+15551414',
          },
        }),
      );
    expect(res.status).toBe(400);
  });

  it('rejects expired and inactive coupons', async () => {
    const expired = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/coupons`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        code: `EXPIRED${suffix}`.slice(0, 20),
        type: 'PERCENTAGE',
        value: '10',
        active: true,
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p14-expired-${suffix}`)
      .send(
        checkoutBody({
          couponCode: expired.body.data.code,
          customer: {
            name: 'Coupon Guest',
            email: `guest.expired.${suffix}@example.com`,
            phone: '+15551414',
          },
        }),
      )
      .expect(422);

    const inactive = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/coupons`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        code: `INACTIVE${suffix}`.slice(0, 20),
        type: 'FIXED_AMOUNT',
        value: '5',
        active: false,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p14-inactive-${suffix}`)
      .send(
        checkoutBody({
          couponCode: inactive.body.data.code,
          customer: {
            name: 'Coupon Guest',
            email: `guest.inactive.${suffix}@example.com`,
            phone: '+15551414',
          },
        }),
      )
      .expect(422);
  });

  it('enforces usageLimit=1 under concurrent checkouts', async () => {
    const limited = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/coupons`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        code: `ONCE${suffix}`.slice(0, 16),
        type: 'PERCENTAGE',
        value: '10',
        active: true,
        usageLimit: 1,
      })
      .expect(201);
    const code = limited.body.data.code as string;

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/public/stores/${storeSlug}/checkout`)
        .set('Idempotency-Key', `p14-once-a-${suffix}`)
        .send(
          checkoutBody({
            couponCode: code,
            customer: {
              name: 'Once A',
              email: `guest.once.a.${suffix}@example.com`,
              phone: '+15551401',
            },
          }),
        ),
      request(app.getHttpServer())
        .post(`/api/v1/public/stores/${storeSlug}/checkout`)
        .set('Idempotency-Key', `p14-once-b-${suffix}`)
        .send(
          checkoutBody({
            couponCode: code,
            customer: {
              name: 'Once B',
              email: `guest.once.b.${suffix}@example.com`,
              phone: '+15551402',
            },
          }),
        ),
    ]);

    const statuses = [a.status, b.status].sort();
    const withCoupon = [a, b].filter(
      (r) => r.status === 201 && r.body.data?.couponCode === code,
    );
    const rejected = [a, b].filter((r) => r.status === 422);

    expect(withCoupon).toHaveLength(1);
    expect(rejected.length + withCoupon.length).toBe(2);
    expect(statuses.includes(201)).toBe(true);
    expect(statuses.includes(422) || rejected.length === 1).toBe(true);

    const coupon = await prisma.coupon.findUniqueOrThrow({
      where: { id: limited.body.data.id },
    });
    expect(coupon.usageCount).toBe(1);
  });

  it('rejects cross-store coupon codes', async () => {
    const otherCoupon = await request(app.getHttpServer())
      .post(`/api/v1/stores/${otherStoreId}/coupons`)
      .set('Authorization', `Bearer ${otherManager.token}`)
      .send({
        code: `OTHER${suffix}`.slice(0, 16),
        type: 'PERCENTAGE',
        value: '15',
        active: true,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p14-cross-${suffix}`)
      .send(
        checkoutBody({
          couponCode: otherCoupon.body.data.code,
          customer: {
            name: 'Coupon Guest',
            email: `guest.cross.${suffix}@example.com`,
            phone: '+15551414',
          },
        }),
      )
      .expect(422);

    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/coupons/validate`)
      .send({
        code: otherCoupon.body.data.code,
        items: [{ productId, quantity: 1 }],
      })
      .expect(422);
  });
});
