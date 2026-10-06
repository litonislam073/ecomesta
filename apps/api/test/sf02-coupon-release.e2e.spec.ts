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
import { activateOnboarded, withPayment } from './support/onboarding';

/**
 * SF-02 (QA-016): a cancelled order stops counting toward its coupon's global
 * and per-customer limits, exactly once, and concurrent checkouts can never
 * exceed a limit. Invariant checked after every step:
 *   coupons.usage_count == usages on non-cancelled orders, 0 ≤ count ≤ limit.
 */
describe('SF-02 coupon usage release on cancellation (e2e)', () => {
  jest.setTimeout(300_000);
  const ROUNDS = 20;

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  type Store = { token: string; id: string; slug: string; productId: string; lowStockId: string; methodId: string };
  const A: Store = { token: '', id: '', slug: `sf02-a-${suffix}`, productId: '', lowStockId: '', methodId: '' };
  const B: Store = { token: '', id: '', slug: `sf02-b-${suffix}`, productId: '', lowStockId: '', methodId: '' };
  let n = 0;

  const http = () => request(app.getHttpServer());
  const auth = (s: Store) => ({ Authorization: `Bearer ${s.token}` });

  async function resetBusinessLimits() {
    const keys = await redis.getClient().keys('rl:*');
    if (keys.length > 0) await redis.getClient().del(...keys);
  }

  async function coupon(s: Store, code: string, extra: Record<string, unknown> = {}) {
    const res = await http()
      .post(`/api/v1/stores/${s.id}/coupons`)
      .set(auth(s))
      .send({ code, type: 'PERCENTAGE', value: '10', active: true, ...extra })
      .expect(201);
    return res.body.data.id as string;
  }

  /** Places a COD checkout; `.expect(status)` asserts the HTTP status like supertest. */
  function checkout(
    s: Store,
    code: string | null,
    email: string,
    opts: { productId?: string; quantity?: number; methodId?: string; extra?: Record<string, unknown> } = {},
  ) {
    const run = placeCheckout(s, code, email, opts);
    return Object.assign(run, {
      expect: async (status: number) => {
        const res = await run;
        if (res.status !== status) throw new Error(`expected ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
        return res;
      },
    });
  }

  async function placeCheckout(
    s: Store,
    code: string | null,
    email: string,
    opts: { productId?: string; quantity?: number; methodId?: string; extra?: Record<string, unknown> },
  ) {
    await resetBusinessLimits();
    n += 1;
    return http()
      .post(`/api/v1/public/stores/${s.slug}/checkout`)
      .set('Idempotency-Key', `sf02-${n}-${suffix}`)
      .send({
        items: [{ productId: opts.productId ?? s.productId, quantity: opts.quantity ?? 1 }],
        customer: { name: 'SF02 Buyer', email, phone: '01711000000' },
        shippingAddress: { name: 'SF02 Buyer', addressLine1: '1 Main', city: 'Dhaka', country: 'BD', email },
        billingSameAsShipping: true,
        shippingMethodId: opts.methodId ?? s.methodId,
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
        ...(code ? { couponCode: code } : {}),
        ...(opts.extra ?? {}),
      });
  }

  const orderId = async (ref: string) => (await prisma.order.findFirstOrThrow({ where: { publicReference: ref } })).id;
  const merchantCancel = (s: Store, id: string) =>
    http().patch(`/api/v1/stores/${s.id}/orders/${id}/status`).set(auth(s)).send({ status: 'CANCELLED' });
  const customerCancel = (s: Store, ref: string, email: string) =>
    http().post(`/api/v1/public/stores/${s.slug}/orders/${ref}/cancel`).send({ email, reason: 'sf02' });

  async function usage(couponId: string) {
    const c = await prisma.coupon.findUniqueOrThrow({ where: { id: couponId } });
    const active = await prisma.couponUsage.count({ where: { couponId, order: { status: { not: 'CANCELLED' } } } });
    const rows = await prisma.couponUsage.count({ where: { couponId } });
    return { count: c.usageCount, active, rows, limit: c.usageLimit };
  }
  async function assertInvariant(couponId: string) {
    const u = await usage(couponId);
    expect(u.count).toBe(u.active);
    expect(u.count).toBeGreaterThanOrEqual(0);
    if (u.limit != null) expect(u.count).toBeLessThanOrEqual(u.limit);
    return u;
  }

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

    for (const [key, s] of [['a', A], ['b', B]] as const) {
      const reg = await http()
        .post('/api/v1/auth/register')
        .send({ email: `sf02.${key}.${suffix}@example.com`, password: 'SecurePass1', firstName: 'S', lastName: 'F' })
        .expect(201);
      s.token = reg.body.data.accessToken;
      s.id = (
        await http()
          .post('/api/v1/onboarding/store')
          .set(auth(s))
          .send(withPayment({ businessName: `SF02 ${key}`, tenantSlug: `${s.slug}-t`, storeName: `SF02 ${key}`, storeSlug: s.slug }))
          .expect(201).then(activateOnboarded(app))
      ).body.data.store.id;
      await prisma.store.update({ where: { id: s.id }, data: { status: StoreStatus.ACTIVE } });
      await http().patch(`/api/v1/stores/${s.id}/settings`).set(auth(s)).send({ allowCustomerCancellation: true }).expect(200);
      s.productId = (
        await http()
          .post(`/api/v1/stores/${s.id}/products`)
          .set(auth(s))
          .send({ name: `SF02 Item ${key}`, slug: `sf02-item-${key}-${suffix}`, status: 'ACTIVE', productType: 'PHYSICAL', basePrice: '100.00', trackInventory: true })
          .expect(201)
      ).body.data.id;
      await http().post(`/api/v1/stores/${s.id}/inventory/adjust`).set(auth(s)).send({ productId: s.productId, quantity: 5000, type: 'ADJUSTMENT' }).expect(201);
      s.lowStockId = (
        await http()
          .post(`/api/v1/stores/${s.id}/products`)
          .set(auth(s))
          .send({ name: `SF02 Low ${key}`, slug: `sf02-low-${key}-${suffix}`, status: 'ACTIVE', productType: 'PHYSICAL', basePrice: '100.00', trackInventory: true })
          .expect(201)
      ).body.data.id;
      s.methodId = (
        await http().post(`/api/v1/stores/${s.id}/shipping-methods`).set(auth(s)).send({ name: 'Free', type: 'FREE', price: '0', active: true }).expect(201)
      ).body.data.id;
    }
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  it('checkout records one usage and increments the counter; an active order blocks usageLimit=1', async () => {
    const id = await coupon(A, `ONE${n}X${suffix.slice(-4)}`, { usageLimit: 1 });
    const code = (await prisma.coupon.findUniqueOrThrow({ where: { id } })).code;
    const first = await checkout(A, code, 'one@example.com').expect(201);
    expect(first.body.data.discountTotal).toBe('10.00');
    let u = await assertInvariant(id);
    expect([u.count, u.rows]).toEqual([1, 1]);
    const usageRow = await prisma.couponUsage.findFirstOrThrow({ where: { couponId: id } });
    expect(usageRow.discountAmount.toFixed(2)).toBe('10.00');

    const blocked = await checkout(A, code, 'two@example.com').expect(422);
    expect(blocked.body.error.message).toMatch(/usage limit/i);
    u = await assertInvariant(id);
    expect([u.count, u.rows]).toEqual([1, 1]);
  });

  it('merchant cancellation releases usageLimit=1 exactly once; repeats change nothing', async () => {
    const id = await coupon(A, `MREL${suffix.slice(-4)}`, { usageLimit: 1 });
    const code = (await prisma.coupon.findUniqueOrThrow({ where: { id } })).code;
    const first = await checkout(A, code, 'm1@example.com').expect(201);
    const oid = await orderId(first.body.data.publicReference);
    const stockBefore = (await prisma.inventoryItem.findFirstOrThrow({ where: { productId: A.productId, variantId: null } })).quantity;

    await merchantCancel(A, oid).expect(200);
    let u = await assertInvariant(id);
    expect([u.count, u.active, u.rows]).toEqual([0, 0, 1]); // row kept as history
    expect((await prisma.inventoryItem.findFirstOrThrow({ where: { productId: A.productId, variantId: null } })).quantity).toBe(stockBefore + 1);
    expect(await prisma.auditLog.count({ where: { entityId: oid, action: 'COUPON_USAGE_RELEASED' } })).toBe(1);

    await merchantCancel(A, oid).expect(400);
    await customerCancel(A, first.body.data.publicReference, 'm1@example.com').expect(422);
    u = await assertInvariant(id);
    expect(u.count).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: oid, action: 'COUPON_USAGE_RELEASED' } })).toBe(1);

    await checkout(A, code, 'm2@example.com').expect(201);
    u = await assertInvariant(id);
    expect([u.count, u.active, u.rows]).toEqual([1, 1, 2]);
    await checkout(A, code, 'm3@example.com').expect(422); // limit still enforced
  });

  it('customer cancellation releases the per-customer limit (email case-insensitive)', async () => {
    const id = await coupon(A, `PC${suffix.slice(-4)}`, { perCustomerLimit: 1 });
    const code = (await prisma.coupon.findUniqueOrThrow({ where: { id } })).code;
    const first = await checkout(A, code, 'Buyer.PC@Example.com').expect(201);
    await checkout(A, code, 'buyer.pc@example.com').expect(422);
    await checkout(A, code, 'someone.else@example.com').expect(201); // other guest unaffected
    await customerCancel(A, first.body.data.publicReference, 'buyer.pc@example.com').expect(200);
    await assertInvariant(id);
    await checkout(A, code, 'BUYER.PC@example.com').expect(201);
    await checkout(A, code, 'buyer.pc@example.com').expect(422);
    await assertInvariant(id);
  });

  it('usageLimit=2: two active block a third; cancelling one frees exactly one slot', async () => {
    const id = await coupon(A, `TWO${suffix.slice(-4)}`, { usageLimit: 2 });
    const code = (await prisma.coupon.findUniqueOrThrow({ where: { id } })).code;
    const o1 = await checkout(A, code, 't1@example.com').expect(201);
    await checkout(A, code, 't2@example.com').expect(201);
    await checkout(A, code, 't3@example.com').expect(422);
    const oid = await orderId(o1.body.data.publicReference);
    await merchantCancel(A, oid).expect(200);
    expect((await assertInvariant(id)).count).toBe(1);
    await checkout(A, code, 't3@example.com').expect(201);
    await merchantCancel(A, oid).expect(400); // same order again: no second release
    const u = await assertInvariant(id);
    expect(u.count).toBe(2);
    await checkout(A, code, 't4@example.com').expect(422);
  });

  it('failed checkouts consume nothing (validation, stock, shipping)', async () => {
    const id = await coupon(A, `FAIL${suffix.slice(-4)}`, { usageLimit: 5 });
    const code = (await prisma.coupon.findUniqueOrThrow({ where: { id } })).code;
    await checkout(A, code, 'f@example.com', { productId: A.lowStockId, quantity: 1 }).expect(422); // stock fails after coupon lock
    await checkout(A, code, 'f@example.com', { methodId: '00000000-0000-4000-8000-000000000000' }).expect(404);
    await checkout(A, code, 'f@example.com', { extra: { discountTotal: '99' } }).expect(400);
    const u = await assertInvariant(id);
    expect([u.count, u.rows]).toEqual([0, 0]);
  });

  it('a rollback after the usage write leaves no orphan usage', async () => {
    const id = await coupon(A, `RB${suffix.slice(-4)}`, { usageLimit: 1 });
    const code = (await prisma.coupon.findUniqueOrThrow({ where: { id } })).code;
    let writtenInTx = { rows: -1, count: -1 };
    const original = prisma.$transaction.bind(prisma) as (...args: unknown[]) => Promise<unknown>;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementation(((arg: unknown, opts?: unknown) => {
      if (typeof arg !== 'function') return original(arg, opts);
      spy.mockRestore();
      // Run the real order-placement transaction to completion, then fail it.
      return original(async (tx: unknown) => {
        await (arg as (t: unknown) => Promise<unknown>)(tx);
        const t = tx as PrismaService;
        writtenInTx = {
          rows: await t.couponUsage.count({ where: { couponId: id } }),
          count: (await t.coupon.findUniqueOrThrow({ where: { id } })).usageCount,
        };
        throw new Error('simulated failure after coupon usage was written');
      }, opts);
    }) as never);
    try {
      await checkout(A, code, 'rb@example.com').expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(writtenInTx).toEqual({ rows: 1, count: 1 }); // the placement transaction did write the usage
    const u = await assertInvariant(id);
    expect([u.count, u.rows]).toEqual([0, 0]);
    expect(await prisma.order.count({ where: { storeId: A.id, couponCode: code } })).toBe(0);
    await checkout(A, code, 'rb@example.com').expect(201);
  });

  it('server stays authoritative: client usage/discount fields are rejected; discount from DB', async () => {
    const id = await coupon(A, `AUTH${suffix.slice(-4)}`, { type: 'FIXED_AMOUNT', value: '1000' });
    const code = (await prisma.coupon.findUniqueOrThrow({ where: { id } })).code;
    for (const extra of [{ discountTotal: '0' }, { couponDiscount: '5' }, { usageCount: 0 }, { couponUsage: [] }, { total: '1' }]) {
      await checkout(A, code, 'auth@example.com', { extra }).expect(400);
    }
    const ok = await checkout(A, code, 'auth@example.com').expect(201);
    expect(ok.body.data).toMatchObject({ subtotal: '100.00', discountTotal: '100.00', total: '0.00' }); // fixed capped at subtotal
    await assertInvariant(id);
  });

  it('coupon rules unchanged: percentage, expired, inactive, minimum order, unknown', async () => {
    const pct = await coupon(A, `P20${suffix.slice(-4)}`, { value: '20' });
    const pctCode = (await prisma.coupon.findUniqueOrThrow({ where: { id: pct } })).code;
    expect((await checkout(A, pctCode.toLowerCase(), 'r@example.com', { quantity: 2 }).expect(201)).body.data.discountTotal).toBe('40.00');
    const exp = await coupon(A, `EXP${suffix.slice(-4)}`, { expiresAt: '2020-01-01T00:00:00.000Z' });
    await checkout(A, (await prisma.coupon.findUniqueOrThrow({ where: { id: exp } })).code, 'r@example.com').expect(422);
    const ina = await coupon(A, `INA${suffix.slice(-4)}`);
    await http().patch(`/api/v1/stores/${A.id}/coupons/${ina}`).set(auth(A)).send({ active: false }).expect(200);
    await checkout(A, (await prisma.coupon.findUniqueOrThrow({ where: { id: ina } })).code, 'r@example.com').expect(422);
    const min = await coupon(A, `MIN${suffix.slice(-4)}`, { minimumOrderAmount: '500' });
    await checkout(A, (await prisma.coupon.findUniqueOrThrow({ where: { id: min } })).code, 'r@example.com').expect(422);
    await checkout(A, `NOPE${suffix.slice(-4)}`, 'r@example.com').expect(422);
    for (const c of [exp, ina, min]) expect((await usage(c)).count).toBe(0);
  });

  it('stores are isolated: same code in A and B; cancelling in A never touches B', async () => {
    const code = `ISO${suffix.slice(-4)}`;
    const ca = await coupon(A, code, { usageLimit: 1 });
    const cb = await coupon(B, code, { usageLimit: 1 });
    const oa = await checkout(A, code, 'iso@example.com').expect(201);
    expect((await usage(cb)).count).toBe(0);
    await checkout(B, code, 'iso@example.com').expect(201);
    await merchantCancel(A, await orderId(oa.body.data.publicReference)).expect(200);
    expect((await assertInvariant(ca)).count).toBe(0);
    expect((await assertInvariant(cb)).count).toBe(1); // B untouched
    await checkout(B, code, 'iso2@example.com').expect(422);
    // A cannot cancel B's order through its own store.
    const bOrder = await prisma.order.findFirstOrThrow({ where: { storeId: B.id, couponCode: code } });
    await merchantCancel(A, bOrder.id).expect(404);
    await http().patch(`/api/v1/stores/${B.id}/orders/${bOrder.id}/status`).set(auth(A)).send({ status: 'CANCELLED' }).expect(403);
    expect((await usage(cb)).count).toBe(1);
  });

  it('SF-01 unchanged: a paid coupon order cannot be cancelled, so its usage stays counted', async () => {
    const id = await coupon(A, `PAID${suffix.slice(-4)}`, { usageLimit: 1 });
    const code = (await prisma.coupon.findUniqueOrThrow({ where: { id } })).code;
    const o = await checkout(A, code, 'paid@example.com').expect(201);
    const oid = await orderId(o.body.data.publicReference);
    await http().patch(`/api/v1/stores/${A.id}/orders/${oid}/payment-status`).set(auth(A)).send({ paymentStatus: 'PAID' }).expect(200);
    await merchantCancel(A, oid).expect(422);
    expect((await assertInvariant(id)).count).toBe(1);
    await http().patch(`/api/v1/stores/${A.id}/orders/${oid}/payment-status`).set(auth(A)).send({ paymentStatus: 'REFUNDED' }).expect(200);
    await merchantCancel(A, oid).expect(200);
    expect((await assertInvariant(id)).count).toBe(0);
  });

  // ------------------------------------------------------------------ races
  function tally(results: string[]) {
    return results.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }), {});
  }

  it(`Race B — two checkouts, usageLimit=1 (${ROUNDS} rounds): never two successes`, async () => {
    const outcomes: string[] = [];
    for (let i = 0; i < ROUNDS; i += 1) {
      const id = await coupon(A, `RB${i}X${suffix.slice(-4)}`, { usageLimit: 1 });
      const code = (await prisma.coupon.findUniqueOrThrow({ where: { id } })).code;
      await resetBusinessLimits();
      const [r1, r2] = await Promise.all([checkout(A, code, `rb1.${i}@example.com`), checkout(A, code, `rb2.${i}@example.com`)]);
      const ok = [r1.status, r2.status].filter((s) => s === 201).length;
      outcomes.push(`${ok} success`);
      expect(ok).toBe(1);
      expect((await assertInvariant(id)).count).toBe(1);
    }
    // eslint-disable-next-line no-console
    console.log(`SF-02 raceB: ${JSON.stringify(tally(outcomes))}`);
  });

  it(`Race C — same customer twice, perCustomerLimit=1 (${ROUNDS} rounds): never two`, async () => {
    const outcomes: string[] = [];
    for (let i = 0; i < ROUNDS; i += 1) {
      const id = await coupon(A, `RC${i}X${suffix.slice(-4)}`, { perCustomerLimit: 1 });
      const code = (await prisma.coupon.findUniqueOrThrow({ where: { id } })).code;
      const [r1, r2] = await Promise.all([checkout(A, code, `same.${i}@example.com`), checkout(A, code, `SAME.${i}@example.com`)]);
      const ok = [r1.status, r2.status].filter((s) => s === 201).length;
      outcomes.push(`${ok} success`);
      expect(ok).toBe(1);
      await assertInvariant(id);
    }
    // eslint-disable-next-line no-console
    console.log(`SF-02 raceC: ${JSON.stringify(tally(outcomes))}`);
  });

  it(`Race A/D — cancel a coupon order ‖ new checkout, usageLimit=1 (${ROUNDS} rounds)`, async () => {
    const outcomes: string[] = [];
    for (let i = 0; i < ROUNDS; i += 1) {
      const id = await coupon(A, `RD${i}X${suffix.slice(-4)}`, { usageLimit: 1 });
      const code = (await prisma.coupon.findUniqueOrThrow({ where: { id } })).code;
      const held = await checkout(A, code, `held.${i}@example.com`).expect(201);
      const oid = await orderId(held.body.data.publicReference);
      await resetBusinessLimits();
      // Vary which side starts first so both orderings are exercised; correctness comes from row locks.
      const cancelLead = (i % 5) * 8;
      const [c, r] = await Promise.all([
        i % 2 === 0 ? merchantCancel(A, oid) : customerCancel(A, held.body.data.publicReference, `held.${i}@example.com`),
        new Promise((resolve) => setTimeout(resolve, cancelLead)).then(() => placeCheckout(A, code, `new.${i}@example.com`, {})),
      ]);
      expect(c.status).toBe(200);
      const u = await assertInvariant(id);
      // Checkout either saw the slot still taken (422, count 0 after release) or freed (201, count 1).
      expect([r.status, u.count]).toEqual(r.status === 201 ? [201, 1] : [422, 0]);
      outcomes.push(r.status === 201 ? 'cancel first → new checkout used freed slot' : 'checkout first → rejected, slot then freed');
    }
    // eslint-disable-next-line no-console
    console.log(`SF-02 raceAD: ${JSON.stringify(tally(outcomes))}`);
  });

  it(`Race E — duplicate concurrent cancellations (${ROUNDS} rounds): released exactly once`, async () => {
    const outcomes: string[] = [];
    for (let i = 0; i < ROUNDS; i += 1) {
      const id = await coupon(A, `RE${i}X${suffix.slice(-4)}`, { usageLimit: 3 });
      const code = (await prisma.coupon.findUniqueOrThrow({ where: { id } })).code;
      const keep = await checkout(A, code, `keep.${i}@example.com`).expect(201);
      const o = await checkout(A, code, `dup.${i}@example.com`).expect(201);
      const oid = await orderId(o.body.data.publicReference);
      const res = await Promise.all([
        merchantCancel(A, oid),
        merchantCancel(A, oid),
        customerCancel(A, o.body.data.publicReference, `dup.${i}@example.com`),
      ]);
      const cancelled = res.filter((r) => r.status === 200).length;
      expect(cancelled).toBe(1);
      const u = await assertInvariant(id);
      expect(u.count).toBe(1); // only `keep` still counts
      expect(await prisma.auditLog.count({ where: { entityId: oid, action: 'COUPON_USAGE_RELEASED' } })).toBe(1);
      outcomes.push(`${cancelled} cancel succeeded`);
      void keep;
    }
    // eslint-disable-next-line no-console
    console.log(`SF-02 raceE: ${JSON.stringify(tally(outcomes))}`);
  });
});
