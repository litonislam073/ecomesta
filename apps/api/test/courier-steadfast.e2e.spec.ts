import { createHmac } from 'node:crypto';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { MembershipStatus, StoreRole, StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SteadfastHttp, SteadfastTransportError } from '../src/modules/couriers/providers/steadfast/steadfast.http';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';

/**
 * Steadfast Courier V1 end to end: real API, database and encryption; only the
 * network call to Steadfast is replaced. Covers connecting (credentials checked,
 * encrypted, never returned or logged), booking (server-side COD, duplicate and
 * retry safety, ownership), status sync (mapping, unknown statuses, provider
 * failures) and the rule that courier status never touches payment status.
 */
describe('Steadfast courier integration (e2e)', () => {
  jest.setTimeout(180_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const API_KEY = `sfkey${suffix.replace('-', '')}AAAA`;
  const SECRET_KEY = `sfsecret${suffix.replace('-', '')}BBBB`;
  const webhookSecret = `whsec_courier_${suffix}`;

  /** Fake Steadfast: tests set what each endpoint answers. */
  type SfCall = { method: string; url: string; apiKey: string; secretKey: string; body?: Record<string, unknown> };
  const calls: SfCall[] = [];
  let routes: Record<string, (call: SfCall) => Promise<{ status: number; body: unknown }>> = {};
  const steadfast = {
    request: jest.fn(async (call: SfCall) => {
      calls.push(call);
      const path = new URL(call.url).pathname.replace(/^\/api\/v1/, '');
      const key = Object.keys(routes).find((k) => path === k || path.startsWith(`${k}/`));
      if (!key) throw new Error(`unexpected Steadfast call ${path}`);
      return routes[key]!(call);
    }),
  };
  const ok = (body: unknown) => async () => ({ status: 200, body });
  const balanceOk = ok({ status: 200, current_balance: 0 });
  // Unique across test runs, like real Steadfast consignment ids.
  let consignmentSeq = Number(String(Date.now()).slice(-9));
  const createOk = async (call: SfCall) => ({
    status: 200,
    body: {
      status: 200,
      message: 'Consignment has been created successfully.',
      consignment: { consignment_id: (consignmentSeq += 1), invoice: call.body?.invoice, tracking_code: `TRK${consignmentSeq}`, status: 'in_review' },
    },
  });

  interface Shop { key: string; token: string; userId: string; storeId: string; storeSlug: string; productId: string; shippingMethodId: string }
  const shop = (key: string): Shop => ({ key, token: '', userId: '', storeId: '', storeSlug: `courier-${key}-${suffix}`, productId: '', shippingMethodId: '' });
  const alpha = shop('alpha');
  const beta = shop('beta');
  const staff = { token: '', userId: '' };

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function register(email: string) {
    const res = await request(server()).post('/api/v1/auth/register').send({ email, password: 'SecurePass1', firstName: 'Courier', lastName: 'Test' }).expect(201);
    return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
  }

  async function openShop(s: Shop) {
    Object.assign(s, await register(`courier.${s.key}.${suffix}@example.com`));
    const res = await request(server())
      .post('/api/v1/onboarding/store')
      .set(auth(s.token))
      .send(withPayment({ businessName: `Courier ${s.key} ${suffix}`, tenantSlug: s.storeSlug, storeName: `Courier ${s.key}`, storeSlug: s.storeSlug }))
      .expect(201)
      .then(activateOnboarded(app));
    s.storeId = res.body.data.store.id;
    await prisma.store.update({ where: { id: s.storeId }, data: { status: StoreStatus.ACTIVE, currency: 'BDT' } });
    s.productId = (
      await request(server())
        .post(`/api/v1/stores/${s.storeId}/products`)
        .set(auth(s.token))
        .send({ name: 'Panjabi', slug: `panjabi-${suffix}`, status: 'ACTIVE', basePrice: '1250.00', trackInventory: false })
        .expect(201)
    ).body.data.id;
    s.shippingMethodId = (
      await request(server())
        .post(`/api/v1/stores/${s.storeId}/shipping-methods`)
        .set(auth(s.token))
        .send({ name: 'Free', type: 'FREE', price: '0', active: true })
        .expect(201)
    ).body.data.id;
    await request(server())
      .post(`/api/v1/stores/${s.storeId}/payment-providers`)
      .set(auth(s.token))
      .send({ provider: 'TEST', enabled: true, mode: 'test', secrets: { webhookSecret } })
      .expect(201);
  }

  let orderSeq = 0;
  async function placeOrder(s: Shop, paymentProvider: 'COD' | 'TEST' = 'COD', productId = s.productId) {
    const res = await request(server())
      .post(`/api/v1/public/stores/${s.storeSlug}/checkout`)
      .set('Idempotency-Key', `courier-${s.key}-${suffix}-${(orderSeq += 1)}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: { name: 'Rahim Uddin', phone: '+880 1711-000000', email: `buyer.${suffix}@example.com` },
        shippingAddress: { name: 'Rahim Uddin', phone: '+880 1711-000000', addressLine1: 'House 7, Road 3', city: 'Dhaka', country: 'BD', email: `buyer.${suffix}@example.com` },
        billingSameAsShipping: true,
        shippingMethodId: s.shippingMethodId,
        paymentProvider,
        paymentMethod: paymentProvider === 'COD' ? 'CASH' : 'CARD',
      })
      .expect(201);
    return prisma.order.findFirstOrThrow({ where: { storeId: s.storeId, publicReference: res.body.data.publicReference } });
  }

  async function payOnline(s: Shop, publicReference: string) {
    const initiated = await request(server())
      .post(`/api/v1/public/stores/${s.storeSlug}/payments/create`)
      .send({ publicReference, provider: 'TEST', phone: '+880 1711-000000' })
      .expect(201);
    const ref = initiated.body.data.internalReference as string;
    const body = JSON.stringify({ eventId: `evt-${ref}`, eventType: 'payment.paid', internalReference: ref, providerPaymentId: `test_${ref}`, status: 'PAID', amount: initiated.body.data.amount });
    await request(server())
      .post('/api/v1/public/payment-webhooks/TEST')
      .set('Content-Type', 'application/json')
      .set('x-ecomesta-test-signature', createHmac('sha256', webhookSecret).update(body).digest('hex'))
      .send(body)
      .expect(201);
  }

  const book = (s: Shop, orderId: string, token = s.token, body: Record<string, unknown> = { provider: 'STEADFAST' }) =>
    request(server()).post(`/api/v1/stores/${s.storeId}/orders/${orderId}/courier-shipments`).set(auth(token)).send(body);
  const sync = (s: Shop, orderId: string, shipmentId: string, token = s.token) =>
    request(server()).post(`/api/v1/stores/${s.storeId}/orders/${orderId}/shipments/${shipmentId}/sync`).set(auth(token));
  const createCalls = () => calls.filter((c) => c.url.endsWith('/create_order'));

  // Everything the API printed while the test ran (pino writes to stdout).
  const printed: string[] = [];
  const realWrite = process.stdout.write.bind(process.stdout);

  beforeAll(async () => {
    process.env.PAYMENT_SECRETS_ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SteadfastHttp).useValue(steadfast).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }
    await openShop(alpha);
    await openShop(beta);
    Object.assign(staff, await register(`courier.staff.${suffix}@example.com`));
    await prisma.storeUser.create({ data: { storeId: alpha.storeId, userId: staff.userId, role: StoreRole.STORE_STAFF, status: MembershipStatus.ACTIVE } });

    process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
      printed.push(String(chunk));
      return (realWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof process.stdout.write;
  });

  afterAll(async () => {
    process.stdout.write = realWrite;
    await app?.close();
  });

  beforeEach(async () => {
    routes = { '/get_balance': balanceOk, '/create_order': createOk };
    // This spec places many test orders in one store: reset the per-IP request
    // limits between tests (as other specs do in beforeAll); the limits
    // themselves are covered by their own specs.
    const keys = await redis.getClient().keys('rl:*');
    if (keys.length > 0) await redis.getClient().del(...keys);
  });

  describe('connecting Steadfast', () => {
    it('starts not connected', async () => {
      const res = await request(server()).get(`/api/v1/stores/${alpha.storeId}/couriers`).set(auth(alpha.token)).expect(200);
      expect(res.body.data.map((c: { provider: string }) => c.provider)).toEqual(['STEADFAST', 'PATHAO', 'REDX', 'PAPERFLY', 'ECOURIER']);
      expect(res.body.data[0]).toEqual(
        expect.objectContaining({ provider: 'STEADFAST', status: 'NOT_CONNECTED', supportsCancellation: false, credentialsSaved: false, settings: {} }),
      );
      // What to enter is described by the API; nothing secret is ever echoed back.
      expect(res.body.data[0].fields.map((f: { key: string }) => f.key)).toEqual(['apiKey', 'secretKey']);
    });

    it('refuses credentials Steadfast rejects, and saves nothing', async () => {
      routes['/get_balance'] = async () => ({ status: 401, body: { message: 'Unauthenticated.' } });
      const res = await request(server())
        .put(`/api/v1/stores/${alpha.storeId}/couriers/STEADFAST`)
        .set(auth(alpha.token))
        .send({ apiKey: 'wrongkey123', secretKey: 'wrongsecret123' })
        .expect(422);
      expect(res.body.error.code).toBe('COURIER_AUTH_FAILED');
      expect(await prisma.courierConnection.count({ where: { storeId: alpha.storeId } })).toBe(0);
    });

    it('only store managers can connect', async () => {
      await request(server()).put(`/api/v1/stores/${alpha.storeId}/couriers/STEADFAST`).set(auth(staff.token)).send({ apiKey: API_KEY, secretKey: SECRET_KEY }).expect(403);
    });

    it('connects with checked credentials, stores them encrypted and never returns them', async () => {
      const res = await request(server())
        .put(`/api/v1/stores/${alpha.storeId}/couriers/STEADFAST`)
        .set(auth(alpha.token))
        .send({ apiKey: API_KEY, secretKey: SECRET_KEY, pickupName: 'Alpha Warehouse', pickupPhone: '01811000000', pickupAddress: 'Mirpur 10, Dhaka', defaultWeightKg: 0.5 })
        .expect(200);
      expect(res.body.data).toMatchObject({ status: 'CONNECTED', credentialsSaved: true, pickupName: 'Alpha Warehouse', defaultWeightKg: 0.5 });
      expect(JSON.stringify(res.body)).not.toMatch(new RegExp(`${API_KEY}|${SECRET_KEY}`));
      expect(calls.at(-1)).toMatchObject({ method: 'GET', apiKey: API_KEY, secretKey: SECRET_KEY });
      expect(calls.at(-1)!.url).toMatch(/\/get_balance$/);

      const row = await prisma.courierConnection.findUniqueOrThrow({ where: { storeId_provider: { storeId: alpha.storeId, provider: 'STEADFAST' } } });
      expect(row.encryptedCredentials).toMatch(/^v1:/);
      expect(row.encryptedCredentials).not.toContain(API_KEY);
      expect(row.encryptedCredentials).not.toContain(SECRET_KEY);
      expect(JSON.stringify(row.publicConfig)).not.toMatch(new RegExp(`${API_KEY}|${SECRET_KEY}`));

      const listed = await request(server()).get(`/api/v1/stores/${alpha.storeId}/couriers`).set(auth(alpha.token)).expect(200);
      expect(listed.body.data[0]).toMatchObject({ status: 'CONNECTED', pickupAddress: 'Mirpur 10, Dhaka' });
      expect(JSON.stringify(listed.body)).not.toMatch(new RegExp(`${API_KEY}|${SECRET_KEY}`));
      const audit = await prisma.auditLog.findMany({ where: { storeId: alpha.storeId, entityType: 'CourierConnection' } });
      expect(audit.length).toBeGreaterThan(0);
      expect(JSON.stringify(audit)).not.toMatch(new RegExp(`${API_KEY}|${SECRET_KEY}`));
    });

    it('updates pickup settings without re-sending (or re-checking) the keys', async () => {
      const before = calls.length;
      const res = await request(server()).put(`/api/v1/stores/${alpha.storeId}/couriers/STEADFAST`).set(auth(alpha.token)).send({ defaultWeightKg: 1 }).expect(200);
      expect(res.body.data).toMatchObject({ defaultWeightKg: 1, pickupName: 'Alpha Warehouse' });
      expect(calls.length).toBe(before);
      await request(server()).put(`/api/v1/stores/${alpha.storeId}/couriers/STEADFAST`).set(auth(alpha.token)).send({ apiKey: 'onlyonekey123' }).expect(400);
    });

    it("keeps one merchant out of another's courier settings", async () => {
      await request(server()).get(`/api/v1/stores/${alpha.storeId}/couriers`).set(auth(beta.token)).expect(403);
      await request(server()).put(`/api/v1/stores/${alpha.storeId}/couriers/STEADFAST`).set(auth(beta.token)).send({ apiKey: API_KEY, secretKey: SECRET_KEY }).expect(403);
      await request(server()).delete(`/api/v1/stores/${alpha.storeId}/couriers/STEADFAST`).set(auth(beta.token)).expect(403);
    });
  });

  describe('booking a parcel', () => {
    it('books a cash-on-delivery order with the order total as COD, computed on the server', async () => {
      const order = await placeOrder(alpha);
      // A client-sent amount is not accepted at all.
      await book(alpha, order.id, alpha.token, { provider: 'STEADFAST', codAmount: 1 }).expect(400);

      const res = await book(alpha, order.id, alpha.token, { provider: 'STEADFAST', note: 'Fragile' }).expect(201);
      expect(res.body.data).toMatchObject({
        provider: 'STEADFAST',
        courierName: 'Steadfast',
        status: 'LABEL_CREATED',
        providerStatus: 'in_review',
        trackingUrl: null,
        supportsCancellation: false,
        courierManaged: true,
        codAmount: order.grandTotal.toFixed(2),
        weightKg: '1',
      });
      expect(res.body.data.trackingNumber).toMatch(/^TRK/);
      expect(JSON.stringify(res.body)).not.toMatch(new RegExp(`${API_KEY}|${SECRET_KEY}`));

      const sent = createCalls().at(-1)!;
      expect(sent.body).toEqual({
        invoice: `${alpha.storeSlug}-${order.orderNumber}`,
        recipient_name: 'Rahim Uddin',
        recipient_phone: '01711000000',
        recipient_address: 'House 7, Road 3, Dhaka',
        cod_amount: Number(order.grandTotal),
        note: 'Fragile',
      });
      // Steadfast documents cod_amount as an integer: a whole-taka total is sent exactly.
      expect(order.grandTotal.toFixed(2)).toBe('1250.00');
      expect(sent.body!.cod_amount).toBe(1250);
      expect(Number.isInteger(sent.body!.cod_amount)).toBe(true);
      const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
      expect(after.grandTotal.toFixed(2)).toBe('1250.00');
      expect(after.payments.map((p) => p.amount.toFixed(2))).toEqual(['1250.00']);
      expect(after.paymentStatus).toBe(order.paymentStatus);
      expect(after.status).toBe(order.status);
      expect(after.fulfillmentStatus).toBe('UNFULFILLED');
    });

    it('refuses a COD total with paisa instead of rounding it: nothing sent, nothing stored, amounts untouched', async () => {
      const paisaProduct = (
        await request(server())
          .post(`/api/v1/stores/${alpha.storeId}/products`)
          .set(auth(alpha.token))
          .send({ name: 'Paisa Panjabi', slug: `paisa-${suffix}`, status: 'ACTIVE', basePrice: '1250.50', trackInventory: false })
          .expect(201)
      ).body.data.id as string;
      const order = await placeOrder(alpha, 'COD', paisaProduct);
      const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
      expect(before.grandTotal.toFixed(2)).toBe('1250.50');
      routes['/create_order'] = createOk;
      const creates = createCalls().length;

      const res = await book(alpha, order.id).expect(422);
      expect(res.body.error.code).toBe('COURIER_COD_NOT_WHOLE_TAKA');
      expect(res.body.error.message).toMatch(/whole taka only.*BDT 1250\.50/);
      expect(createCalls().length).toBe(creates);
      expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(0);

      const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
      expect(after.grandTotal.toFixed(2)).toBe('1250.50');
      expect(after.payments.map((p) => [p.amount.toFixed(2), p.status])).toEqual(before.payments.map((p) => [p.amount.toFixed(2), p.status]));
      expect([after.status, after.paymentStatus, after.fulfillmentStatus]).toEqual([before.status, before.paymentStatus, before.fulfillmentStatus]);
      // The order is still free for a manual shipment.
      await request(server()).post(`/api/v1/stores/${alpha.storeId}/orders/${order.id}/shipments`).set(auth(alpha.token)).send({ status: 'PENDING' }).expect(201);
    });

    it('collects nothing for an order already paid online', async () => {
      const order = await placeOrder(alpha, 'TEST');
      await payOnline(alpha, order.publicReference!);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('PAID');
      const res = await book(alpha, order.id).expect(201);
      expect(res.body.data.codAmount).toBe('0.00');
      expect(createCalls().at(-1)!.body!.cod_amount).toBe(0);
    });

    it('refuses an online order whose payment is not complete, and a cancelled order', async () => {
      const unpaid = await placeOrder(alpha, 'TEST');
      const before = createCalls().length;
      expect((await book(alpha, unpaid.id).expect(422)).body.error.code).toBe('ORDER_NOT_SHIPPABLE');
      const cancelled = await placeOrder(alpha);
      await prisma.order.update({ where: { id: cancelled.id }, data: { status: 'CANCELLED' } });
      expect((await book(alpha, cancelled.id).expect(422)).body.error.code).toBe('ORDER_NOT_SHIPPABLE');
      expect(createCalls().length).toBe(before);
    });

    it('never books the same order twice — even when two requests race', async () => {
      const order = await placeOrder(alpha);
      const before = createCalls().length;
      const [a, b] = await Promise.all([book(alpha, order.id), book(alpha, order.id)]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(createCalls().length).toBe(before + 1);
      expect((await book(alpha, order.id).expect(409)).body.error.code).toBe('SHIPMENT_ALREADY_EXISTS');
      expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(1);
    });

    it('refuses an order that already has a (manual) shipment', async () => {
      const order = await placeOrder(alpha);
      await request(server()).post(`/api/v1/stores/${alpha.storeId}/orders/${order.id}/shipments`).set(auth(alpha.token)).send({ status: 'SHIPPED' }).expect(201);
      // The manual shipment fulfils the order, so the courier refuses it (422) — never books a second shipment.
      const before = createCalls().length;
      const res = await book(alpha, order.id);
      expect([409, 422]).toContain(res.status);
      expect(createCalls().length).toBe(before);
      expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(1);
    });

    it('needs a connected courier, and keeps merchants to their own orders', async () => {
      const betaOrder = await placeOrder(beta);
      expect((await book(beta, betaOrder.id).expect(422)).body.error.code).toBe('COURIER_NOT_CONNECTED');
      const alphaOrder = await placeOrder(alpha);
      // Beta's token on Alpha's store, and Alpha's order through Beta's store.
      await book(alpha, alphaOrder.id, beta.token).expect(403);
      await request(server()).post(`/api/v1/stores/${beta.storeId}/orders/${alphaOrder.id}/courier-shipments`).set(auth(beta.token)).send({ provider: 'STEADFAST' }).expect(404);
      await book(alpha, '00000000-0000-0000-0000-000000000000').expect(404);
      await book(alpha, alphaOrder.id, staff.token).expect(403);
    });

    it('shows Steadfast validation errors to the merchant without creating a shipment', async () => {
      const order = await placeOrder(alpha);
      routes['/create_order'] = async () => ({ status: 200, body: { status: 400, errors: { recipient_address: ['The recipient address may not be greater than 250 characters.'] } } });
      const res = await book(alpha, order.id).expect(422);
      expect(res.body.error).toMatchObject({ code: 'COURIER_VALIDATION_FAILED' });
      expect(res.body.error.message).toContain('recipient address');
      expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(0);
    });
  });

  /** A promise the test resolves itself — makes races deterministic without sleeps. */
  function deferred<T = void>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
  }
  const manualCreate = (s: Shop, orderId: string, token = s.token) =>
    request(server()).post(`/api/v1/stores/${s.storeId}/orders/${orderId}/shipments`).set(auth(token)).send({ status: 'PENDING' });
  const release = (s: Shop, orderId: string, shipmentId: string) =>
    request(server()).post(`/api/v1/stores/${s.storeId}/orders/${orderId}/shipments/${shipmentId}/release`).set(auth(s.token));
  const invoiceLookups = () => calls.filter((c) => c.url.includes('/status_by_invoice/'));

  describe('lost booking answers never cause a second parcel', () => {
    /** A booking whose create_order answer was lost (timeout): the order then has one unconfirmed shipment. */
    async function unconfirmedBooking() {
      const order = await placeOrder(alpha);
      routes['/create_order'] = async () => {
        throw new SteadfastTransportError('timeout');
      };
      expect((await book(alpha, order.id).expect(503)).body.error.code).toBe('COURIER_UNAVAILABLE');
      const shipment = await prisma.shipment.findFirstOrThrow({ where: { orderId: order.id } });
      return { order, shipment };
    }

    it('A. create_order timeout → the shipment is unconfirmed, with no tracking', async () => {
      const { shipment } = await unconfirmedBooking();
      expect(shipment).toMatchObject({ status: 'PENDING', trackingNumber: null, providerShipmentId: null, metadata: { booking: 'unconfirmed' } });
      const listed = await request(server()).get(`/api/v1/stores/${alpha.storeId}/orders/${shipment.orderId}`).set(auth(alpha.token)).expect(200);
      expect(listed.body.data.shipments[0]).toMatchObject({ courierBooking: 'unconfirmed', trackingNumber: null });
    });

    it('B + C. retry asks status_by_invoice first and recovers the parcel Steadfast has — no second create_order', async () => {
      const { order, shipment } = await unconfirmedBooking();
      const creates = createCalls().length;
      routes['/create_order'] = createOk; // would succeed — and must not be called
      routes['/status_by_invoice'] = ok({ status: 200, delivery_status: 'in_review' });
      const res = await book(alpha, order.id).expect(201);
      expect(res.body.message).toMatch(/No new parcel was booked/);
      expect(res.body.data).toMatchObject({ id: shipment.id, status: 'LABEL_CREATED', providerStatus: 'in_review', courierBooking: 'confirmed', trackingNumber: null });
      expect(createCalls().length).toBe(creates);
      expect(invoiceLookups().at(-1)!.url).toMatch(new RegExp(`/status_by_invoice/${alpha.storeSlug}-${order.orderNumber}$`));
      expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(1);
    });

    it('D. only the merchant can declare it not booked; the next booking then uses a NEW invoice', async () => {
      const { order, shipment } = await unconfirmedBooking();
      // Steadfast documents no "not found" answer, so a 404 is not proof — no create, still unconfirmed.
      routes['/status_by_invoice'] = async () => ({ status: 404, body: { status: 404, message: 'Not found' } });
      routes['/create_order'] = createOk;
      const creates = createCalls().length;
      expect((await book(alpha, order.id).expect(409)).body.error.code).toBe('COURIER_BOOKING_UNCONFIRMED');
      expect(createCalls().length).toBe(creates);
      // Merchant checked their Steadfast account: mark it not booked.
      const released = await release(alpha, order.id, shipment.id).expect(200);
      expect(released.body.data).toMatchObject({ status: 'FAILED', courierBooking: 'released' });
      // Now create_order may proceed — with a different invoice, so it can never collide with the first.
      const booked = await book(alpha, order.id).expect(201);
      expect(createCalls().length).toBe(creates + 1);
      expect(createCalls().at(-1)!.body!.invoice).toBe(`${alpha.storeSlug}-${order.orderNumber}-2`);
      expect(booked.body.data.id).not.toBe(shipment.id);
      const audit = await prisma.auditLog.findFirst({ where: { entityId: shipment.id, action: 'COURIER_BOOKING_RELEASED' } });
      expect(audit).not.toBeNull();
    });

    it('releasing asks Steadfast once more and recovers instead when it does have the parcel', async () => {
      const { order, shipment } = await unconfirmedBooking();
      routes['/status_by_invoice'] = ok({ status: 200, delivery_status: 'pending' });
      const res = await release(alpha, order.id, shipment.id).expect(200);
      expect(res.body.data).toMatchObject({ id: shipment.id, courierBooking: 'confirmed', status: 'LABEL_CREATED' });
    });

    it('Steadfast accepts the parcel but recording it fails → unconfirmed (503), never re-booked, recoverable by sync', async () => {
      const first = await placeOrder(alpha);
      routes['/create_order'] = createOk;
      const booked = await book(alpha, first.id).expect(201);
      const order = await placeOrder(alpha);
      // The courier answers with a consignment id Ecomesta already holds, so saving the booking fails.
      routes['/create_order'] = async (call) => ({
        status: 200,
        body: { status: 200, consignment: { consignment_id: Number(booked.body.data.providerShipmentId), invoice: call.body?.invoice, tracking_code: 'TRKDUP', status: 'in_review' } },
      });
      const res = await book(alpha, order.id).expect(503);
      expect(res.body.error.code).toBe('COURIER_BOOKING_UNCONFIRMED');
      const shipment = await prisma.shipment.findFirstOrThrow({ where: { orderId: order.id } });
      expect(shipment).toMatchObject({ status: 'PENDING', providerShipmentId: null, metadata: { booking: 'unconfirmed' } });
      const creates = createCalls().length;
      routes['/create_order'] = createOk;
      routes['/status_by_invoice'] = ok({ status: 200, delivery_status: 'in_review' });
      const synced = await request(server()).post(`/api/v1/stores/${alpha.storeId}/orders/${order.id}/shipments/${shipment.id}/sync`).set(auth(alpha.token)).send({});
      expect([200, 201]).toContain(synced.status);
      expect(synced.body.data).toMatchObject({ id: shipment.id, courierBooking: 'confirmed', status: 'LABEL_CREATED' });
      expect(createCalls().length).toBe(creates);
    });

    it.each([
      ['E. timeout', async () => { throw new SteadfastTransportError('timeout'); }, 503],
      ['E. 5xx', async () => ({ status: 502, body: null }), 503],
      ['F. ambiguous answer (200 without a status)', async () => ({ status: 200, body: { status: 200 } }), 503],
      ['F. not-found-looking answer', async () => ({ status: 200, body: { status: 404, message: 'Not found' } }), 409],
    ])('%s from status_by_invoice → no create_order, still unconfirmed', async (_label, handler, status) => {
      const { order, shipment } = await unconfirmedBooking();
      routes['/status_by_invoice'] = handler as never;
      routes['/create_order'] = createOk;
      const creates = createCalls().length;
      await book(alpha, order.id).expect(status);
      await sync(alpha, order.id, shipment.id);
      expect(createCalls().length).toBe(creates);
      const after = await prisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } });
      expect(after.metadata).toEqual({ booking: 'unconfirmed' });
      expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(1);
    });

    it('G. repeated and concurrent retries never create a second parcel or a second confirmed shipment', async () => {
      const { order } = await unconfirmedBooking();
      routes['/create_order'] = createOk;
      routes['/status_by_invoice'] = async () => ({ status: 503, body: null });
      const creates = createCalls().length;
      for (let i = 0; i < 3; i += 1) await book(alpha, order.id);
      routes['/status_by_invoice'] = ok({ status: 200, delivery_status: 'in_review' });
      const results = await Promise.all([book(alpha, order.id), book(alpha, order.id), book(alpha, order.id)]);
      expect(results.every((r) => r.status === 201 || r.status === 409)).toBe(true);
      expect(createCalls().length).toBe(creates);
      const shipments = await prisma.shipment.findMany({ where: { orderId: order.id } });
      expect(shipments).toHaveLength(1);
      expect(shipments[0]!.metadata).toMatchObject({ booking: 'confirmed' });
      const events = await prisma.shipmentEvent.count({ where: { shipmentId: shipments[0]!.id } });
      expect(events).toBe(1);
    });

    it('a booking call that died mid-way (stale in_progress) is reconciled, never re-created', async () => {
      const order = await placeOrder(alpha);
      const stale = await prisma.shipment.create({
        data: { storeId: alpha.storeId, orderId: order.id, provider: 'STEADFAST', status: 'PENDING', providerReference: `${alpha.storeSlug}-${order.orderNumber}`, metadata: { booking: 'in_progress' } },
      });
      await prisma.$executeRaw`UPDATE shipments SET updated_at = now() - interval '10 minutes' WHERE id = ${stale.id}::uuid`;
      routes['/status_by_invoice'] = ok({ status: 200, delivery_status: 'in_review' });
      const creates = createCalls().length;
      const res = await sync(alpha, order.id, stale.id).expect(201);
      expect(res.body.data).toMatchObject({ courierBooking: 'confirmed' });
      expect(createCalls().length).toBe(creates);
    });
  });

  describe('Sync during an in-flight booking (HIGH #1)', () => {
    it('Sync cannot delete or change a booking whose create_order is still running', async () => {
      const order = await placeOrder(alpha);
      const reached = deferred();
      const release = deferred<{ status: number; body: unknown }>();
      routes['/create_order'] = async (call) => {
        reached.resolve();
        await release.promise;
        return createOk(call);
      };
      routes['/status_by_invoice'] = async () => ({ status: 200, body: { status: 404, message: 'Not found' } });
      const booking = book(alpha, order.id).then((r) => r); // starts the request
      await reached.promise; // Steadfast has the request; its answer is held back
      const inFlight = await prisma.shipment.findFirstOrThrow({ where: { orderId: order.id } });
      expect(inFlight.metadata).toEqual({ booking: 'in_progress' });

      const lookups = invoiceLookups().length;
      const res = await sync(alpha, order.id, inFlight.id).expect(409);
      expect(res.body.error.code).toBe('COURIER_BOOKING_IN_PROGRESS');
      await request(server()).post(`/api/v1/stores/${alpha.storeId}/orders/${order.id}/shipments/${inFlight.id}/release`).set(auth(alpha.token)).expect(409);
      expect(invoiceLookups().length).toBe(lookups); // Steadfast was not even asked
      expect(await prisma.shipment.findUniqueOrThrow({ where: { id: inFlight.id } })).toMatchObject({ metadata: { booking: 'in_progress' }, status: 'PENDING' });

      release.resolve({ status: 200, body: null });
      const booked = await booking;
      expect(booked.status).toBe(201);
      const final = await prisma.shipment.findUniqueOrThrow({ where: { id: inFlight.id } });
      expect(final).toMatchObject({ status: 'LABEL_CREATED', metadata: { booking: 'confirmed' } });
      expect(final.providerShipmentId).toBeTruthy();
      expect(final.trackingNumber).toMatch(/^TRK/);
      expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(1);
    });
  });

  describe('manual shipments and courier bookings never coexist (BLOCKER #2)', () => {
    it('A + B. with an active courier shipment, manual Create shipment is 409 and creates nothing', async () => {
      const order = await placeOrder(alpha);
      const courier = (await book(alpha, order.id).expect(201)).body.data;
      const res = await manualCreate(alpha, order.id).expect(409);
      expect(res.body.error.code).toBe('SHIPMENT_ALREADY_EXISTS');
      expect(res.body.error.message).toMatch(/active courier shipment/);
      const rows = await prisma.shipment.findMany({ where: { orderId: order.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: courier.id, provider: 'STEADFAST', status: 'LABEL_CREATED' });
    });

    it('also while the courier booking is unconfirmed', async () => {
      const order = await placeOrder(alpha);
      routes['/create_order'] = async () => ({ status: 500, body: null });
      await book(alpha, order.id).expect(503);
      await manualCreate(alpha, order.id).expect(409);
      expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(1);
    });

    it('D. with an active manual shipment, courier booking is 409 and Steadfast is not called', async () => {
      const order = await placeOrder(alpha);
      await manualCreate(alpha, order.id).expect(201);
      const creates = createCalls().length;
      const res = await book(alpha, order.id).expect(409);
      expect(res.body.error).toMatchObject({ code: 'SHIPMENT_ALREADY_EXISTS', message: 'This order already has an active shipment.' });
      expect(createCalls().length).toBe(creates);
    });

    it('E. concurrent manual and courier creation: exactly one shipment wins', async () => {
      for (let round = 0; round < 3; round += 1) {
        const order = await placeOrder(alpha);
        const [m, c] = await Promise.all([manualCreate(alpha, order.id), book(alpha, order.id)]);
        expect([m.status, c.status].sort()).toEqual([201, 409]);
        expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(1);
      }
    });

    it('a cancelled courier shipment frees the order for a manual one', async () => {
      const order = await placeOrder(alpha);
      const courier = (await book(alpha, order.id).expect(201)).body.data;
      routes['/status_by_cid'] = ok({ status: 200, delivery_status: 'cancelled' });
      expect((await sync(alpha, order.id, courier.id).expect(201)).body.data.status).toBe('CANCELLED');
      await manualCreate(alpha, order.id).expect(201);
    });

    it('F. tenant isolation: another merchant cannot create a shipment on this order either way', async () => {
      const order = await placeOrder(alpha);
      await manualCreate(alpha, order.id, beta.token).expect(403);
      await request(server()).post(`/api/v1/stores/${beta.storeId}/orders/${order.id}/shipments`).set(auth(beta.token)).send({ status: 'PENDING' }).expect(404);
      await book(alpha, order.id, beta.token).expect(403);
      expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(0);
    });
  });

  describe('order cancellation with a courier shipment (HIGH #2)', () => {
    const cancel = (s: Shop, orderId: string) =>
      request(server()).patch(`/api/v1/stores/${s.storeId}/orders/${orderId}/status`).set(auth(s.token)).send({ status: 'CANCELLED', reason: 'Customer changed mind' });

    it('is refused (409) while the courier shipment is active — status, stock and shipment untouched', async () => {
      routes['/create_order'] = createOk;
      // A product that tracks stock, so a restock would be visible.
      const tracked = (
        await request(server())
          .post(`/api/v1/stores/${alpha.storeId}/products`)
          .set(auth(alpha.token))
          .send({ name: 'Tracked Panjabi', slug: `tracked-${suffix}-${Date.now()}`, status: 'ACTIVE', basePrice: '900.00', trackInventory: true })
          .expect(201)
      ).body.data.id as string;
      await request(server()).post(`/api/v1/stores/${alpha.storeId}/inventory/adjust`).set(auth(alpha.token)).send({ productId: tracked, quantity: 5, type: 'ADJUSTMENT' }).expect((r) => expect([200, 201]).toContain(r.status));
      const placed = await request(server())
        .post(`/api/v1/public/stores/${alpha.storeSlug}/checkout`)
        .set('Idempotency-Key', `courier-cancel-${suffix}-${Date.now()}`)
        .send({
          items: [{ productId: tracked, quantity: 1 }],
          customer: { name: 'Rahim Uddin', phone: '01711000000' },
          shippingAddress: { name: 'Rahim Uddin', phone: '01711000000', addressLine1: 'House 7, Road 3', city: 'Dhaka', country: 'BD' },
          billingSameAsShipping: true,
          shippingMethodId: alpha.shippingMethodId,
          paymentProvider: 'COD',
          paymentMethod: 'CASH',
        })
        .expect(201);
      const order = await prisma.order.findFirstOrThrow({ where: { publicReference: placed.body.data.publicReference } });
      const stockBefore = await prisma.inventoryItem.findFirstOrThrow({ where: { productId: tracked } });
      const courier = (await book(alpha, order.id).expect(201)).body.data;

      const res = await cancel(alpha, order.id).expect(409);
      expect(res.body.error.code).toBe('ORDER_HAS_ACTIVE_COURIER_SHIPMENT');
      expect(res.body.error.message).toMatch(/active courier shipment/);
      const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(after).toMatchObject({ status: order.status, paymentStatus: order.paymentStatus });
      const stockAfter = await prisma.inventoryItem.findFirstOrThrow({ where: { productId: tracked } });
      expect(stockAfter.quantity).toBe(stockBefore.quantity);
      expect(stockAfter.reservedQuantity).toBe(stockBefore.reservedQuantity);
      expect(await prisma.shipment.findUniqueOrThrow({ where: { id: courier.id } })).toMatchObject({ status: 'LABEL_CREATED' });

      // Once Steadfast reports it cancelled, the order can be cancelled.
      routes['/status_by_cid'] = ok({ status: 200, delivery_status: 'cancelled' });
      await sync(alpha, order.id, courier.id).expect(201);
      await cancel(alpha, order.id).expect(200);
    });

    it('also while the booking is unconfirmed', async () => {
      const order = await placeOrder(alpha);
      routes['/create_order'] = async () => ({ status: 500, body: null });
      await book(alpha, order.id).expect(503);
      expect((await cancel(alpha, order.id).expect(409)).body.error.code).toBe('ORDER_HAS_ACTIVE_COURIER_SHIPMENT');
    });

    it('a DELIVERED courier sync never marks an already-cancelled order fulfilled (or touches payment)', async () => {
      const order = await placeOrder(alpha);
      const courier = (await book(alpha, order.id).expect(201)).body.data;
      // Simulate an order cancelled outside the guarded path (legacy data).
      await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
      const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      routes['/status_by_cid'] = ok({ status: 200, delivery_status: 'delivered' });
      expect((await sync(alpha, order.id, courier.id).expect(201)).body.data.status).toBe('DELIVERED');
      const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(after).toMatchObject({ status: 'CANCELLED', fulfillmentStatus: before.fulfillmentStatus, paymentStatus: before.paymentStatus });
    });
  });

  describe('status sync', () => {
    let orderId = '';
    let shipmentId = '';
    beforeAll(async () => {
      routes = { '/get_balance': balanceOk, '/create_order': createOk };
      const order = await placeOrder(alpha);
      orderId = order.id;
      shipmentId = (await book(alpha, order.id).expect(201)).body.data.id;
    });

    it('keeps the status and records an unknown courier status', async () => {
      routes['/status_by_cid'] = ok({ status: 200, delivery_status: 'unknown_approval_pending' });
      const res = await sync(alpha, orderId, shipmentId).expect(201);
      expect(res.body.data).toMatchObject({ status: 'LABEL_CREATED', providerStatus: 'unknown_approval_pending' });
      expect(calls.at(-1)!.url).toMatch(/\/status_by_cid\/\d+$/);
    });

    it.each([
      ['timeout', async () => { throw new SteadfastTransportError('timeout'); }, 503, 'COURIER_UNAVAILABLE'],
      ['5xx', async () => ({ status: 500, body: null }), 503, 'COURIER_UNAVAILABLE'],
      ['rate limit', async () => ({ status: 429, body: null }), 429, 'COURIER_RATE_LIMITED'],
      ['bad credentials', async () => ({ status: 401, body: null }), 422, 'COURIER_AUTH_FAILED'],
      ['unknown consignment', async () => ({ status: 200, body: { status: 404, message: 'Not found' } }), 404, 'COURIER_SHIPMENT_NOT_FOUND'],
    ])('reports a courier %s without changing the shipment', async (_label, handler, status, code) => {
      routes['/status_by_cid'] = handler as never;
      const res = await sync(alpha, orderId, shipmentId).expect(status);
      expect(res.body.error.code).toBe(code);
      expect(JSON.stringify(res.body)).not.toMatch(new RegExp(`${API_KEY}|${SECRET_KEY}`));
      expect((await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } })).status).toBe('LABEL_CREATED');
    });

    it('marks it delivered and the order fulfilled — payment status untouched', async () => {
      const before = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      routes['/status_by_cid'] = ok({ status: 200, delivery_status: 'delivered' });
      const res = await sync(alpha, orderId, shipmentId).expect(201);
      expect(res.body.data).toMatchObject({ status: 'DELIVERED', providerStatus: 'delivered' });
      const after = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(after.fulfillmentStatus).toBe('FULFILLED');
      expect(after.paymentStatus).toBe(before.paymentStatus);
      expect(after.status).toBe(before.status);

      const detail = await request(server()).get(`/api/v1/stores/${alpha.storeId}/orders/${orderId}/shipments/${shipmentId}`).set(auth(alpha.token)).expect(200);
      expect(detail.body.data.events.map((e: { providerStatus: string }) => e.providerStatus)).toEqual(['delivered', 'unknown_approval_pending', 'in_review']);
    });

    it('a delivered shipment never goes back on a stale courier answer', async () => {
      routes['/status_by_cid'] = ok({ status: 200, delivery_status: 'in_review' });
      expect((await sync(alpha, orderId, shipmentId).expect(201)).body.data.status).toBe('DELIVERED');
    });

    it('courier-managed shipments cannot be edited by hand', async () => {
      const res = await request(server())
        .patch(`/api/v1/stores/${alpha.storeId}/orders/${orderId}/shipments/${shipmentId}`)
        .set(auth(alpha.token))
        .send({ trackingNumber: 'HAND-EDIT' })
        .expect(409);
      expect(res.body.error.code).toBe('SHIPMENT_MANAGED_BY_COURIER');
    });

    it('another merchant cannot read or sync it', async () => {
      await sync(alpha, orderId, shipmentId, beta.token).expect(403);
      await request(server()).post(`/api/v1/stores/${beta.storeId}/orders/${orderId}/shipments/${shipmentId}/sync`).set(auth(beta.token)).expect(404);
      await request(server()).get(`/api/v1/stores/${beta.storeId}/orders/${orderId}/shipments/${shipmentId}`).set(auth(beta.token)).expect(404);
    });

    it('the order detail shows the courier booking', async () => {
      const res = await request(server()).get(`/api/v1/stores/${alpha.storeId}/orders/${orderId}`).set(auth(alpha.token)).expect(200);
      expect(res.body.data.shipments[0]).toMatchObject({ provider: 'STEADFAST', courierManaged: true, status: 'DELIVERED', providerStatus: 'in_review' });
    });
  });

  describe('disconnecting and secrets', () => {
    it('disconnect deletes the credentials; syncing then asks to reconnect', async () => {
      const shipment = await prisma.shipment.findFirstOrThrow({ where: { storeId: alpha.storeId, providerShipmentId: { not: null } } });
      await request(server()).delete(`/api/v1/stores/${alpha.storeId}/couriers/STEADFAST`).set(auth(alpha.token)).expect(200);
      expect(await prisma.courierConnection.count({ where: { storeId: alpha.storeId } })).toBe(0);
      expect((await sync(alpha, shipment.orderId, shipment.id).expect(422)).body.error.code).toBe('COURIER_NOT_CONNECTED');
      // The shipment and its history stay.
      expect(await prisma.shipment.count({ where: { id: shipment.id } })).toBe(1);
    });

    it('the keys never appeared in logs, audit records or any courier URL', async () => {
      expect(printed.join('')).not.toMatch(new RegExp(`${API_KEY}|${SECRET_KEY}`));
      const audit = await prisma.auditLog.findMany({ where: { storeId: alpha.storeId } });
      expect(JSON.stringify(audit)).not.toMatch(new RegExp(`${API_KEY}|${SECRET_KEY}`));
      for (const call of calls) expect(call.url).not.toMatch(new RegExp(`${API_KEY}|${SECRET_KEY}|apiKey|secret`, 'i'));
    });
  });
});
