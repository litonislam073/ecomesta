import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PlatformRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  DOMAIN_REGISTRAR,
  RegistrarError,
  type DomainAvailability,
  type DomainRegistrar,
  type RegistrantContact,
} from '../src/modules/domain-sales/dynadot.client';
import { DOMAIN_SALES_SETTINGS_KEY } from '../src/modules/domain-sales/domain-sales-settings';
import { activateOnboarded, uniqueTransactionId, withPayment } from './support/onboarding';

/** A registrar that never leaves the test: names with "taken" are taken, "gold" is premium. */
class FakeRegistrar implements DomainRegistrar {
  readonly mode = 'sandbox' as const;
  registered = new Set<string>();
  contacts: RegistrantContact[] = [];
  dns: string[] = [];
  renewals: string[] = [];
  failNextRegister = false;

  async search(domain: string): Promise<DomainAvailability> {
    const taken = domain.includes('taken') || this.registered.has(domain);
    return { domain, available: !taken, premium: domain.includes('gold'), registerUsd: taken ? null : 10.99, renewUsd: taken ? null : 12.5 };
  }
  async createContact(contact: RegistrantContact) {
    this.contacts.push(contact);
    return '9001';
  }
  async register(domain: string) {
    if (this.failNextRegister) {
      this.failNextRegister = false;
      throw new RegistrarError('not enough account balance');
    }
    this.registered.add(domain);
    return { expiresAt: new Date('2027-11-20T00:00:00Z') };
  }
  async renew(domain: string) {
    this.renewals.push(domain);
    return { expiresAt: new Date('2029-11-20T00:00:00Z') };
  }
  async pointToPlatform(domain: string) {
    this.dns.push(domain);
  }
  async balanceUsd() {
    return 42;
  }
}

