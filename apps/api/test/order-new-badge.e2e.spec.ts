import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';

/**
 * New orders: the Orders badge counts orders nobody on the team has opened,
 * opening one counts it as seen, and guest orders show the shopper's name.
 */
describe('New-order badge and guest names (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  type Shop = { key: string; token: string; storeId: string; slug: string; productId: string; methodId: string };
  const A: Shop = { key: 'a', token: '', storeId: '', slug: `badge-a-${suffix}`, productId: '', methodId: '' };
  const B: Shop = { key: 'b', token: '', storeId: '', slug: `badge-b-${suffix}`, productId: '', methodId: '' };
  let seq = 0;

  const http = () => request(app.getHttpServer());
  const auth = (s: Shop) => ({ Authorization: `Bearer ${s.token}` });
  const count = async (s: Shop) =>
    (await http().get(`/api/v1/stores/${s.storeId}/orders/unviewed-count`).set(auth(s)).expect(200)).body.data.count as number;

  async function open(s: Shop) {
    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email: `badge.${s.key}.${suffix}@example.com`, password: 'SecurePass1', firstName: 'B', lastName: 'G' })
      .expect(201);
    s.token = reg.body.data.accessToken;
    s.storeId = (
      await http()
        .post('/api/v1/onboarding/store')
        .set(auth(s))
        .send(withPayment({ planSlug: 'starter', businessName: `Badge ${s.key}`, tenantSlug: `${s.slug}-t`, storeName: `Badge ${s.key}`, storeSlug: s.slug }))
        .expect(201)
        .then(activateOnboarded(app))
    ).body.data.store.id;
    s.productId = (
      await http()
        .post(`/api/v1/stores/${s.storeId}/products`)
        .set(auth(s))
        .send({ name: 'Saree', slug: `saree-${s.key}-${suffix}`, status: 'ACTIVE', basePrice: '900.00', trackInventory: false })
        .expect(201)
    ).body.data.id;
    // Starter stores start with store-wide delivery methods.
    s.methodId = (await prisma.shippingMethod.findFirstOrThrow({ where: { storeId: s.storeId }, orderBy: { sortOrder: 'asc' } })).id;
  }

  async function guestOrder(s: Shop, name: string, phone: string) {
    const res = await http()
      .post(`/api/v1/public/stores/${s.slug}/checkout`)
      .set('Idempotency-Key', `badge-${suffix}-${(seq += 1)}`)
      .send({
        items: [{ productId: s.productId, quantity: 1 }],
        customer: { name, phone },
        shippingAddress: { name, phone, addressLine1: 'House 3, Road 9', city: 'Dhaka', country: 'BD' },
        billingSameAsShipping: true,
        shippingMethodId: s.methodId,
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
      })
      .expect(201);
    return prisma.order.findFirstOrThrow({ where: { storeId: s.storeId, publicReference: res.body.data.publicReference } });
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
    const redis = app.get(RedisService);
    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }
    await open(A);
    await open(B);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('counts new orders, drops by one when an order is opened, and never below what is unseen', async () => {
    expect(await count(A)).toBe(0);
    const orders = [];
    for (let i = 1; i <= 5; i += 1) orders.push(await guestOrder(A, `Shopper ${i}`, `0171100000${i}`));
    expect(await count(A)).toBe(5);

    await http().post(`/api/v1/stores/${A.storeId}/orders/${orders[0]!.id}/viewed`).set(auth(A)).expect(200);
    expect(await count(A)).toBe(4);
    // Opening the same order again changes nothing.
    await http().post(`/api/v1/stores/${A.storeId}/orders/${orders[0]!.id}/viewed`).set(auth(A)).expect(200);
    expect(await count(A)).toBe(4);
    const seenAt = (await prisma.order.findUniqueOrThrow({ where: { id: orders[0]!.id } })).merchantViewedAt;
    expect(seenAt).not.toBeNull();

    await http().post(`/api/v1/stores/${A.storeId}/orders/${orders[1]!.id}/viewed`).set(auth(A)).expect(200);
    expect(await count(A)).toBe(3);
    // Another store is not affected, and cannot see or mark A's orders.
    expect(await count(B)).toBe(0);
    await http().post(`/api/v1/stores/${B.storeId}/orders/${orders[2]!.id}/viewed`).set(auth(B)).expect(404);
    await http().get(`/api/v1/stores/${A.storeId}/orders/unviewed-count`).set(auth(B)).expect(403);
    await http().post(`/api/v1/stores/${A.storeId}/orders/${orders[2]!.id}/viewed`).set(auth(B)).expect(403);
    expect(await count(A)).toBe(3);
  });

  it("lists a guest order with the shopper's name and phone, and marks unseen orders", async () => {
    const order = await guestOrder(A, 'Rahima Akter', '01811222333');
    const list = (await http().get(`/api/v1/stores/${A.storeId}/orders?limit=50`).set(auth(A)).expect(200)).body.data.items;
    const row = list.find((item: { id: string }) => item.id === order.id);
    expect(row).toMatchObject({ customer: null, viewed: false, contact: { name: 'Rahima Akter', phone: '01811222333' } });
    await http().post(`/api/v1/stores/${A.storeId}/orders/${order.id}/viewed`).set(auth(A)).expect(200);
    const again = (await http().get(`/api/v1/stores/${A.storeId}/orders?limit=50`).set(auth(A)).expect(200)).body.data.items;
    expect(again.find((item: { id: string }) => item.id === order.id)).toMatchObject({ viewed: true });
  });
});
