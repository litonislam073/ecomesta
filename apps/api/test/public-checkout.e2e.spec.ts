import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { ProductStatus, StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Public checkout (e2e)', () => {
  jest.setTimeout(60_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const manager = {
    email: `phase10.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const managerB = {
    email: `phase10.b.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeId = '';
  const storeSlug = `chk-store-${suffix}`;
  let otherStoreId = '';
  const otherStoreSlug = `chk-other-${suffix}`;
  let productId = '';
  let otherProductId = '';
  let limitedProductId = '';
  let draftProductId = '';
  let freeShippingId = '';
  let flatShippingId = '';
  let otherStoreShippingId = '';
  let inactiveShippingId = '';

  const customer = {
    name: 'Checkout Guest',
    email: `guest.chk.${suffix}@example.com`,
    phone: '+15551212',
  };

  const shippingAddress = {
    name: 'Checkout Guest',
    phone: '+15551212',
    addressLine1: '100 Market St',
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
      customer,
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

    for (const user of [manager, managerB]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Ten',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        businessName: 'Checkout Tenant',
        tenantSlug: `chk-tenant-${suffix}`,
        storeName: 'Checkout Store',
        storeSlug,
      })
      .expect(201);
    storeId = onboard.body.data.store.id;

    const onboardB = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({
        businessName: 'Other Checkout Tenant',
        tenantSlug: `chk-tenant-b-${suffix}`,
        storeName: 'Other Checkout Store',
        storeSlug: otherStoreSlug,
      })
      .expect(201);
    otherStoreId = onboardB.body.data.store.id;

    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });
    await prisma.store.update({
      where: { id: otherStoreId },
      data: { status: StoreStatus.ACTIVE },
    });

    const product = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Checkout Widget',
        slug: `chk-widget-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '19.99',
        trackInventory: true,
        allowBackorder: false,
        sku: `CHK-${suffix}`,
      })
      .expect(201);
    productId = product.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/inventory/adjust`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        productId,
        quantity: 20,
        type: 'ADJUSTMENT',
        note: 'Stock for checkout tests',
      })
      .expect(201);

    const limited = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Limited Stock',
        slug: `chk-limited-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '10.00',
        trackInventory: true,
        allowBackorder: false,
      })
      .expect(201);
    limitedProductId = limited.body.data.id;
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/inventory/adjust`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        productId: limitedProductId,
        quantity: 1,
        type: 'ADJUSTMENT',
        note: 'Single unit',
      })
      .expect(201);

    const draft = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Draft Only',
        slug: `chk-draft-${suffix}`,
        status: 'DRAFT',
        productType: 'PHYSICAL',
        basePrice: '5.00',
        trackInventory: false,
      })
      .expect(201);
    draftProductId = draft.body.data.id;

    const otherProduct = await request(app.getHttpServer())
      .post(`/api/v1/stores/${otherStoreId}/products`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({
        name: 'Other Store Product',
        slug: `chk-other-prod-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '8.00',
        trackInventory: false,
      })
      .expect(201);
    otherProductId = otherProduct.body.data.id;

    const freeShip = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Free Shipping', type: 'FREE', price: '0', active: true })
      .expect(201);
    freeShippingId = freeShip.body.data.id;

    const flatShip = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Flat Rate', type: 'FLAT', price: '5.00', active: true })
      .expect(201);
    flatShippingId = flatShip.body.data.id;

    const inactiveShip = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Inactive', type: 'FLAT', price: '9.00', active: false })
      .expect(201);
    inactiveShippingId = inactiveShip.body.data.id;

    const otherShip = await request(app.getHttpServer())
      .post(`/api/v1/stores/${otherStoreId}/shipping-methods`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ name: 'Other Flat', type: 'FLAT', price: '3.00', active: true })
      .expect(201);
    otherStoreShippingId = otherShip.body.data.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('places a guest checkout order with server pricing and snapshots', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `success-${suffix}`)
      .send(
        checkoutBody({
          items: [{ productId, quantity: 2 }],
        }),
      )
      .expect(201);

    expect(res.body.data.orderNumber).toMatch(/^EM-\d+$/);
    expect(res.body.data.publicReference).toBeTruthy();
    expect(res.body.data.paymentStatus).toBe('PENDING');
    expect(res.body.data.subtotal).toBe('39.98');
    expect(res.body.data.shippingTotal).toBe('0.00');
    expect(res.body.data.shippingMethodName).toBe('Free Shipping');
    expect(res.body.data.total).toBe('39.98');
    expect(res.body.data).not.toHaveProperty('internalNote');
    expect(res.body.data).not.toHaveProperty('tenantId');

    const order = await prisma.order.findFirst({
      where: { publicReference: res.body.data.publicReference },
      include: { items: true, addresses: true, payments: true },
    });
    expect(order?.items[0]?.productName).toBe('Checkout Widget');
    expect(order?.items[0]?.unitPrice.toString()).toBe('19.99');
    expect(order?.shippingMethodName).toBe('Free Shipping');
    expect(order?.shippingMethodType).toBe('FREE');
    expect(order?.addresses).toHaveLength(2);
    expect(order?.payments[0]?.status).toBe('PENDING');
    expect(order?.payments[0]?.provider).toBe('COD');
  });

  it('applies flat-rate shipping from server method price, not client amounts', async () => {
    const forbidden = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `fake-totals-${suffix}`)
      .send(
        checkoutBody({
          shippingMethodId: flatShippingId,
          shippingTotal: '999.00',
          grandTotal: '1.00',
        }),
      );
    expect(forbidden.status).toBe(400);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `flat-${suffix}`)
      .send(
        checkoutBody({
          shippingMethodId: flatShippingId,
        }),
      )
      .expect(201);

    expect(res.body.data.shippingTotal).toBe('5.00');
    expect(res.body.data.shippingMethodName).toBe('Flat Rate');
    expect(res.body.data.total).toBe('24.99');
  });

  it('rejects inactive or cross-store shipping methods', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `inactive-ship-${suffix}`)
      .send(checkoutBody({ shippingMethodId: inactiveShippingId }))
      .expect(422);

    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `cross-ship-${suffix}`)
      .send(checkoutBody({ shippingMethodId: otherStoreShippingId }))
      .expect(404);
  });

  it('lists only active public shipping methods', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/shipping-methods`)
      .expect(200);
    const ids = res.body.data.map((m: { id: string }) => m.id);
    expect(ids).toContain(freeShippingId);
    expect(ids).toContain(flatShippingId);
    expect(ids).not.toContain(inactiveShippingId);
    expect(res.body.data[0]).not.toHaveProperty('configuration');
    expect(res.body.data[0]).not.toHaveProperty('storeId');
  });

  it('ignores client totals and uses current DB price after merchant change', async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { basePrice: '25.00' },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `price-change-${suffix}`)
      .send(
        checkoutBody({
          items: [{ productId, quantity: 1 }],
          // forbidden client money fields should be stripped by whitelist
          grandTotal: '1.00',
          unitPrice: '1.00',
        }),
      );

    // forbidNonWhitelisted → 400 if those fields present
    if (res.status === 400) {
      const clean = await request(app.getHttpServer())
        .post(`/api/v1/public/stores/${storeSlug}/checkout`)
        .set('Idempotency-Key', `price-change-clean-${suffix}`)
        .send(checkoutBody({ items: [{ productId, quantity: 1 }] }))
        .expect(201);
      expect(clean.body.data.total).toBe('25.00');
      const item = await prisma.orderItem.findFirst({
        where: { order: { publicReference: clean.body.data.publicReference } },
      });
      expect(item?.unitPrice.toFixed(2)).toBe('25.00');
    } else {
      expect(res.status).toBe(201);
      expect(res.body.data.total).toBe('25.00');
    }
  });

  it('rejects insufficient stock without creating an order', async () => {
    const before = await prisma.order.count({ where: { storeId } });
    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `oos-${suffix}`)
      .send(
        checkoutBody({
          items: [{ productId: limitedProductId, quantity: 2 }],
        }),
      )
      .expect(422);
    const after = await prisma.order.count({ where: { storeId } });
    expect(after).toBe(before);
  });

  it('allows only one concurrent checkout for the last unit', async () => {
    const results = await Promise.allSettled([
      request(app.getHttpServer())
        .post(`/api/v1/public/stores/${storeSlug}/checkout`)
        .set('Idempotency-Key', `race-a-${suffix}`)
        .send(
          checkoutBody({
            items: [{ productId: limitedProductId, quantity: 1 }],
          }),
        ),
      request(app.getHttpServer())
        .post(`/api/v1/public/stores/${storeSlug}/checkout`)
        .set('Idempotency-Key', `race-b-${suffix}`)
        .send(
          checkoutBody({
            items: [{ productId: limitedProductId, quantity: 1 }],
          }),
        ),
    ]);

    const statuses = results.map((r) =>
      r.status === 'fulfilled' ? r.value.status : 0,
    );
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 422)).toHaveLength(1);

    const inv = await prisma.inventoryItem.findFirst({
      where: { storeId, productId: limitedProductId, variantId: null },
    });
    expect(inv?.quantity).toBe(0);
  });

  it('replays identical idempotency keys as a single order', async () => {
    const key = `idem-${suffix}`;
    const first = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', key)
      .send(checkoutBody({ items: [{ productId, quantity: 1 }] }))
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', key)
      .send(checkoutBody({ items: [{ productId, quantity: 1 }] }))
      .expect(201);

    expect(second.body.data.publicReference).toBe(first.body.data.publicReference);
    expect(second.body.meta.replayed).toBe(true);

    const count = await prisma.order.count({
      where: { storeId, idempotencyKey: key },
    });
    expect(count).toBe(1);
  });

  it('resolves concurrent duplicate idempotency requests to one order', async () => {
    const key = `idem-race-${suffix}`;
    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/public/stores/${storeSlug}/checkout`)
        .set('Idempotency-Key', key)
        .send(checkoutBody({ items: [{ productId, quantity: 1 }] })),
      request(app.getHttpServer())
        .post(`/api/v1/public/stores/${storeSlug}/checkout`)
        .set('Idempotency-Key', key)
        .send(checkoutBody({ items: [{ productId, quantity: 1 }] })),
    ]);

    expect([a.status, b.status].every((s) => s === 201)).toBe(true);
    expect(a.body.data.publicReference).toBe(b.body.data.publicReference);
    const count = await prisma.order.count({
      where: { storeId, idempotencyKey: key },
    });
    expect(count).toBe(1);
  });

  it('rejects cross-store products, draft products, and inactive stores', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `cross-${suffix}`)
      .send(checkoutBody({ items: [{ productId: otherProductId, quantity: 1 }] }))
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `draft-${suffix}`)
      .send(checkoutBody({ items: [{ productId: draftProductId, quantity: 1 }] }))
      .expect(422);

    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.INACTIVE },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `inactive-${suffix}`)
      .send(checkoutBody())
      .expect(404);
    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });
  });

  it('rejects negative/huge quantity and missing idempotency key', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .send(checkoutBody())
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `neg-${suffix}`)
      .send(checkoutBody({ items: [{ productId, quantity: 0 }] }))
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `huge-${suffix}`)
      .send(checkoutBody({ items: [{ productId, quantity: 101 }] }))
      .expect(400);
  });

  it('looks up orders by public reference and hides sequential order numbers', async () => {
    const placed = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `lookup-${suffix}`)
      .send(checkoutBody({ items: [{ productId, quantity: 1 }] }))
      .expect(201);

    const ok = await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/orders/${placed.body.data.publicReference}?email=${encodeURIComponent(customer.email)}`,
      )
      .expect(200);
    expect(ok.body.data.orderNumber).toBe(placed.body.data.orderNumber);
    expect(ok.body.data.items[0].productName).toBeTruthy();
    expect(JSON.stringify(ok.body)).not.toMatch(/internalNote|tenantId|password/);

    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/orders/${placed.body.data.orderNumber}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/orders/${placed.body.data.publicReference}?email=wrong@example.com`,
      )
      .expect(404);
  });

  it('rejects archived products after status change', async () => {
    const keys = await redis.getClient().keys('rl:checkout:*');
    if (keys.length > 0) {
      await redis.getClient().del(...keys);
    }
    await prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.ARCHIVED },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `archived-${suffix}`)
      .send(checkoutBody({ items: [{ productId, quantity: 1 }] }))
      .expect(422);
    await prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.ACTIVE },
    });
  });

  it('rate limits aggressive checkout traffic', async () => {
    const keys = await redis.getClient().keys('rl:checkout:*');
    if (keys.length > 0) {
      await redis.getClient().del(...keys);
    }

    const attempts = Array.from({ length: 35 }, (_, i) =>
      request(app.getHttpServer())
        .post(`/api/v1/public/stores/${storeSlug}/checkout`)
        .set('Idempotency-Key', `rl-${suffix}-${i}`)
        .send(
          checkoutBody({
            items: [{ productId: draftProductId, quantity: 1 }],
          }),
        ),
    );
    const responses = await Promise.all(attempts);
    expect(responses.some((r) => r.status === 429)).toBe(true);
  });
});
