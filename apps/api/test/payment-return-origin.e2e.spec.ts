jest.mock('stripe', () => {
  const constructEvent = jest.fn();
  const sessionsCreate = jest.fn();
  const balanceRetrieve = jest.fn();
  const StripeMock = jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: sessionsCreate } },
    webhooks: { constructEvent },
    balance: { retrieve: balanceRetrieve },
  }));
  (
    StripeMock as unknown as {
      __mock: { constructEvent: jest.Mock; sessionsCreate: jest.Mock; balanceRetrieve: jest.Mock };
    }
  ).__mock = { constructEvent, sessionsCreate, balanceRetrieve };
  return { __esModule: true, default: StripeMock };
});

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { StoreStatus } from '@prisma/client';
import Stripe from 'stripe';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { DOMAIN_DNS_PROVIDER } from '../src/modules/domains/domain-dns.provider';
import type { ProviderCreatePaymentInput } from '../src/modules/payments/providers/payment-gateway.adapter';
import { SslCommerzHttp } from '../src/modules/payments/providers/sslcommerz/sslcommerz.http';
import { SslCommerzPaymentProvider } from '../src/modules/payments/providers/sslcommerz/sslcommerz-payment.provider';
import { StripePaymentProvider } from '../src/modules/payments/providers/stripe/stripe-payment.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';
import { expectSafeReturnUrl, paymentStatusFromReturnUrl } from './support/payment-return';

const stripeMock = (
  Stripe as unknown as { __mock: { constructEvent: jest.Mock; sessionsCreate: jest.Mock } }
).__mock;

/**
 * Stripe and SSLCommerz must send the shopper back to the storefront the
 * payment started on — the store's verified custom domain, else its platform
 * subdomain — because the result pages (and the tab's contact proof) live
 * there, not on the platform website. The host comes only from the store's
 * own domain rows, never from request headers.
 */