describe('Domain sales (e2e)', () => {
  jest.setTimeout(180_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const registrar = new FakeRegistrar();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const label = `ecomtest${suffix}`;
  const merchant = { token: '', storeId: '', tenantId: '' };
  const outsider = { token: '' };
  const admin = { token: '', userId: '' };
  let savedSettings: unknown = undefined;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const registrant = { name: 'Test Merchant', email: `dom.${suffix}@example.com`, phone: '01712345678', address: 'House 1, Road 2', city: 'Dhaka', postcode: '1207' };
  const order = (domain: string, transactionId = uniqueTransactionId(), years = 1, token = merchant.token) =>
    http()
      .post(`/api/v1/stores/${merchant.storeId}/domain-sales/orders`)
      .set(auth(token))
      .send({ domain, years, registrant, method: 'BKASH', senderNumber: '01712345678', transactionId });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 60 }) })
      .overrideProvider(DOMAIN_REGISTRAR)
      .useValue(registrar)
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
    for (const pattern of ['auth:rl:*', 'rl:*', 'domain-sales:search:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }
    savedSettings = (await prisma.platformSetting.findUnique({ where: { key: DOMAIN_SALES_SETTINGS_KEY } }))?.value;
    await prisma.platformSetting.deleteMany({ where: { key: DOMAIN_SALES_SETTINGS_KEY } });

    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email: `dom.m.${suffix}@example.com`, password: 'SecurePass1', firstName: 'D', lastName: 'M' })
      .expect(201);
    merchant.token = reg.body.data.accessToken;
    const store = (
      await http()
        .post('/api/v1/onboarding/store')
        .set(auth(merchant.token))
        .send(withPayment({ planSlug: 'starter', businessName: 'Dom shop', tenantSlug: `dom-${suffix}-t`, storeName: 'Dom shop', storeSlug: `dom-${suffix}` }))
        .expect(201)
        .then(activateOnboarded(app))
    ).body.data.store;
    merchant.storeId = store.id;
    merchant.tenantId = (await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).tenantId;

    const other = await http()
      .post('/api/v1/auth/register')
      .send({ email: `dom.o.${suffix}@example.com`, password: 'SecurePass1', firstName: 'O', lastName: 'X' })
      .expect(201);
    outsider.token = other.body.data.accessToken;

    const sa = await http()
      .post('/api/v1/auth/register')
      .send({ email: `dom.a.${suffix}@example.com`, password: 'SecurePass1', firstName: 'S', lastName: 'A' })
      .expect(201);
    admin.token = sa.body.data.accessToken;
    admin.userId = sa.body.data.user.id;
    await prisma.user.update({ where: { id: admin.userId }, data: { platformRole: PlatformRole.SUPER_ADMIN } });
  });

  afterAll(async () => {
    if (prisma && merchant.tenantId) {
      await prisma.domainOrder.deleteMany({ where: { tenantId: merchant.tenantId } });
      await prisma.registeredDomain.deleteMany({ where: { tenantId: merchant.tenantId } });
      await prisma.domain.deleteMany({ where: { storeId: merchant.storeId, hostname: { contains: label } } });
    }
    if (prisma) {
      await prisma.platformSetting.deleteMany({ where: { key: DOMAIN_SALES_SETTINGS_KEY } });
      if (savedSettings !== undefined && savedSettings !== null) {
        await prisma.platformSetting.create({ data: { key: DOMAIN_SALES_SETTINGS_KEY, value: savedSettings as object } });
      }
    }
    await app?.close();
  });

  it('searches every offered extension with taka prices (USD × 125, rounded up to ৳10, + ৳250)', async () => {
    const res = await http().get('/api/v1/public/domains/search').query({ q: `${label}.shop` }).expect(200);
    const results = res.body.data.results as { domain: string; available: boolean; priceBdt: number | null; renewBdt: number | null }[];
    expect(results[0]!.domain).toBe(`${label}.shop`);
    expect(results.map((r) => r.domain)).toContain(`${label}.com`);
    // 10.99 × 125 = 1373.75 → 1380 + 250
    expect(results[0]).toMatchObject({ available: true, priceBdt: 1630 });
    // 12.5 × 125 = 1562.5 → 1570 + 250
    expect(results[0]!.renewBdt).toBe(1820);

    const taken = await http().get('/api/v1/public/domains/search').query({ q: `taken${suffix}` }).expect(200);
    expect(taken.body.data.results.every((r: { available: boolean; priceBdt: null }) => !r.available && r.priceBdt === null)).toBe(true);
    await http().get('/api/v1/public/domains/search').query({ q: '-' }).expect(400);
  });

  it('refuses unknown extensions, taken or premium names, and other businesses', async () => {
    await order(`${label}.museum`).expect(400);
    await order(`taken${suffix}.com`).expect(409);
    await order(`gold${suffix}.com`).expect(409);
    await order(`${label}.com`, uniqueTransactionId(), 1, outsider.token).expect(403);
    await order(`${label}.com`, uniqueTransactionId(), 9).expect(400);
  });

  it('orders a domain: priced on the server, pending, one order per name and per transaction', async () => {
    const trx = uniqueTransactionId();
    const res = await order(`${label}.com`, trx, 2).expect(201);
    expect(res.body.data).toMatchObject({ kind: 'REGISTER', domain: `${label}.com`, years: 2, amount: '3260.00', status: 'PENDING' });
    await order(`${label}.com`).expect(409);
    expect((await order(`${label}.net`, trx).expect(409)).body.error.message).toMatch(/already been submitted/);
    // Nor can the same transaction pay for a theme.
    const shopease = await prisma.theme.findFirstOrThrow({ where: { slug: 'shopease' } });
    await http()
      .post(`/api/v1/stores/${merchant.storeId}/themes/${shopease.id}/purchase`)
      .set(auth(merchant.token))
      .send({ method: 'BKASH', senderNumber: '01712345678', transactionId: trx })
      .expect(409);

    const list = await http().get(`/api/v1/stores/${merchant.storeId}/domain-sales`).set(auth(merchant.token)).expect(200);
    expect(list.body.data.orders[0]).toMatchObject({ domain: `${label}.com`, status: 'PENDING' });
    expect(list.body.data.domains).toEqual([]);
  });

  it('only a Super Admin reviews orders', async () => {
    await http().get('/api/v1/admin/domain-sales/orders').set(auth(merchant.token)).expect(403);
    const list = await http().get('/api/v1/admin/domain-sales/orders').query({ status: 'PENDING' }).set(auth(admin.token)).expect(200);
    const row = list.body.data.items.find((o: { domain: string }) => o.domain === `${label}.com`);
    expect(row).toMatchObject({ costUsd: '21.98', usdRate: '125.00', marginBdt: '250.00', registrant: { name: 'Test Merchant' } });
    const balance = await http().get('/api/v1/admin/domain-sales/balance').set(auth(admin.token)).expect(200);
    expect(balance.body.data).toEqual({ mode: 'sandbox', balanceUsd: 42 });
  });

  it('a registrar failure leaves the order FAILED with the reason; a retry registers and connects it', async () => {
    const id = (await prisma.domainOrder.findFirstOrThrow({ where: { domainName: `${label}.com` } })).id;
    registrar.failNextRegister = true;
    const failed = await http().post(`/api/v1/admin/domain-sales/orders/${id}/approve`).set(auth(admin.token)).expect(200);
    expect(failed.body.data).toMatchObject({ status: 'FAILED', failureReason: 'not enough account balance' });
    // The merchant sees a calm message, not the registrar's.
    const mine = await http().get(`/api/v1/stores/${merchant.storeId}/domain-sales`).set(auth(merchant.token)).expect(200);
    expect(mine.body.data.orders[0].failureReason).not.toMatch(/balance/);

    const done = await http().post(`/api/v1/admin/domain-sales/orders/${id}/approve`).set(auth(admin.token)).expect(200);
    expect(done.body.data).toMatchObject({ status: 'COMPLETED' });
    expect(registrar.contacts.at(-1)).toMatchObject({ phone: '1712345678', phoneCountryCode: '880', country: 'BD' });
    expect(registrar.dns).toContain(`${label}.com`);
    // Approving again changes nothing.
    await http().post(`/api/v1/admin/domain-sales/orders/${id}/approve`).set(auth(admin.token)).expect(200);
    expect([...registrar.registered].filter((d) => d === `${label}.com`)).toHaveLength(1);

    const storeDomain = await prisma.domain.findUnique({ where: { hostname: `${label}.com` } });
    expect(storeDomain).toMatchObject({ storeId: merchant.storeId, status: 'ACTIVE', type: 'CUSTOM_DOMAIN' });
    const mineNow = await http().get(`/api/v1/stores/${merchant.storeId}/domain-sales`).set(auth(merchant.token)).expect(200);
    expect(mineNow.body.data.domains[0]).toMatchObject({ name: `${label}.com`, expiresAt: '2027-11-20T00:00:00.000Z', renewBdt: 1820 });
    await order(`${label}.com`).expect(409);
  });

  it('renews a bought domain after approval', async () => {
    const domain = await prisma.registeredDomain.findUniqueOrThrow({ where: { name: `${label}.com` } });
    const renew = (transactionId = uniqueTransactionId()) =>
      http()
        .post(`/api/v1/stores/${merchant.storeId}/domain-sales/${domain.id}/renew`)
        .set(auth(merchant.token))
        .send({ years: 2, method: 'NAGAD', senderNumber: '01812345678', transactionId });
    const res = await renew().expect(201);
    expect(res.body.data).toMatchObject({ kind: 'RENEW', amount: '3640.00', status: 'PENDING' });
    await renew().expect(409);
    await http().post(`/api/v1/admin/domain-sales/orders/${res.body.data.id}/approve`).set(auth(admin.token)).expect(200);
    expect(registrar.renewals).toContain(`${label}.com`);
    expect((await prisma.registeredDomain.findUniqueOrThrow({ where: { id: domain.id } })).expiresAt.toISOString()).toBe('2029-11-20T00:00:00.000Z');
  });

  it('a rejected order cannot be approved; settings change prices and can switch sales off', async () => {
    const res = await order(`${label}.net`).expect(201);
    await http()
      .post(`/api/v1/admin/domain-sales/orders/${res.body.data.id}/reject`)
      .set(auth(admin.token))
      .send({ reason: 'No payment received' })
      .expect(200);
    await http().post(`/api/v1/admin/domain-sales/orders/${res.body.data.id}/approve`).set(auth(admin.token)).expect(409);

    await http().patch('/api/v1/admin/domain-sales/settings').set(auth(admin.token)).send({ usdRate: 120, marginBdt: 300 }).expect(200);
    const priced = await http().get('/api/v1/public/domains/search').query({ q: `${label}x.com` }).expect(200);
    // 10.99 × 120 = 1318.8 → 1320 + 300
    expect(priced.body.data.results[0].priceBdt).toBe(1620);

    await http().patch('/api/v1/admin/domain-sales/settings').set(auth(admin.token)).send({ enabled: false }).expect(200);
    await http().get('/api/v1/public/domains/search').query({ q: label }).expect(503);
  });
});
