import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

/**
 * SF-03: checkout must show the server's current prices, never the cart's
 * stored snapshot, and an order is never placed at a total the customer did
 * not see. POST /checkout/quote is read-only; POST /checkout refuses a stale
 * expectedTotal with 409 CHECKOUT_TOTAL_CHANGED and writes nothing.
 */
describe('SF-03 checkout shows current server pricing (e2e)', () => {
  jest.setTimeout(180_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  type Store = {
    key: string;
    token: string;
    id: string;
    slug: string;
    productId: string;
    otherId: string;
    variantProductId: string;
    variantAId: string;
    variantBId: string;
    flatId: string;
    thresholdId: string;
  };
  const blank = (key: string): Store => ({
    key,
    token: '',
    id: '',
    slug: `sf03-${key}-${suffix}`,
    productId: '',
    otherId: '',
    variantProductId: '',
    variantAId: '',
    variantBId: '',
    flatId: '',
    thresholdId: '',
  });
  const A = blank('a');
  const B = blank('b');
  let n = 0;

  const http = () => request(app.getHttpServer());
  const auth = (s: Store) => ({ Authorization: `Bearer ${s.token}` });
  const email = `sf03.buyer.${suffix}@example.com`;

  async function resetBusinessLimits() {
    const keys = await redis.getClient().keys('rl:*');
    if (keys.length > 0) await redis.getClient().del(...keys);
  }

  async function quote(s: Store, body: Record<string, unknown>) {
    await resetBusinessLimits();
    return http().post(`/api/v1/public/stores/${s.slug}/checkout/quote`).send(body);
  }

  async function checkout(s: Store, body: Record<string, unknown>, idempotencyKey?: string) {
    await resetBusinessLimits();
    n += 1;
    return http()
      .post(`/api/v1/public/stores/${s.slug}/checkout`)
      .set('Idempotency-Key', idempotencyKey ?? `sf03-${n}-${suffix}`)
      .send({
        customer: { name: 'SF03 Buyer', email, phone: '01711000000' },
        shippingAddress: { name: 'SF03 Buyer', addressLine1: '1 Main', city: 'Dhaka', country: 'BD', email },
        billingSameAsShipping: true,
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
        ...body,
      });
  }

  const setBasePrice = (s: Store, productId: string, basePrice: string) =>
    http().patch(`/api/v1/stores/${s.id}/products/${productId}`).set(auth(s)).send({ basePrice }).expect(200);
  const setVariantPrice = (s: Store, variantId: string, price: string) =>
    http()
      .patch(`/api/v1/stores/${s.id}/products/${s.variantProductId}/variants/${variantId}`)
      .set(auth(s))
      .send({ price })
      .expect(200);

  async function product(s: Store, name: string, basePrice: string, stock: number | null, extra: Record<string, unknown> = {}) {
    const id = (
      await http()
        .post(`/api/v1/stores/${s.id}/products`)
        .set(auth(s))
        .send({
          name,
          slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${s.key}-${suffix}`,
          status: 'ACTIVE',
          productType: 'PHYSICAL',
          basePrice,
          trackInventory: stock !== null,
          ...extra,
        })
        .expect(201)
    ).body.data.id as string;
    if (stock !== null) {
      await http()
        .post(`/api/v1/stores/${s.id}/inventory/adjust`)
        .set(auth(s))
        .send({ productId: id, quantity: stock, type: 'ADJUSTMENT' })
        .expect(201);
    }
    return id;
  }

  async function variant(s: Store, productId: string, name: string, price: string, stock: number) {
    const id = (
      await http().post(`/api/v1/stores/${s.id}/products/${productId}/variants`).set(auth(s)).send({ name, price }).expect(201)
    ).body.data.id as string;
    await http()
      .post(`/api/v1/stores/${s.id}/inventory/adjust`)
      .set(auth(s))
      .send({ productId, variantId: id, quantity: stock, type: 'ADJUSTMENT' })
      .expect(201);
    return id;
  }

  async function coupon(s: Store, code: string, extra: Record<string, unknown> = {}) {
    return (
      await http()
        .post(`/api/v1/stores/${s.id}/coupons`)
        .set(auth(s))
        .send({ code, type: 'PERCENTAGE', value: '10', active: true, ...extra })
        .expect(201)
    ).body.data.id as string;
  }

  const stockOf = async (productId: string) =>
    (await prisma.inventoryItem.findFirstOrThrow({ where: { productId, variantId: null } })).quantity;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 60 }) })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await resetBusinessLimits();
    const authKeys = await redis.getClient().keys('auth:rl:*');
    if (authKeys.length > 0) await redis.getClient().del(...authKeys);

    for (const s of [A, B]) {
      const reg = await http()
        .post('/api/v1/auth/register')
        .send({ email: `sf03.${s.key}.${suffix}@example.com`, password: 'SecurePass1', firstName: 'S', lastName: 'F' })
        .expect(201);
      s.token = reg.body.data.accessToken;
      s.id = (
        await http()
          .post('/api/v1/onboarding/store')
          .set(auth(s))
          .send({ businessName: `SF03 ${s.key}`, tenantSlug: `${s.slug}-t`, storeName: `SF03 ${s.key}`, storeSlug: s.slug })
          .expect(201)
      ).body.data.store.id;
      await prisma.store.update({ where: { id: s.id }, data: { status: StoreStatus.ACTIVE } });

      // Same product names in both stores (isolation), different prices.
      s.productId = await product(s, 'Panjabi', s === A ? '500.00' : '900.00', 10);
      s.otherId = await product(s, 'Scarf', '200.00', 50);
      s.variantProductId = await product(s, 'Saree', '0.00', null, { trackInventory: true });
      s.variantAId = await variant(s, s.variantProductId, 'Red', '300.00', 20);
      s.variantBId = await variant(s, s.variantProductId, 'Blue', '350.00', 20);

      s.flatId = (
        await http()
          .post(`/api/v1/stores/${s.id}/shipping-methods`)
          .set(auth(s))
          .send({ name: 'Flat', type: 'FLAT', price: '60.00', active: true, sortOrder: 0 })
          .expect(201)
      ).body.data.id;
      s.thresholdId = (
        await http()
          .post(`/api/v1/stores/${s.id}/shipping-methods`)
          .set(auth(s))
          .send({ name: 'Free over 1500', type: 'FLAT', price: '100.00', freeShippingThreshold: '1500.00', active: true, sortOrder: 1 })
          .expect(201)
      ).body.data.id;
    }
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  it('A — returns the current price, not the price the cart was filled at', async () => {
    const productId = await product(A, 'Stale Kurta', '500.00', 10);
    const before = await quote(A, { items: [{ productId, quantity: 2 }] });
    expect(before.status).toBe(200);
    expect(before.body.data.lines[0]).toMatchObject({ productId, unitPrice: '500.00', lineTotal: '1000.00', quantity: 2 });
    expect(before.body.data.subtotal).toBe('1000.00');

    // Customer's cart still holds 500.00; merchant raises the price.
    await setBasePrice(A, productId, '600.00');

    const after = await quote(A, { items: [{ productId, quantity: 2 }] });
    expect(after.status).toBe(200);
    expect(after.body.data.lines[0]).toMatchObject({ unitPrice: '600.00', lineTotal: '1200.00' });
    expect(after.body.data.subtotal).toBe('1200.00');
    expect(after.body.data.currency).toBe('BDT');

    // The browser cannot supply a price at all.
    const forged = await quote(A, { items: [{ productId, quantity: 2, unitPrice: '1.00' }] });
    expect(forged.status).toBe(400);
  });

  it('B — with several lines, only the changed product/variant updates', async () => {
    const items = [
      { productId: A.productId, quantity: 1 },
      { productId: A.otherId, quantity: 3 },
      { productId: A.variantProductId, variantId: A.variantAId, quantity: 2 },
      { productId: A.variantProductId, variantId: A.variantBId, quantity: 1 },
    ];
    const before = await quote(A, { items });
    expect(before.status).toBe(200);
    expect(before.body.data.lines.map((l: { unitPrice: string }) => l.unitPrice)).toEqual(['500.00', '200.00', '300.00', '350.00']);
    expect(before.body.data.subtotal).toBe('2050.00'); // 500 + 600 + 600 + 350

    await setVariantPrice(A, A.variantAId, '320.00');

    const after = await quote(A, { items });
    const lines = after.body.data.lines as { variantName: string | null; unitPrice: string; lineTotal: string }[];
    expect(lines.map((l) => l.unitPrice)).toEqual(['500.00', '200.00', '320.00', '350.00']);
    expect(lines[2]).toMatchObject({ variantName: 'Red', lineTotal: '640.00' });
    expect(after.body.data.subtotal).toBe('2090.00');

    await setVariantPrice(A, A.variantAId, '300.00');
  });

  it('C — prices current price × requested quantity and rejects bad or over-stock quantities', async () => {
    const res = await quote(A, { items: [{ productId: A.otherId, quantity: 7 }] });
    expect(res.body.data.lines[0].lineTotal).toBe('1400.00');

    for (const quantity of [0, -1, 1.5, 101]) {
      expect((await quote(A, { items: [{ productId: A.otherId, quantity }] })).status).toBe(400);
    }

    const over = await quote(A, { items: [{ productId: A.productId, quantity: 11 }] });
    expect(over.status).toBe(422);
    expect(over.body.error).toEqual({ code: 'INSUFFICIENT_STOCK', message: 'Insufficient stock for Panjabi. Available: 10, requested: 11' });

    // Split lines for the same product are summed, like placement does.
    const split = await quote(A, {
      items: [
        { productId: A.productId, quantity: 6 },
        { productId: A.productId, quantity: 5 },
      ],
    });
    expect(split.status).toBe(422);
    expect(split.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('D — shipping comes from the server quote for the current subtotal, never from the client', async () => {
    const productId = await product(A, 'Threshold Shirt', '700.00', 10);
    const items = [{ productId, quantity: 2 }];

    const below = await quote(A, { items, shippingMethodId: A.thresholdId });
    expect(below.body.data.shippingMethodId).toBe(A.thresholdId);
    expect(below.body.data.shippingTotal).toBe('100.00');
    expect(below.body.data.total).toBe('1500.00'); // 1400 + 100

    // A price increase pushes the subtotal over the free-shipping threshold.
    await setBasePrice(A, productId, '800.00');
    const above = await quote(A, { items, shippingMethodId: A.thresholdId });
    expect(above.body.data.subtotal).toBe('1600.00');
    expect(above.body.data.shippingTotal).toBe('0.00');
    expect(above.body.data.total).toBe('1600.00');
    const method = above.body.data.shippingMethods.find((m: { id: string }) => m.id === A.thresholdId);
    expect(method).toMatchObject({ amount: '0.00', freeShippingApplied: true });

    // Default selection is the first method; unknown / other-store ids fall back to it.
    expect((await quote(A, { items })).body.data.shippingMethodId).toBe(A.flatId);
    expect((await quote(A, { items, shippingMethodId: B.flatId })).body.data.shippingMethodId).toBe(A.flatId);

    expect((await quote(A, { items, shippingTotal: '0.00' })).status).toBe(400);

    const order = await checkout(A, { items, shippingMethodId: A.thresholdId, expectedTotal: '1600.00' });
    expect(order.status).toBe(201);
    expect(order.body.data).toMatchObject({ shippingTotal: '0.00', total: '1600.00' });
  });

  it('D — a zone rate shown at checkout is the rate the order is charged', async () => {
    const division = await prisma.bdDivision.findUniqueOrThrow({ where: { code: 'DHAKA' } });
    const district = await prisma.bdDistrict.findUniqueOrThrow({ where: { code: 'DHAKA_DHAKA' } });
    const upazila = await prisma.bdUpazila.findFirstOrThrow({ where: { districtId: district.id } });
    const zoneId = (
      await http()
        .post(`/api/v1/stores/${A.id}/shipping-zones`)
        .set(auth(A))
        .send({ name: 'SF03 Dhaka', priority: 50, active: true, locations: [{ districtId: district.id }] })
        .expect(201)
    ).body.data.id;
    const zoneMethodId = (
      await http()
        .post(`/api/v1/stores/${A.id}/shipping-methods`)
        .set(auth(A))
        .send({ name: 'Dhaka courier', type: 'FLAT', price: '80.00', zoneId, active: true })
        .expect(201)
    ).body.data.id;

    const location = { divisionId: division.id, districtId: district.id, upazilaId: upazila.id };
    const items = [{ productId: A.otherId, quantity: 1 }];
    const q = await quote(A, { items, ...location });
    expect(q.body.data.zone.name).toBe('SF03 Dhaka');
    expect(q.body.data.shippingMethodId).toBe(zoneMethodId);
    expect(q.body.data).toMatchObject({ shippingTotal: '80.00', total: '280.00' });

    const order = await checkout(A, {
      items,
      shippingMethodId: zoneMethodId,
      shippingAddress: { name: 'SF03 Buyer', addressLine1: '1 Main', city: 'Dhaka', country: 'BD', email, ...location },
      expectedTotal: q.body.data.total,
    });
    expect(order.status).toBe(201);
    expect(order.body.data).toMatchObject({ shippingTotal: '80.00', total: '280.00' });

    await http().delete(`/api/v1/stores/${A.id}/shipping-zones/${zoneId}`).set(auth(A));
  });

  it('E — coupon discount is recalculated from the current subtotal; invalid coupons are reported, not applied', async () => {
    const productId = await product(A, 'Coupon Lehenga', '1000.00', 10);
    const code = `SF03TEN${suffix.slice(-5)}`;
    const couponId = await coupon(A, code);
    const items = [{ productId, quantity: 1 }];

    const before = await quote(A, { items, couponCode: code, shippingMethodId: A.flatId, email });
    expect(before.body.data).toMatchObject({ couponCode: code, couponError: null, discountTotal: '100.00', total: '960.00' });

    await setBasePrice(A, productId, '1200.00');
    const after = await quote(A, { items, couponCode: code, shippingMethodId: A.flatId, email });
    expect(after.body.data).toMatchObject({ subtotal: '1200.00', discountTotal: '120.00', total: '1140.00' });

    // A client discount is not an accepted input.
    expect((await quote(A, { items, couponCode: code, discountTotal: '999.00' })).status).toBe(400);

    const expired = `SF03OLD${suffix.slice(-5)}`;
    await coupon(A, expired, { startsAt: '2020-01-01T00:00:00.000Z', expiresAt: '2020-02-01T00:00:00.000Z' });
    const inactive = `SF03OFF${suffix.slice(-5)}`;
    await coupon(A, inactive, { active: false });
    for (const bad of [expired, inactive, 'NOSUCHCODE']) {
      const res = await quote(A, { items, couponCode: bad, shippingMethodId: A.flatId });
      expect(res.status).toBe(200);
      expect(res.body.data.couponCode).toBeNull();
      expect(typeof res.body.data.couponError).toBe('string');
      expect(res.body.data).toMatchObject({ discountTotal: '0.00', total: '1260.00' });
    }

    // Quoting never consumes the coupon.
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: couponId } })).usageCount).toBe(0);

    const order = await checkout(A, { items, couponCode: code, shippingMethodId: A.flatId, expectedTotal: after.body.data.total });
    expect(order.status).toBe(201);
    expect(order.body.data).toMatchObject({ subtotal: '1200.00', discountTotal: '120.00', total: '1140.00' });
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: couponId } })).usageCount).toBe(1);
  });

  it('F — a stale quote is refused at order creation and nothing is written', async () => {
    const productId = await product(A, 'Race Sherwani', '500.00', 10);
    const code = `SF03RACE${suffix.slice(-5)}`;
    const couponId = await coupon(A, code);
    const items = [{ productId, quantity: 2 }];
    const body = { items, couponCode: code, shippingMethodId: A.flatId };

    const stale = await quote(A, { ...body, email });
    expect(stale.body.data.total).toBe('960.00'); // 1000 - 100 + 60

    await setBasePrice(A, productId, '600.00');

    const key = `sf03-stale-${suffix}`;
    const seqBefore = (await prisma.store.findUniqueOrThrow({ where: { id: A.id } })).orderSequence;
    const refused = await checkout(A, { ...body, expectedTotal: stale.body.data.total }, key);
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({
      success: false,
      error: {
        code: 'CHECKOUT_TOTAL_CHANGED',
        message: 'Prices or shipping changed since you reviewed your order. Please check the updated total and place your order again.',
      },
    });

    expect(await prisma.order.count({ where: { storeId: A.id, idempotencyKey: key } })).toBe(0);
    expect(await prisma.orderItem.count({ where: { productId } })).toBe(0);
    expect(await stockOf(productId)).toBe(10);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: couponId } })).usageCount).toBe(0);
    expect((await prisma.store.findUniqueOrThrow({ where: { id: A.id } })).orderSequence).toBe(seqBefore);

    // The UI re-quotes and the customer confirms the new total with the same key.
    const fresh = await quote(A, { ...body, email });
    expect(fresh.body.data.total).toBe('1140.00'); // 1200 - 120 + 60
    const placed = await checkout(A, { ...body, expectedTotal: fresh.body.data.total }, key);
    expect(placed.status).toBe(201);
    expect(placed.body.data).toMatchObject({ subtotal: '1200.00', discountTotal: '120.00', shippingTotal: '60.00', total: '1140.00' });
    const order = await prisma.order.findFirstOrThrow({ where: { publicReference: placed.body.data.publicReference }, include: { items: true, payments: true } });
    expect(order.items[0]?.unitPrice.toString()).toBe('600');
    expect(order.payments[0]?.amount.toString()).toBe('1140');
    expect(await stockOf(productId)).toBe(8);

    // Without expectedTotal the server still prices from the database (API compatibility).
    const legacy = await checkout(A, { items: [{ productId, quantity: 1 }], shippingMethodId: A.flatId });
    expect(legacy.status).toBe(201);
    expect(legacy.body.data.total).toBe('660.00');

    // Malformed expectedTotal is a validation error, not a price.
    expect((await checkout(A, { ...body, expectedTotal: '-5' })).status).toBe(400);
    expect((await checkout(A, { ...body, expectedTotal: 'abc' })).status).toBe(400);
  });

  it('G — a quote never reads another store’s products, coupons or shipping', async () => {
    // Store B's product through store A.
    const crossProduct = await quote(A, { items: [{ productId: B.productId, quantity: 1 }] });
    expect(crossProduct.status).toBe(404);
    const crossVariant = await quote(A, { items: [{ productId: A.variantProductId, variantId: B.variantAId, quantity: 1 }] });
    expect(crossVariant.status).toBe(404);

    // Same coupon code in both stores with different rules: each store uses its own.
    const code = `SF03SAME${suffix.slice(-5)}`;
    await coupon(A, code, { value: '10' });
    await coupon(B, code, { value: '50' });
    const inA = await quote(A, { items: [{ productId: A.productId, quantity: 1 }], couponCode: code });
    const inB = await quote(B, { items: [{ productId: B.productId, quantity: 1 }], couponCode: code });
    expect(inA.body.data).toMatchObject({ subtotal: '500.00', discountTotal: '50.00' });
    expect(inB.body.data).toMatchObject({ subtotal: '900.00', discountTotal: '450.00' });

    const onlyInB = `SF03BONLY${suffix.slice(-5)}`;
    await coupon(B, onlyInB);
    const leaked = await quote(A, { items: [{ productId: A.productId, quantity: 1 }], couponCode: onlyInB });
    expect(leaked.body.data).toMatchObject({ couponCode: null, discountTotal: '0.00' });

    const methodIds = inA.body.data.shippingMethods.map((m: { id: string }) => m.id);
    expect(methodIds).toEqual(expect.arrayContaining([A.flatId, A.thresholdId]));
    expect(methodIds).not.toContain(B.flatId);
    expect(methodIds).not.toContain(B.thresholdId);
  });

  it('reports unavailable catalog items and stores without leaking internals', async () => {
    const archived = await product(A, 'Archived Fatua', '100.00', 5);
    await http().delete(`/api/v1/stores/${A.id}/products/${archived}`).set(auth(A)).expect(200);
    const draft = await product(A, 'Draft Fatua', '100.00', 5);
    await http().patch(`/api/v1/stores/${A.id}/products/${draft}`).set(auth(A)).send({ status: 'DRAFT' }).expect(200);

    const cases: [Record<string, unknown>, number][] = [
      [{ productId: archived, quantity: 1 }, 422],
      [{ productId: draft, quantity: 1 }, 422],
      [{ productId: '00000000-0000-4000-8000-000000000000', quantity: 1 }, 404],
      [{ productId: A.variantProductId, quantity: 1 }, 400], // variant required
      [{ productId: A.variantProductId, variantId: '00000000-0000-4000-8000-000000000000', quantity: 1 }, 404],
    ];
    for (const [item, status] of cases) {
      const res = await quote(A, { items: [item] });
      expect(res.status).toBe(status);
      expect(Object.keys(res.body.error).sort()).toEqual(['code', 'message']);
      expect(JSON.stringify(res.body)).not.toMatch(/prisma|stack|at \w+ \(/i);
    }

    // Variant switched off after it was added to the cart.
    const soloProduct = await product(A, 'Solo Kameez', '0.00', null, { trackInventory: true });
    const soloVariant = await variant(A, soloProduct, 'Only', '450.00', 5);
    await http().patch(`/api/v1/stores/${A.id}/products/${soloProduct}/variants/${soloVariant}`).set(auth(A)).send({ status: 'DRAFT' }).expect(200);
    const inactiveVariant = await quote(A, { items: [{ productId: soloProduct, variantId: soloVariant, quantity: 1 }] });
    expect(inactiveVariant.status).toBe(422);
    expect(inactiveVariant.body.error.message).toBe('Variant for "Solo Kameez" is not available');

    // Variant deleted: the product now has none, but the cart still names it.
    // (Removed directly: the merchant delete endpoint refuses variants with stock history.)
    await prisma.$transaction([
      prisma.inventoryMovement.deleteMany({ where: { variantId: soloVariant } }),
      prisma.inventoryItem.deleteMany({ where: { variantId: soloVariant } }),
      prisma.productVariant.delete({ where: { id: soloVariant } }),
    ]);
    const removedVariant = await quote(A, { items: [{ productId: soloProduct, variantId: soloVariant, quantity: 1 }] });
    expect(removedVariant.status).toBe(422);
    expect(removedVariant.body.error.message).toBe('The selected option for "Solo Kameez" is no longer available');

    await prisma.store.update({ where: { id: B.id }, data: { status: StoreStatus.SUSPENDED } });
    try {
      const suspended = await quote(B, { items: [{ productId: B.productId, quantity: 1 }] });
      expect(suspended.status).toBe(403);
      expect(Object.keys(suspended.body.error).sort()).toEqual(['code', 'message']);
    } finally {
      await prisma.store.update({ where: { id: B.id }, data: { status: StoreStatus.ACTIVE } });
    }
  });

  it('quoting is read-only: no orders, stock movements, coupon usage or payments', async () => {
    const productId = await product(A, 'Readonly Tupi', '150.00', 4);
    const code = `SF03RO${suffix.slice(-5)}`;
    const couponId = await coupon(A, code);
    const counts = async () => ({
      orders: await prisma.order.count({ where: { storeId: A.id } }),
      payments: await prisma.payment.count({ where: { storeId: A.id } }),
      movements: await prisma.inventoryMovement.count({ where: { productId } }),
      stock: await stockOf(productId),
      usage: (await prisma.coupon.findUniqueOrThrow({ where: { id: couponId } })).usageCount,
    });
    const before = await counts();
    for (let i = 0; i < 5; i += 1) {
      expect((await quote(A, { items: [{ productId, quantity: 4 }], couponCode: code, email })).status).toBe(200);
    }
    expect(await counts()).toEqual(before);
  });
});
