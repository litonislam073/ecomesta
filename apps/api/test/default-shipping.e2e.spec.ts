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
 * A new store starts with ready-made delivery charges the merchant can edit or
 * delete: zones on plans that include them, store-wide methods on Starter.
 */
describe('Default shipping for new stores (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  type Shop = { key: string; plan: string; token: string; storeId: string; slug: string; productId: string };
  const business: Shop = { key: 'biz', plan: 'business', token: '', storeId: '', slug: `ship-biz-${suffix}`, productId: '' };
  const starter: Shop = { key: 'sta', plan: 'starter', token: '', storeId: '', slug: `ship-sta-${suffix}`, productId: '' };

  const http = () => request(app.getHttpServer());
  const auth = (s: Shop) => ({ Authorization: `Bearer ${s.token}` });

  async function open(s: Shop, activate: boolean) {
    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email: `ship.${s.key}.${suffix}@example.com`, password: 'SecurePass1', firstName: 'S', lastName: 'H' })
      .expect(201);
    s.token = reg.body.data.accessToken;
    const onboard = http()
      .post('/api/v1/onboarding/store')
      .set(auth(s))
      .send(withPayment({ planSlug: s.plan, businessName: `Ship ${s.key}`, tenantSlug: `${s.slug}-t`, storeName: `Ship ${s.key}`, storeSlug: s.slug }))
      .expect(201);
    s.storeId = (await (activate ? onboard.then(activateOnboarded(app)) : onboard)).body.data.store.id;
    s.productId = (
      await http()
        .post(`/api/v1/stores/${s.storeId}/products`)
        .set(auth(s))
        .send({ name: 'Shirt', slug: `shirt-${s.key}-${suffix}`, status: 'ACTIVE', basePrice: '500.00', trackInventory: false })
        .expect(201)
    ).body.data.id;
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
    await open(business, true);
    await open(starter, false);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('gives a plan with delivery zones a Dhaka City and an Outside Dhaka zone, each with its method', async () => {
    const zones = (await http().get(`/api/v1/stores/${business.storeId}/shipping-zones`).set(auth(business)).expect(200)).body.data;
    const list = Array.isArray(zones) ? zones : zones.items;
    expect(list.map((z: { name: string }) => z.name).sort()).toEqual(['Dhaka City', 'Outside Dhaka']);
    const dhaka = await prisma.shippingZone.findFirstOrThrow({ where: { storeId: business.storeId, name: 'Dhaka City' }, include: { locations: { include: { district: true } }, methods: true } });
    expect(dhaka.priority).toBeGreaterThan(0);
    expect(dhaka.locations.map((l) => l.district?.name)).toEqual(['Dhaka']);
    expect(dhaka.methods.map((m) => [m.price.toFixed(2), m.freeShippingThreshold?.toFixed(2), m.codAllowed])).toEqual([['60.00', '2000.00', true]]);
    const outside = await prisma.shippingZone.findFirstOrThrow({ where: { storeId: business.storeId, name: 'Outside Dhaka' }, include: { locations: true, methods: true } });
    expect(outside.locations).toHaveLength(8);
    expect(outside.methods.map((m) => [m.price.toFixed(2), m.freeShippingThreshold?.toFixed(2)])).toEqual([['120.00', '3000.00']]);
  });

  it('charges ৳60 in Dhaka and ৳120 elsewhere at checkout, free above the threshold', async () => {
    const dhakaDistrict = await prisma.bdDistrict.findFirstOrThrow({ where: { code: 'DHAKA_DHAKA' } });
    const ctg = await prisma.bdDivision.findFirstOrThrow({ where: { code: 'CHATTOGRAM' } });
    const ctgDistrict = await prisma.bdDistrict.findFirstOrThrow({ where: { divisionId: ctg.id } });
    const quote = (location: Record<string, string>, quantity = 1) =>
      http().post(`/api/v1/public/stores/${business.slug}/shipping/quote`).send({ ...location, items: [{ productId: business.productId, quantity }] }).expect(201);

    const inDhaka = (await quote({ divisionId: dhakaDistrict.divisionId, districtId: dhakaDistrict.id })).body.data;
    expect(inDhaka.zone.name).toBe('Dhaka City');
    expect(inDhaka.methods.map((m: { amount: string }) => m.amount)).toEqual(['60.00']);
    const outside = (await quote({ divisionId: ctg.id, districtId: ctgDistrict.id })).body.data;
    expect(outside.zone.name).toBe('Outside Dhaka');
    expect(outside.methods.map((m: { amount: string }) => m.amount)).toEqual(['120.00']);
    const free = (await quote({ divisionId: dhakaDistrict.divisionId, districtId: dhakaDistrict.id }, 4)).body.data;
    expect(free.methods[0]).toMatchObject({ amount: '0.00', freeShippingApplied: true });
  });

  it('lets the merchant edit and delete the ready-made zones and methods', async () => {
    const zones = await prisma.shippingZone.findMany({ where: { storeId: business.storeId }, include: { methods: true } });
    const dhaka = zones.find((z) => z.name === 'Dhaka City')!;
    await http()
      .patch(`/api/v1/stores/${business.storeId}/shipping-methods/${dhaka.methods[0]!.id}`)
      .set(auth(business))
      .send({ price: '70.00' })
      .expect(200);
    expect((await prisma.shippingMethod.findUniqueOrThrow({ where: { id: dhaka.methods[0]!.id } })).price.toFixed(2)).toBe('70.00');
    await http().patch(`/api/v1/stores/${business.storeId}/shipping-zones/${dhaka.id}`).set(auth(business)).send({ name: 'Dhaka Metro' }).expect(200);
    const outside = zones.find((z) => z.name === 'Outside Dhaka')!;
    await http().delete(`/api/v1/stores/${business.storeId}/shipping-methods/${outside.methods[0]!.id}`).set(auth(business)).expect((r) => expect([200, 204]).toContain(r.status));
    await http().delete(`/api/v1/stores/${business.storeId}/shipping-zones/${outside.id}`).set(auth(business)).expect((r) => expect([200, 204]).toContain(r.status));
    expect((await prisma.shippingZone.findMany({ where: { storeId: business.storeId } })).map((z) => z.name)).toEqual(['Dhaka Metro']);
  });

  it('gives Starter (no delivery zones) two store-wide methods the customer chooses from — no zones', async () => {
    expect(await prisma.shippingZone.count({ where: { storeId: starter.storeId } })).toBe(0);
    const methods = await prisma.shippingMethod.findMany({ where: { storeId: starter.storeId }, orderBy: { sortOrder: 'asc' } });
    expect(methods.map((m) => [m.name, m.price.toFixed(2), m.freeShippingThreshold?.toFixed(2), m.zoneId])).toEqual([
      ['Inside Dhaka', '60.00', '2000.00', null],
      ['Outside Dhaka', '120.00', '3000.00', null],
    ]);
    const listed = (await http().get(`/api/v1/stores/${starter.storeId}/shipping-methods`).set(auth(starter)).expect(200)).body.data;
    expect((Array.isArray(listed) ? listed : listed.items).length).toBe(2);
    // Still the merchant's to change.
    await http().patch(`/api/v1/stores/${starter.storeId}/shipping-methods/${methods[1]!.id}`).set(auth(starter)).send({ price: '130.00' }).expect(200);
    await http().delete(`/api/v1/stores/${starter.storeId}/shipping-methods/${methods[0]!.id}`).set(auth(starter)).expect((r) => expect([200, 204]).toContain(r.status));
    expect(await prisma.shippingMethod.count({ where: { storeId: starter.storeId } })).toBe(1);
  });
});