describe('Payment return URLs use the storefront origin (e2e)', () => {
  jest.setTimeout(180_000);

  // A deployed-like platform: storefronts are `{slug}.{root}`, not WEB_URL.
  const ROOT = 'pay-origin.test';
  const WEB_URL = `https://${ROOT}`;
  const saved = { WEB_URL: process.env.WEB_URL, PLATFORM_ROOT_DOMAIN: process.env.PLATFORM_ROOT_DOMAIN };

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const stripeSecret = `sk_test_origin_${suffix}`;
  const stripeWebhookSecret = `whsec_origin_${suffix}`;
  const sslStoreId = `sslorigin_${suffix}`;
  const sslPassword = `sslpass_origin_${suffix}`;
  const txtZone = new Map<string, string[]>();
  const httpMock = { postForm: jest.fn(), getJson: jest.fn() };

  interface Shop {
    key: string;
    token: string;
    storeId: string;
    storeSlug: string;
    productId: string;
    shippingMethodId: string;
    customHost?: string;
  }
  const shop = (key: string): Shop => ({
    key,
    token: '',
    storeId: '',
    storeSlug: `origin-${key}-${suffix}`,
    productId: '',
    shippingMethodId: '',
  });
  const subdomainShop = shop('sub');
  const customShop = shop('custom');
  const pendingShop = shop('pending');

  const server = () => app.getHttpServer();
  const bearer = (s: Shop) => ({ Authorization: `Bearer ${s.token}` });

  async function openShop(s: Shop) {
    const email = `origin.${s.key}.${suffix}@example.com`;
    s.token = (
      await request(server())
        .post('/api/v1/auth/register')
        .send({ email, password: 'SecurePass1', firstName: 'Origin', lastName: 'Test' })
        .expect(201)
    ).body.data.accessToken;
    const res = await request(server())
      .post('/api/v1/onboarding/store')
      .set(bearer(s))
      .send(withPayment({ businessName: `Origin ${s.key} ${suffix}`, tenantSlug: s.storeSlug, storeName: `Origin ${s.key}`, storeSlug: s.storeSlug }))
      .expect(201)
      .then(activateOnboarded(app));
    s.storeId = res.body.data.store.id;
    await prisma.store.update({ where: { id: s.storeId }, data: { status: StoreStatus.ACTIVE, currency: 'USD' } });
    s.productId = (
      await request(server())
        .post(`/api/v1/stores/${s.storeId}/products`)
        .set(bearer(s))
        .send({ name: 'Origin Product', slug: `origin-prod-${suffix}`, status: 'ACTIVE', basePrice: '25.50', trackInventory: false })
        .expect(201)
    ).body.data.id;
    s.shippingMethodId = (
      await request(server())
        .post(`/api/v1/stores/${s.storeId}/shipping-methods`)
        .set(bearer(s))
        .send({ name: 'Free', type: 'FREE', price: '0', active: true })
        .expect(201)
    ).body.data.id;
    for (const body of [
      { provider: 'STRIPE', enabled: true, mode: 'test', secrets: { secretKey: stripeSecret, webhookSecret: stripeWebhookSecret } },
      { provider: 'SSL_COMMERZ', enabled: true, mode: 'test', secrets: { storeId: sslStoreId, storePassword: sslPassword } },
    ]) {
      await request(server()).post(`/api/v1/stores/${s.storeId}/payment-providers`).set(bearer(s)).send(body).expect(201);
    }
  }

  /** The merchant flow: add → DNS TXT verified → activate → (optionally) primary. */
  async function addCustomDomain(s: Shop, host: string, { verify }: { verify: boolean }) {
    const domains = `/api/v1/stores/${s.storeId}/domains`;
    const created = await request(server()).post(domains).set(bearer(s)).send({ hostname: host }).expect(201);
    const id = created.body.data.id as string;
    if (!verify) return;
    txtZone.set(created.body.data.verification.recordName, [created.body.data.verification.recordValue]);
    await request(server()).post(`${domains}/${id}/verify`).set(bearer(s)).expect(200);
    await request(server()).post(`${domains}/${id}/activate`).set(bearer(s)).expect(200);
    await request(server()).post(`${domains}/${id}/set-primary`).set(bearer(s)).expect(200);
    s.customHost = host;
  }

  const email = `origin.shopper.${suffix}@example.com`;
  const phone = '01712000555';
  let orderSeq = 0;
  async function placeOrder(s: Shop, provider: 'STRIPE' | 'SSL_COMMERZ') {
    const res = await request(server())
      .post(`/api/v1/public/stores/${s.storeSlug}/checkout`)
      .set('Idempotency-Key', `origin-${s.key}-${suffix}-${(orderSeq += 1)}`)
      .send({
        items: [{ productId: s.productId, quantity: 1 }],
        customer: { name: 'Origin Shopper', email, phone },
        shippingAddress: { name: 'Origin Shopper', phone, email, addressLine1: '1 Main', city: 'Dhaka', country: 'BD' },
        billingSameAsShipping: true,
        shippingMethodId: s.shippingMethodId,
        paymentProvider: provider,
        paymentMethod: 'CARD',
      })
      .expect(201);
    return res.body.data.publicReference as string;
  }

  /** Signature is mocked; the API still reads the raw body to find the payment. */
  async function stripeWebhook(event: { id: string; type: string; data: unknown }) {
    stripeMock.constructEvent.mockReturnValueOnce(event);
    await request(server())
      .post('/api/v1/public/payment-webhooks/STRIPE')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=valid')
      .send(JSON.stringify(event))
      .expect(201);
  }

  const stripeSpy = () => jest.spyOn(StripePaymentProvider.prototype, 'createPayment');
  const sslSpy = () => jest.spyOn(SslCommerzPaymentProvider.prototype, 'createPayment');

  /** Starts (or retries) a payment; returns the URLs the gateway was given. */
  async function startPayment(s: Shop, provider: 'STRIPE' | 'SSL_COMMERZ', publicReference: string, path: 'create' | 'retry' = 'create') {
    const spy = provider === 'STRIPE' ? stripeSpy() : sslSpy();
    if (provider === 'STRIPE') {
      stripeMock.sessionsCreate.mockResolvedValueOnce({ id: `cs_${orderSeq}_${suffix}`, url: `https://checkout.stripe.test/${orderSeq}` });
    } else {
      httpMock.postForm.mockResolvedValueOnce({
        status: 200,
        body: { status: 'SUCCESS', sessionkey: `sess_${orderSeq}_${suffix}`, GatewayPageURL: `https://sandbox.sslcommerz.test/${orderSeq}` },
      });
    }
    const res = await request(server())
      .post(`/api/v1/public/stores/${s.storeSlug}/payments/${path}`)
      // A forged host must not influence where the shopper is sent.
      .set('X-Forwarded-Host', 'evil.example')
      .set('Origin', 'https://evil.example')
      .send({ publicReference, provider, phone })
      .expect(201);
    const input = spy.mock.calls.at(-1)![0] as ProviderCreatePaymentInput;
    spy.mockRestore();
    // What the gateway itself receives.
    const gateway =
      provider === 'STRIPE'
        ? (() => {
            const a = stripeMock.sessionsCreate.mock.calls.at(-1)![0] as { success_url: string; cancel_url: string };
            return { success: a.success_url, cancel: a.cancel_url };
          })()
        : (() => {
            const f = httpMock.postForm.mock.calls.at(-1)![1] as Record<string, string>;
            return { success: f.success_url!, cancel: f.cancel_url!, failure: f.fail_url! };
          })();
    return { data: res.body.data as { internalReference: string; paymentId: string; attemptNumber: number }, returnUrls: input.returnUrls, gateway };
  }

  beforeAll(async () => {
    process.env.WEB_URL = WEB_URL;
    process.env.PLATFORM_ROOT_DOMAIN = ROOT;
    process.env.PAYMENT_SECRETS_ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    // Loaded after the env above so configuration picks it up.
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SslCommerzHttp)
      .useValue(httpMock)
      .overrideProvider(DOMAIN_DNS_PROVIDER)
      .useValue({ lookupTxt: async (host: string) => txtZone.get(host) ?? [] })
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    const redis = app.get(RedisService);
    for (const pattern of ['auth:rl:*', 'rl:*', 'storefront:domain:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }

    for (const s of [subdomainShop, customShop, pendingShop]) await openShop(s);
    await addCustomDomain(customShop, `shop-${suffix}.origin-store.test`, { verify: true });
    // Added but never verified: must not be used.
    await addCustomDomain(pendingShop, `pending-${suffix}.origin-store.test`, { verify: false });
  });

  afterAll(async () => {
    await app?.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const originOf = (s: Shop) => (s.customHost ? `https://${s.customHost}` : `https://${s.storeSlug}.${ROOT}`);

  for (const [label, pick] of [
    ['platform subdomain', () => subdomainShop],
    ['verified custom domain', () => customShop],
    ['unverified custom domain (falls back to the subdomain)', () => pendingShop],
  ] as const) {
    for (const provider of ['STRIPE', 'SSL_COMMERZ'] as const) {
      it(`${provider}: success / cancel / failure return to the ${label}`, async () => {
        const s = pick();
        const origin = originOf(s);
        if (s === pendingShop) expect(origin).toBe(`https://${s.storeSlug}.${ROOT}`);

        const publicReference = await placeOrder(s, provider);
        const { data, returnUrls, gateway } = await startPayment(s, provider, publicReference);
        const order = await prisma.order.findFirstOrThrow({ where: { storeId: s.storeId, publicReference } });
        const forbidden = [
          email, phone, s.storeId, order.id, data.paymentId, order.customerId ?? 'no-customer-id',
          stripeSecret, stripeWebhookSecret, sslStoreId, sslPassword, 'evil.example', WEB_URL + '/payment',
        ];
        const expected = { origin, storeSlug: s.storeSlug, publicReference, internalReference: data.internalReference, forbidden };
        expectSafeReturnUrl(returnUrls.success, { ...expected, path: '/payment/success' });
        expectSafeReturnUrl(returnUrls.cancel, { ...expected, path: '/payment/cancel' });
        expectSafeReturnUrl(returnUrls.failure, { ...expected, path: '/payment/failure' });
        // The gateway is handed exactly these (Stripe has no separate failure URL).
        expect(gateway.success).toBe(returnUrls.success);
        expect(gateway.cancel).toBe(returnUrls.cancel);
        if ('failure' in gateway) expect(gateway.failure).toBe(returnUrls.failure);

        // Status on return still needs the proof; ownership checks unchanged.
        expect((await paymentStatusFromReturnUrl(app, returnUrls.success, { phone }).expect(200)).body.data.status).toBe('PENDING');
        await paymentStatusFromReturnUrl(app, returnUrls.success, { phone: '01999999999' }).expect(404);
        await paymentStatusFromReturnUrl(app, returnUrls.success, { phone }, subdomainShop === s ? customShop.storeSlug : subdomainShop.storeSlug).expect(404);
        await request(server())
          .post(`/api/v1/public/stores/${s.storeSlug}/payments/pay_unknownReference000000/status`)
          .send({ phone })
          .expect(404);

        // A failed attempt, then a retry: new reference, same storefront origin.
        if (provider === 'STRIPE') {
          await stripeWebhook({
            id: `evt_fail_${data.internalReference}`,
            type: 'payment_intent.payment_failed',
            data: { object: { id: `pi_${data.internalReference}`, amount: 2550, metadata: { ecomestaInternalReference: data.internalReference } } },
          });
        } else {
          httpMock.getJson.mockResolvedValueOnce({ status: 200, body: { status: 'INVALID_TRANSACTION', tran_id: data.internalReference } });
          await request(server())
            .post('/api/v1/public/payment-webhooks/SSL_COMMERZ')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .send(`tran_id=${encodeURIComponent(data.internalReference)}&val_id=val_fail_${orderSeq}_${suffix}&status=FAILED&amount=25.50`)
            .expect(201);
        }
        expect((await paymentStatusFromReturnUrl(app, returnUrls.failure, { phone }).expect(200)).body.data.status).toBe('FAILED');

        const retry = await startPayment(s, provider, publicReference, 'retry');
        expect(retry.data.internalReference).not.toBe(data.internalReference);
        expectSafeReturnUrl(retry.returnUrls.success, {
          ...expected,
          internalReference: retry.data.internalReference,
          path: '/payment/success',
        });

        // The verified webhook / IPN still decides PAID; a refresh reads the same.
        if (provider === 'STRIPE') {
          await stripeWebhook({
            id: `evt_paid_${retry.data.internalReference}`,
            type: 'checkout.session.completed',
            data: { object: { id: `cs_paid_${orderSeq}`, payment_status: 'paid', amount_total: 2550, client_reference_id: retry.data.internalReference, metadata: { ecomestaInternalReference: retry.data.internalReference } } },
          });
        } else {
          const valId = `val_ok_${orderSeq}_${suffix}`;
          httpMock.getJson.mockResolvedValueOnce({
            status: 200,
            body: { status: 'VALID', tran_id: retry.data.internalReference, val_id: valId, amount: '25.50', currency_amount: '25.50' },
          });
          await request(server())
            .post('/api/v1/public/payment-webhooks/SSL_COMMERZ')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .send(`tran_id=${encodeURIComponent(retry.data.internalReference)}&val_id=${valId}&status=VALID&amount=25.50&currency_amount=25.50&currency=USD`)
            .expect(201);
        }
        for (let i = 0; i < 2; i += 1) {
          const paid = await paymentStatusFromReturnUrl(app, retry.returnUrls.success, { email }).expect(200);
          expect(paid.body.data).toMatchObject({ status: 'PAID', orderPaymentStatus: 'PAID', attemptNumber: 2 });
        }
      });
    }
  }
});
