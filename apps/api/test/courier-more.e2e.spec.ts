import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { CourierHttp } from '../src/modules/couriers/courier.http';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';

/**
 * Pathao, RedX, Paperfly and eCourier end to end: real API, database and
 * encryption; only the network calls to the couriers are replaced. Covers
 * connecting with each courier's own fields (secrets never returned), the
 * booking location pickers, booking with server-built parcel details and
 * status sync.
 */
describe('More couriers: Pathao, RedX, Paperfly, eCourier (e2e)', () => {
  jest.setTimeout(180_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const slug = `couriers-more-${suffix}`;
  const shop = { token: '', storeId: '', productId: '', shippingMethodId: '' };

  type Call = { method: string; url: string; headers?: Record<string, string>; body?: Record<string, unknown> };
  const calls: Call[] = [];
  let routes: Record<string, (call: Call) => { status: number; body: unknown }> = {};
  const courierHttp = {
    request: jest.fn(async (call: Call) => {
      calls.push(call);
      const path = new URL(call.url).pathname;
      const key = Object.keys(routes)
        .sort((a, b) => b.length - a.length)
        .find((k) => path.endsWith(k));
      if (!key) throw new Error(`unexpected courier call ${call.method} ${path}`);
      return routes[key]!(call);
    }),
  };
  let seq = Number(String(Date.now()).slice(-8));
  const defaultRoutes = (): typeof routes => ({
    // Pathao
    '/aladdin/api/v1/issue-token': () => ({ status: 200, body: { access_token: 'pathao-token', expires_in: 3600 } }),
    '/aladdin/api/v1/stores': () => ({ status: 200, body: { data: { data: [{ store_id: 4321, store_name: 'Main' }] } } }),
    '/aladdin/api/v1/orders': () => ({ status: 200, body: { code: 200, data: { consignment_id: `DL${(seq += 1)}`, order_status: 'Pending' } } }),
    // RedX
    '/areas': () => ({ status: 200, body: { areas: [{ id: 11, name: 'Dhanmondi', district_name: 'Dhaka' }] } }),
    '/parcel': () => ({ status: 201, body: { tracking_id: `RX${(seq += 1)}` } }),
    // Paperfly
    '/API-Order-Tracking': () => ({ status: 200, body: { response_code: 200, success: { trackingStatus: [] } } }),
    '/OrderPlacement': () => ({ status: 200, body: { response_code: 200, success: { message: 'ok', tracking_number: `PF${(seq += 1)}` } } }),
    // eCourier
    '/packages': () => ({ status: 200, body: [{ package_name: 'Next day', package_code: '#2505', shipping_charge: '60', coverage: 'Inside Dhaka' }] }),
    '/city-list': () => ({ status: 200, body: [{ name: 'Dhaka', value: 'Dhaka' }] }),
    '/order-place': () => ({ status: 200, body: { response_code: 200, message: 'Order Submitted', ID: `ECR${(seq += 1)}` } }),
  });

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${shop.token}` });
  const connect = (provider: string, body: Record<string, unknown>) =>
    request(server()).put(`/api/v1/stores/${shop.storeId}/couriers/${provider}`).set(auth()).send(body);
  const book = (orderId: string, body: Record<string, unknown>) =>
    request(server()).post(`/api/v1/stores/${shop.storeId}/orders/${orderId}/courier-shipments`).set(auth()).send(body);
  const options = (provider: string, step: string, picked: Record<string, string> = {}) =>
    request(server()).post(`/api/v1/stores/${shop.storeId}/couriers/${provider}/location-options`).set(auth()).send({ step, picked });

  let orderSeq = 0;
  async function placeOrder() {
    const res = await request(server())
      .post(`/api/v1/public/stores/${slug}/checkout`)
      .set('Idempotency-Key', `couriers-more-${suffix}-${(orderSeq += 1)}`)
      .send({
        items: [{ productId: shop.productId, quantity: 2 }],
        customer: { name: 'Rahim Uddin', phone: '01711000000', email: `buyer.${suffix}@example.com` },
        shippingAddress: { name: 'Rahim Uddin', phone: '01711000000', addressLine1: 'House 7, Road 3', city: 'Dhaka', country: 'BD', email: `buyer.${suffix}@example.com` },
        billingSameAsShipping: true,
        shippingMethodId: shop.shippingMethodId,
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
      })
      .expect(201);
    const order = await prisma.order.findFirstOrThrow({ where: { storeId: shop.storeId, publicReference: res.body.data.publicReference } });
    // Paperfly needs a thana and district on the address.
    await prisma.orderAddress.updateMany({ where: { orderId: order.id }, data: { districtName: 'Dhaka', upazilaName: 'Dhanmondi' } });
    return order;
  }
  const lastCall = (suffixPath: string) => [...calls].reverse().find((c) => new URL(c.url).pathname.endsWith(suffixPath))!;

  beforeAll(async () => {
    process.env.PAYMENT_SECRETS_ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(CourierHttp).useValue(courierHttp).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
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
    const reg = await request(server())
      .post('/api/v1/auth/register')
      .send({ email: `couriers.more.${suffix}@example.com`, password: 'SecurePass1', firstName: 'Courier', lastName: 'More' })
      .expect(201);
    shop.token = reg.body.data.accessToken;
    const onboarded = await request(server())
      .post('/api/v1/onboarding/store')
      .set(auth())
      .send(withPayment({ businessName: `Couriers ${suffix}`, tenantSlug: slug, storeName: 'Couriers More', storeSlug: slug }))
      .expect(201)
      .then(activateOnboarded(app));
    shop.storeId = onboarded.body.data.store.id;
    await prisma.store.update({ where: { id: shop.storeId }, data: { status: StoreStatus.ACTIVE, currency: 'BDT' } });
    shop.productId = (
      await request(server())
        .post(`/api/v1/stores/${shop.storeId}/products`)
        .set(auth())
        .send({ name: 'Panjabi', slug: `panjabi-${suffix}`, status: 'ACTIVE', basePrice: '600.00', trackInventory: false })
        .expect(201)
    ).body.data.id;
    shop.shippingMethodId = (
      await request(server())
        .post(`/api/v1/stores/${shop.storeId}/shipping-methods`)
        .set(auth())
        .send({ name: 'Free', type: 'FREE', price: '0', active: true })
        .expect(201)
    ).body.data.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    routes = defaultRoutes();
  });

  it('lists every API courier with what to enter, and returns no secrets once connected', async () => {
    const list = await request(server()).get(`/api/v1/stores/${shop.storeId}/couriers`).set(auth()).expect(200);
    const pathao = list.body.data.find((c: { provider: string }) => c.provider === 'PATHAO');
    expect(pathao.fields.map((f: { key: string }) => f.key)).toEqual(['clientId', 'clientSecret', 'username', 'password', 'storeId']);
    expect(list.body.data.find((c: { provider: string }) => c.provider === 'REDX').locationSteps).toEqual([{ key: 'area', label: 'RedX delivery area' }]);

    // Missing required fields are named before anything is sent to Pathao.
    const before = calls.length;
    await connect('PATHAO', { credentials: { clientId: 'cid' } }).expect(400);
    expect(calls.length).toBe(before);

    const res = await connect('PATHAO', {
      credentials: { clientId: 'cid-1', clientSecret: 'pathao-secret-1', username: 'me@shop.com', password: 'pathao-pass-1' },
    }).expect(200);
    // The first Pathao store is filled in; secret values never come back.
    expect(res.body.data).toMatchObject({ status: 'CONNECTED', settings: { clientId: 'cid-1', username: 'me@shop.com', storeId: '4321' } });
    expect(JSON.stringify(res.body)).not.toMatch(/pathao-secret-1|pathao-pass-1/);
    const row = await prisma.courierConnection.findFirstOrThrow({ where: { storeId: shop.storeId, provider: 'PATHAO' } });
    expect(row.encryptedCredentials).not.toMatch(/pathao-secret-1|pathao-pass-1/);

    // Changing only the password keeps the other saved values.
    await connect('PATHAO', { credentials: { password: 'pathao-pass-2' } }).expect(200);
    expect(lastCall('/issue-token').body).toMatchObject({ client_id: 'cid-1', client_secret: 'pathao-secret-1', password: 'pathao-pass-2' });
  });

  it('books a Pathao parcel with server-built details and syncs its status', async () => {
    const order = await placeOrder();
    const res = await book(order.id, { provider: 'PATHAO', weightKg: 1.5 }).expect(201);
    expect(res.body.data).toMatchObject({ provider: 'PATHAO', courierName: 'Pathao' });
    expect(lastCall('/aladdin/api/v1/orders').body).toMatchObject({
      store_id: 4321,
      recipient_phone: '01711000000',
      amount_to_collect: 1200,
      item_quantity: 2,
      item_weight: 1.5,
      item_description: 'Panjabi x2',
    });

    const consignment = res.body.data.trackingNumber as string;
    routes[`/aladdin/api/v1/orders/${consignment}`] = () => ({ status: 200, body: { data: { order_status: 'Delivered' } } });
    const synced = await request(server())
      .post(`/api/v1/stores/${shop.storeId}/orders/${order.id}/shipments/${res.body.data.id}/sync`)
      .set(auth())
      .expect(201);
    expect(synced.body.data.status).toBe('DELIVERED');
  });

  it('RedX: lists areas for the picker; refuses a booking without an area and leaves the order free', async () => {
    await connect('REDX', { credentials: { accessToken: 'redx-token-1' } }).expect(200);
    const areas = await options('REDX', 'area').expect(200);
    expect(areas.body.data).toEqual([{ value: '11', label: 'Dhanmondi (Dhaka)' }]);
    await options('REDX', 'nope').expect(400);

    const order = await placeOrder();
    await book(order.id, { provider: 'REDX' }).expect(422);
    expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(0);
    const res = await book(order.id, { provider: 'REDX', location: { area: '11', bogus: 'x' } }).expect(201);
    expect(res.body.data.trackingNumber).toMatch(/^RX/);
    expect(lastCall('/parcel').body).toMatchObject({ delivery_area: 'Dhanmondi', delivery_area_id: 11, cash_collection_amount: '1200' });
  });

  it('Paperfly: needs pickup details, then books with the order thana and district', async () => {
    await connect('PAPERFLY', {
      credentials: { username: 'pf-user', password: 'pf-pass-1', paperflyKey: 'pf-key-1', pickupThana: 'Mirpur', pickupDistrict: 'Dhaka' },
    }).expect(200);
    const order = await placeOrder();
    await book(order.id, { provider: 'PAPERFLY' }).expect(422);
    await connect('PAPERFLY', { pickupName: 'Couriers More', pickupPhone: '01811000000', pickupAddress: 'Mirpur 10, Dhaka' }).expect(200);
    const res = await book(order.id, { provider: 'PAPERFLY' }).expect(201);
    expect(res.body.data.trackingNumber).toMatch(/^PF/);
    expect(lastCall('/OrderPlacement').body).toMatchObject({ customerThana: 'Dhanmondi', customerDistrict: 'Dhaka', pickMerchantThana: 'Mirpur', packagePrice: '1200' });
  });

  it('eCourier: walks the location steps and books with the picked places', async () => {
    await connect('ECOURIER', { credentials: { userId: 'ec-user', apiKey: 'ec-key-1', apiSecret: 'ec-secret-1' } }).expect(200);
    expect((await options('ECOURIER', 'package').expect(200)).body.data[0].value).toBe('#2505');
    expect((await options('ECOURIER', 'city').expect(200)).body.data).toEqual([{ value: 'Dhaka', label: 'Dhaka' }]);
    const order = await placeOrder();
    const location = { package: '#2505', city: 'Dhaka', thana: 'Dhanmondi', postcode: '1209', area: 'Dhanmondi 27' };
    const res = await book(order.id, { provider: 'ECOURIER', location }).expect(201);
    expect(res.body.data.trackingNumber).toMatch(/^ECR/);
    expect(lastCall('/order-place').headers).toEqual({ 'USER-ID': 'ec-user', 'API-KEY': 'ec-key-1', 'API-SECRET': 'ec-secret-1' });
    expect(lastCall('/order-place').body).toMatchObject({ recipient_thana: 'Dhanmondi', recipient_zip: '1209', package_code: '#2505', product_price: 1200, payment_method: 'COD' });
  });
});
