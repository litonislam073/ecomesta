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
 * Manual payments: a store switches Cash on delivery, bank transfer and "other
 * payment" on or off in Payment providers; checkout offers and accepts only
 * the ones on, and a store can never switch off every way to pay.
 */
describe('Manual payment options (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const shop = { token: '', storeId: '', slug: `manual-pay-${suffix}`, productId: '', methodId: '' };
  let seq = 0;

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${shop.token}` });
  const settings = (body: Record<string, unknown>) =>
    http().patch(`/api/v1/stores/${shop.storeId}/settings`).set(auth()).send(body);
  const offline = async () =>
    (await http().get(`/api/v1/public/stores/${shop.slug}/payment-providers`).expect(200)).body.data.offline as {
      provider: string;
      method: string;
      details: string | null;
    }[];
  const checkout = (paymentProvider: string, paymentMethod: string) =>
    http()
      .post(`/api/v1/public/stores/${shop.slug}/checkout`)
      .set('Idempotency-Key', `manual-pay-${suffix}-${(seq += 1)}`)
      .send({
        items: [{ productId: shop.productId, quantity: 1 }],
        customer: { name: 'Shopper', phone: '01711000000' },
        shippingAddress: { name: 'Shopper', phone: '01711000000', addressLine1: 'House 1', city: 'Dhaka', country: 'BD' },
        billingSameAsShipping: true,
        shippingMethodId: shop.methodId,
        paymentProvider,
        paymentMethod,
      });

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
    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email: `manual.pay.${suffix}@example.com`, password: 'SecurePass1', firstName: 'M', lastName: 'P' })
      .expect(201);
    shop.token = reg.body.data.accessToken;
    shop.storeId = (
      await http()
        .post('/api/v1/onboarding/store')
        .set(auth())
        .send(withPayment({ planSlug: 'starter', businessName: 'Manual Pay', tenantSlug: `${shop.slug}-t`, storeName: 'Manual Pay', storeSlug: shop.slug }))
        .expect(201)
        .then(activateOnboarded(app))
    ).body.data.store.id;
    shop.productId = (
      await http()
        .post(`/api/v1/stores/${shop.storeId}/products`)
        .set(auth())
        .send({ name: 'Lungi', slug: `lungi-${suffix}`, status: 'ACTIVE', basePrice: '400.00', trackInventory: false })
        .expect(201)
    ).body.data.id;
    shop.methodId = (await prisma.shippingMethod.findFirstOrThrow({ where: { storeId: shop.storeId }, orderBy: { sortOrder: 'asc' } })).id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('starts with all three on, exactly as checkout behaved before', async () => {
    const res = await http().get(`/api/v1/stores/${shop.storeId}/settings`).set(auth()).expect(200);
    expect(res.body.data).toMatchObject({ paymentCodEnabled: true, paymentBankTransferEnabled: true, paymentOtherEnabled: true });
    expect((await offline()).map((o) => `${o.provider}/${o.method}`)).toEqual(['COD/CASH', 'OTHER/BANK_TRANSFER', 'OTHER/OTHER']);
  });

  it('offers only Cash on delivery once the others are off, and refuses the others at checkout', async () => {
    await settings({ paymentBankTransferEnabled: false, paymentOtherEnabled: false }).expect(200);
    expect((await offline()).map((o) => `${o.provider}/${o.method}`)).toEqual(['COD/CASH']);

    const bank = await checkout('OTHER', 'BANK_TRANSFER').expect(422);
    expect(bank.body.error.code).toBe('PAYMENT_OPTION_UNAVAILABLE');
    await checkout('OTHER', 'OTHER').expect(422);
    await checkout('COD', 'CASH').expect(201);
    const audit = await prisma.auditLog.findFirst({ where: { storeId: shop.storeId, action: 'STORE_SETTINGS_UPDATED' }, orderBy: { createdAt: 'desc' } });
    expect((audit?.metadata as { groups?: string[] }).groups).toEqual(['payments']);
  });

  it('shows the bank details the store entered to shoppers', async () => {
    await settings({ paymentBankTransferEnabled: true, paymentBankTransferDetails: '  Dutch-Bangla Bank\nA/C 123 456 7890  ' }).expect(200);
    const bank = (await offline()).find((o) => o.method === 'BANK_TRANSFER');
    expect(bank).toMatchObject({ provider: 'OTHER', details: 'Dutch-Bangla Bank\nA/C 123 456 7890' });
    await checkout('OTHER', 'BANK_TRANSFER').expect(201);
    await settings({ paymentBankTransferDetails: '<script>x</script>' }).expect(400);
  });

  it('refuses to switch off the last way to pay — in settings and in online providers', async () => {
    await settings({ paymentBankTransferEnabled: false }).expect(200);
    const refused = await settings({ paymentCodEnabled: false }).expect(422);
    expect(refused.body.error.code).toBe('PAYMENT_OPTION_REQUIRED');
    expect((await offline()).map((o) => o.provider)).toEqual(['COD']);

    // With an online provider on, Cash on delivery may go too…
    await http()
      .post(`/api/v1/stores/${shop.storeId}/payment-providers`)
      .set(auth())
      .send({ provider: 'TEST', enabled: true, mode: 'test', publicConfig: { label: 'Test' }, secrets: { webhookSecret: `whsec_${suffix}` } })
      .expect((r) => expect([200, 201]).toContain(r.status));
    await settings({ paymentCodEnabled: false }).expect(200);
    expect(await offline()).toEqual([]);
    await checkout('COD', 'CASH').expect(422);
    // …but then that provider is the last way to pay and cannot be switched off.
    const last = await http()
      .post(`/api/v1/stores/${shop.storeId}/payment-providers`)
      .set(auth())
      .send({ provider: 'TEST', enabled: false, mode: 'test' });
    expect(last.status).toBe(422);
    expect(last.body.error.code).toBe('PAYMENT_OPTION_REQUIRED');
    // Turning Cash on delivery back on frees it again.
    await settings({ paymentCodEnabled: true }).expect(200);
    await http()
      .post(`/api/v1/stores/${shop.storeId}/payment-providers`)
      .set(auth())
      .send({ provider: 'TEST', enabled: false, mode: 'test' })
      .expect((r) => expect([200, 201]).toContain(r.status));
  });
});
