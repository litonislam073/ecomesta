import { createHmac } from 'node:crypto';
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
 * SF-01 (QA-003 / QA-015): a cancelled order must never become CANCELLED/PAID.
 * A verified capture after cancellation is recorded for manual refund; a paid
 * order cannot be cancelled until the refund is recorded. Races run 20 rounds.
 */
describe('SF-01 paid-after-cancel payment race (e2e)', () => {
  jest.setTimeout(300_000);
  const ROUNDS = 20;

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const webhookSecret = `whsec_sf01_${suffix}`;
  const store = { token: '', id: '', slug: `sf01-${suffix}` };
  const other = { token: '', id: '', slug: `sf01-other-${suffix}` };
  let productId = '';
  let shippingMethodId = '';

  const http = () => request(app.getHttpServer());
  const auth = (s = store) => ({ Authorization: `Bearer ${s.token}` });
  const sign = (body: string) => createHmac('sha256', webhookSecret).update(body).digest('hex');

  async function resetBusinessLimits() {
    const keys = await redis.getClient().keys('rl:*');
    if (keys.length > 0) await redis.getClient().del(...keys);
  }

  type Placed = { ref: string; orderId: string; ir: string; total: string; email: string };
  async function placeOnline(n: number | string): Promise<Placed> {
    await resetBusinessLimits();
    const email = `sf01.${n}.${suffix}@example.com`;
    const checkout = await http()
      .post(`/api/v1/public/stores/${store.slug}/checkout`)
      .set('Idempotency-Key', `sf01-${n}-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: { name: 'SF01 Buyer', email, phone: '01711000000' },
        shippingAddress: { name: 'SF01 Buyer', addressLine1: '1 Main', city: 'Dhaka', country: 'BD', email },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'TEST',
        paymentMethod: 'CARD',
      })
      .expect(201);
    const ref = checkout.body.data.publicReference as string;
    const initiated = await http()
      .post(`/api/v1/public/stores/${store.slug}/payments/create`)
      .send({ publicReference: ref, provider: 'TEST', email })
      .expect(201);
    const order = await prisma.order.findFirstOrThrow({ where: { storeId: store.id, publicReference: ref } });
    return { ref, orderId: order.id, ir: initiated.body.data.internalReference, total: initiated.body.data.amount, email };
  }

  function webhook(p: Placed, status: 'PAID' | 'FAILED' = 'PAID', eventId = `evt-${Math.random().toString(36).slice(2)}`, amount = p.total) {
    const body = JSON.stringify({
      eventId,
      eventType: `payment.${status.toLowerCase()}`,
      internalReference: p.ir,
      providerPaymentId: `test_${p.ir}`,
      status,
      amount,
    });
    return http()
      .post('/api/v1/public/payment-webhooks/TEST')
      .set('Content-Type', 'application/json')
      .set('x-ecomesta-test-signature', sign(body))
      .send(body);
  }
  const merchantCancel = (orderId: string) =>
    http().patch(`/api/v1/stores/${store.id}/orders/${orderId}/status`).set(auth()).send({ status: 'CANCELLED' });

  async function state(orderId: string) {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { payments: { orderBy: { attemptNumber: 'asc' } } },
    });
    const lateAudits = await prisma.auditLog.count({
      where: { storeId: store.id, action: 'PAYMENT_LATE_CAPTURE_REFUND_REQUIRED', metadata: { path: ['orderId'], equals: orderId } },
    });
    const returns = await prisma.inventoryMovement.count({
      where: { storeId: store.id, referenceType: 'ORDER', referenceId: orderId, type: 'RETURN' },
    });
    return {
      pair: `${order.status}/${order.paymentStatus}`,
      payments: order.payments.map((p) => p.status),
      lateCapture: order.payments.some((p) => Boolean((p.metadata as { lateCapture?: unknown } | null)?.lateCapture)),
      lateAudits,
      returns,
    };
  }

  /** Invariants every round must satisfy, whatever won the race. */
  function assertConsistent(s: Awaited<ReturnType<typeof state>>) {
    expect(s.pair).not.toBe('CANCELLED/PAID');
    if (s.pair.startsWith('CANCELLED/')) {
      expect(s.payments.some((st) => st === 'PAID' || st === 'PENDING' || st === 'AUTHORIZED')).toBe(false);
      expect(s.returns).toBe(1); // stock restored exactly once
    } else {
      expect(s.returns).toBe(0);
    }
    expect(s.lateAudits).toBeLessThanOrEqual(1);
    expect(s.lateAudits).toBe(s.lateCapture ? 1 : 0);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 60 }) })
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
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

    for (const [key, s] of [['main', store], ['other', other]] as const) {
      const reg = await http()
        .post('/api/v1/auth/register')
        .send({ email: `sf01.${key}.${suffix}@example.com`, password: 'SecurePass1', firstName: 'S', lastName: 'F' })
        .expect(201);
      s.token = reg.body.data.accessToken;
      s.id = (
        await http()
          .post('/api/v1/onboarding/store')
          .set(auth(s))
          .send({ businessName: `SF01 ${key}`, tenantSlug: `${s.slug}-t`, storeName: `SF01 ${key}`, storeSlug: s.slug })
          .expect(201)
      ).body.data.store.id;
      await prisma.store.update({ where: { id: s.id }, data: { status: StoreStatus.ACTIVE } });
    }
    await http().patch(`/api/v1/stores/${store.id}/settings`).set(auth()).send({ allowCustomerCancellation: true }).expect(200);
    productId = (
      await http()
        .post(`/api/v1/stores/${store.id}/products`)
        .set(auth())
        .send({ name: 'SF01 Item', slug: `sf01-item-${suffix}`, status: 'ACTIVE', productType: 'PHYSICAL', basePrice: '40.00', trackInventory: true })
        .expect(201)
    ).body.data.id;
    await http()
      .post(`/api/v1/stores/${store.id}/inventory/adjust`)
      .set(auth())
      .send({ productId, quantity: 1000, type: 'ADJUSTMENT' })
      .expect(201);
    shippingMethodId = (
      await http().post(`/api/v1/stores/${store.id}/shipping-methods`).set(auth()).send({ name: 'Free', type: 'FREE', price: '0', active: true }).expect(201)
    ).body.data.id;
    await http()
      .post(`/api/v1/stores/${store.id}/payment-providers`)
      .set(auth())
      .send({ provider: 'TEST', enabled: true, mode: 'test', publicConfig: { label: 'Test' }, secrets: { webhookSecret } })
      .expect(201);
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  const stock = async () =>
    (await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: store.id, productId, variantId: null } })).quantity;

  it('normal flow: PENDING → PAID marks order and payment paid', async () => {
    const p = await placeOnline('normal');
    const res = await webhook(p).expect(201);
    expect(res.body.data).toMatchObject({ status: 'PAID', replayed: false });
    expect(res.body.data.lateCapture).toBeUndefined();
    const s = await state(p.orderId);
    expect(s.pair).toBe('PENDING/PAID');
    expect(s.payments).toEqual(['PAID']);
  });

  it('already-paid: duplicate and repeated success stay idempotent', async () => {
    const p = await placeOnline('dupe-paid');
    const eventId = `evt-dupe-${suffix}`;
    await webhook(p, 'PAID', eventId).expect(201);
    const replay = await webhook(p, 'PAID', eventId).expect(201);
    expect(replay.body.data.replayed).toBe(true);
    const again = await webhook(p, 'PAID').expect(201); // new event id, same status
    expect(again.body.data.status).toBe('PAID');
    const s = await state(p.orderId);
    expect(s.pair).toBe('PENDING/PAID');
    expect(s.payments).toEqual(['PAID']);
  });

  it('cancellation closes the open attempt; a late success is recorded, not paid', async () => {
    const before = await stock();
    const p = await placeOnline('late');
    expect(await stock()).toBe(before - 1);
    await merchantCancel(p.orderId).expect(200);
    let s = await state(p.orderId);
    expect(s.pair).toBe('CANCELLED/CANCELLED');
    expect(s.payments).toEqual(['CANCELLED']);
    expect(await stock()).toBe(before);

    const eventId = `evt-late-${suffix}`;
    const late = await webhook(p, 'PAID', eventId).expect(201);
    expect(late.body.data).toMatchObject({ lateCapture: true, status: 'CANCELLED', replayed: false });
    s = await state(p.orderId);
    expect(s.pair).toBe('CANCELLED/CANCELLED');
    expect(s.payments).toEqual(['CANCELLED']);
    expect(s.lateCapture).toBe(true);
    expect(s.lateAudits).toBe(1);
    expect(await stock()).toBe(before); // not decremented or restored twice

    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: p.orderId } });
    expect(payment.providerPaymentId).toBe(`test_${p.ir}`);
    expect((payment.metadata as { lateCapture: Record<string, unknown> }).lateCapture).toMatchObject({
      reportedStatus: 'PAID',
      eventId,
      amount: p.total,
      orderStatus: 'CANCELLED',
      requiresManualRefund: true,
    });
    const event = await prisma.paymentWebhookEvent.findFirstOrThrow({ where: { eventId } });
    expect(event.processedAt).not.toBeNull();

    // Same event again: replay. A second, different success event: no new audit.
    expect((await webhook(p, 'PAID', eventId).expect(201)).body.data.replayed).toBe(true);
    expect((await webhook(p, 'PAID').expect(201)).body.data.lateCapture).toBe(true);
    expect((await state(p.orderId)).lateAudits).toBe(1);
    // A failure report for the cancelled order changes nothing.
    await webhook(p, 'FAILED').expect(201);
    expect((await state(p.orderId)).pair).toBe('CANCELLED/CANCELLED');
  });

  it('a late success with a wrong amount or bad signature is still rejected and not recorded', async () => {
    const p = await placeOnline('late-bad');
    await merchantCancel(p.orderId).expect(200);
    await webhook(p, 'PAID', undefined, '1.00').expect(422);
    const body = JSON.stringify({ eventId: 'x', eventType: 'payment.paid', internalReference: p.ir, status: 'PAID', amount: p.total });
    await http().post('/api/v1/public/payment-webhooks/TEST').set('Content-Type', 'application/json').send(body).expect(401);
    await http()
      .post('/api/v1/public/payment-webhooks/TEST')
      .set('Content-Type', 'application/json')
      .set('x-ecomesta-test-signature', 'deadbeef')
      .send(body)
      .expect(401);
    const s = await state(p.orderId);
    expect(s.lateCapture).toBe(false);
    expect(s.lateAudits).toBe(0);
    expect(s.pair).toBe('CANCELLED/CANCELLED');
  });

  it('wrong order / store / reference are still rejected', async () => {
    const p = await placeOnline('wrong');
    await http().post(`/api/v1/public/stores/${other.slug}/payments/create`).send({ publicReference: p.ref, provider: 'TEST', email: p.email }).expect((r) => expect([403, 404, 422]).toContain(r.status));
    await webhook({ ...p, ir: 'pay_does_not_exist' }).expect(404);
    await http().patch(`/api/v1/stores/${other.id}/orders/${p.orderId}/status`).set(auth(other)).send({ status: 'CANCELLED' }).expect((r) => expect([403, 404]).toContain(r.status));
    expect((await state(p.orderId)).pair).toBe('PENDING/PENDING');
  });

  it('a paid order cannot be cancelled until its refund is recorded (no CANCELLED/PAID by cancel)', async () => {
    const p = await placeOnline('paid-cancel');
    await webhook(p).expect(201);
    const res = await merchantCancel(p.orderId).expect(422);
    expect(res.body.error.message).toMatch(/captured payment/);
    expect((await state(p.orderId)).pair).toBe('PENDING/PAID');

    await http().patch(`/api/v1/stores/${store.id}/orders/${p.orderId}/payment-status`).set(auth()).send({ paymentStatus: 'REFUNDED' }).expect(200);
    await merchantCancel(p.orderId).expect(200);
    const s = await state(p.orderId);
    expect(s.pair).toBe('CANCELLED/REFUNDED');
    expect(s.payments).toEqual(['REFUNDED']);
    expect(s.returns).toBe(1);
  });

  async function race(label: string, run: (p: Placed, i: number) => Promise<unknown>, prepare?: (p: Placed) => Promise<void>) {
    const pairs: Record<string, number> = {};
    for (let i = 0; i < ROUNDS; i += 1) {
      const p = await placeOnline(`${label}-${i}`);
      if (prepare) await prepare(p);
      await run(p, i);
      const s = await state(p.orderId);
      assertConsistent(s);
      pairs[s.pair] = (pairs[s.pair] ?? 0) + 1;
    }
    // eslint-disable-next-line no-console
    console.log(`SF-01 ${label}: ${ROUNDS} rounds → ${JSON.stringify(pairs)}`);
    expect(pairs['CANCELLED/PAID'] ?? 0).toBe(0);
    return pairs;
  }

  it(`Race A — merchant cancel ‖ PAID webhook (${ROUNDS} rounds): zero CANCELLED/PAID`, async () => {
    const pairs = await race('raceA', async (p) => {
      const [c, w] = await Promise.all([merchantCancel(p.orderId), webhook(p)]);
      // Exactly one of: cancel won (late capture recorded) or payment won (cancel refused).
      if (c.status === 200) expect(w.body.data.lateCapture).toBe(true);
      else expect([c.status, w.body.data.status]).toEqual([422, 'PAID']);
    });
    expect(Object.keys(pairs).every((k) => k === 'CANCELLED/CANCELLED' || k === 'PENDING/PAID')).toBe(true);
  });

  it(`Race A2 — merchant cancel sent first ‖ PAID webhook (${ROUNDS} rounds)`, async () => {
    const pairs = await race('raceA2', async (p, i) => {
      const c = merchantCancel(p.orderId).then((r) => r);
      // Vary the cancel's head start (0–30 ms) so both orders of commit occur.
      await new Promise((r) => setTimeout(r, (i % 6) * 6));
      const [cr, w] = await Promise.all([c, webhook(p)]);
      if (cr.status === 200) expect(w.body.data.lateCapture).toBe(true);
      else expect(w.body.data.status).toBe('PAID');
    });
    expect(Object.keys(pairs).every((k) => k === 'CANCELLED/CANCELLED' || k === 'PENDING/PAID')).toBe(true);
  });

  it(`Race B — customer cancel ‖ late PAID for a failed attempt (${ROUNDS} rounds)`, async () => {
    await race(
      'raceB',
      async (p) => {
        const [c, w] = await Promise.all([
          http().post(`/api/v1/public/stores/${store.slug}/orders/${p.ref}/cancel`).send({ email: p.email, reason: 'race' }),
          webhook(p),
        ]);
        expect(c.status).toBe(200);
        if (w.status !== 201) {
          // Arrived before the cancel committed: FAILED→PAID is refused; the
          // provider's retry after cancellation is then recorded as late.
          expect(w.status).toBe(422);
          expect((await webhook(p)).body.data.lateCapture).toBe(true);
        } else {
          expect(w.body.data.lateCapture).toBe(true);
        }
      },
      async (p) => {
        await webhook(p, 'FAILED').expect(201); // attempt failed → customer may cancel
      },
    );
  });

  it(`Race C — PAID webhook ‖ merchant cancel, webhook sent first (${ROUNDS} rounds)`, async () => {
    await race('raceC', async (p) => {
      const w = webhook(p).then((r) => r);
      await new Promise((r) => setTimeout(r, 2));
      await Promise.all([w, merchantCancel(p.orderId)]);
    });
  });

  it(`Race D — duplicate PAID webhooks ‖ merchant cancel (${ROUNDS} rounds)`, async () => {
    await race('raceD', async (p) => {
      const eventId = `evt-${Math.random().toString(36).slice(2)}`;
      await Promise.all([webhook(p, 'PAID', eventId), webhook(p, 'PAID', eventId), merchantCancel(p.orderId)]);
    });
  });

  it(`Race E — merchant cancel ‖ two distinct PAID events (${ROUNDS} rounds)`, async () => {
    await race('raceE', async (p) => {
      await Promise.all([merchantCancel(p.orderId), webhook(p), webhook(p)]);
    });
  });

  it(`merchant manual payment update ‖ cancel (${ROUNDS} rounds): zero CANCELLED/PAID`, async () => {
    await race('manual', async (p) => {
      const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: p.orderId } });
      await Promise.all([
        http().patch(`/api/v1/stores/${store.id}/payments/${payment.id}/status`).set(auth()).send({ status: 'PAID' }),
        merchantCancel(p.orderId),
      ]);
    });
  });
});
