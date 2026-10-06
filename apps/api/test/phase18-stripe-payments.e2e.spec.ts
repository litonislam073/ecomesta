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
      __mock: {
        constructEvent: jest.Mock;
        sessionsCreate: jest.Mock;
        balanceRetrieve: jest.Mock;
      };
    }
  ).__mock = { constructEvent, sessionsCreate, balanceRetrieve };
  return { __esModule: true, default: StripeMock };
});

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { MembershipStatus, StoreRole, StoreStatus } from '@prisma/client';
import Stripe from 'stripe';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';
import { expectSafeReturnUrl, paymentStatusFromReturnUrl } from './support/payment-return';

const stripeMock = (
  Stripe as unknown as {
    __mock: {
      constructEvent: jest.Mock;
      sessionsCreate: jest.Mock;
      balanceRetrieve: jest.Mock;
    };
  }
).__mock;

describe('Phase 18 Stripe payments (e2e)', () => {
  jest.setTimeout(60_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const stripeSecret = `sk_test_phase18_${suffix}`;
  const stripeWebhookSecret = `whsec_phase18_${suffix}`;
  const testWebhookSecret = `whsec_test_${suffix}`;

  const manager = {
    email: `phase18.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staff = {
    email: `phase18.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeId = '';
  const storeSlug = `stripe-store-${suffix}`;
  let productId = '';
  let shippingMethodId = '';

  beforeAll(async () => {
    process.env.PAYMENT_SECRETS_ENCRYPTION_KEY =
      process.env.PAYMENT_SECRETS_ENCRYPTION_KEY ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);

    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }

    for (const user of [manager, staff]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Eighteen',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${manager.token}`)
      .send(withPayment({
        businessName: 'Stripe Tenant',
        tenantSlug: `stripe-tenant-${suffix}`,
        storeName: 'Stripe Store',
        storeSlug,
      }))
      .expect(201).then(activateOnboarded(app));
    storeId = onboard.body.data.store.id;
    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });

    await prisma.storeUser.create({
      data: {
        storeId,
        userId: staff.id,
        role: StoreRole.STORE_STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });

    const product = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Stripe Product',
        slug: `stripe-prod-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '25.50',
        trackInventory: false,
      })
      .expect(201);
    productId = product.body.data.id;

    const ship = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Free', type: 'FREE', price: '0', active: true })
      .expect(201);
    shippingMethodId = ship.body.data.id;

    // Keep COD/TEST working alongside Stripe.
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        provider: 'TEST',
        enabled: true,
        mode: 'test',
        secrets: { webhookSecret: testWebhookSecret },
      })
      .expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    stripeMock.sessionsCreate.mockReset();
    stripeMock.constructEvent.mockReset();
    stripeMock.balanceRetrieve.mockReset();
  });

  it('upserts STRIPE config with masked secrets and rejects staff writes', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        provider: 'STRIPE',
        enabled: true,
        secrets: {
          secretKey: stripeSecret,
          webhookSecret: stripeWebhookSecret,
        },
      })
      .expect(403);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        provider: 'STRIPE',
        enabled: true,
        mode: 'test',
        publicConfig: { label: 'Stripe Checkout' },
        secrets: {
          secretKey: stripeSecret,
          webhookSecret: stripeWebhookSecret,
        },
      })
      .expect(201);

    expect(created.body.data.provider).toBe('STRIPE');
    expect(created.body.data.hasSecrets).toBe(true);
    expect(created.body.data.enabled).toBe(true);
    expect(created.body.data).not.toHaveProperty('encryptedSecrets');
    expect(created.body.data).not.toHaveProperty('secrets');
    expect(JSON.stringify(created.body)).not.toContain(stripeSecret);
    expect(JSON.stringify(created.body)).not.toContain(stripeWebhookSecret);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        provider: 'STRIPE',
        enabled: true,
        secrets: { secretKey: stripeSecret },
      })
      .expect(400);
  });

  it('validates Stripe config via balance.retrieve without charging', async () => {
    stripeMock.balanceRetrieve.mockResolvedValueOnce({
      object: 'balance',
      available: [],
    });

    const ok = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers/STRIPE/validate`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(201);

    expect(ok.body.data.ok).toBe(true);
    expect(stripeMock.balanceRetrieve).toHaveBeenCalledTimes(1);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers/STRIPE/validate`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);
  });

  it('lists STRIPE publicly when enabled and keeps COD checkout working', async () => {
    const providers = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/payment-providers`)
      .expect(200);

    const online = providers.body.data.online as { provider: string }[];
    expect(online.some((p) => p.provider === 'STRIPE')).toBe(true);
    expect(online.some((p) => p.provider === 'TEST')).toBe(true);
    expect(JSON.stringify(providers.body)).not.toContain(stripeSecret);

    const cod = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p18-cod-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'COD Guest',
          email: `cod.guest.${suffix}@example.com`,
          phone: '01711000000',
        },
        shippingAddress: {
          name: 'COD Guest',
          addressLine1: '1 Main',
          city: 'Austin',
          country: 'US',
        },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
      })
      .expect(201);

    expect(cod.body.data.publicReference).toBeTruthy();
    expect(cod.body.data.total).toBe('25.50');
  });

  it('initiates Stripe Checkout Session from order total (cents-safe)', async () => {
    stripeMock.sessionsCreate.mockResolvedValueOnce({
      id: `cs_test_${suffix}`,
      url: `https://checkout.stripe.test/pay/cs_test_${suffix}`,
    });

    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p18-stripe-chk-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'Stripe Guest',
          email: `stripe.guest.${suffix}@example.com`,
          phone: '01711000000',
        },
        shippingAddress: {
          name: 'Stripe Guest',
          addressLine1: '2 Main',
          city: 'Austin',
          country: 'US',
          email: `stripe.guest.${suffix}@example.com`,
        },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'STRIPE',
        paymentMethod: 'CARD',
      })
      .expect(201);

    const publicReference = checkout.body.data.publicReference as string;

    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({ publicReference, provider: 'STRIPE', email: `stripe.guest.${suffix}@example.com` })
      .expect(201);

    expect(initiated.body.data.amount).toBe('25.50');
    expect(initiated.body.data.provider).toBe('STRIPE');
    expect(initiated.body.data.redirectUrl).toContain('checkout.stripe.test');
    expect(initiated.body.data.providerPaymentId).toBe(`cs_test_${suffix}`);

    expect(stripeMock.sessionsCreate).toHaveBeenCalledTimes(1);
    const createArgs = stripeMock.sessionsCreate.mock.calls[0][0] as {
      client_reference_id: string;
      line_items: { price_data: { unit_amount: number; currency: string } }[];
      metadata: Record<string, string>;
      payment_intent_data: { metadata: Record<string, string> };
    };
    expect(createArgs.client_reference_id).toBe(
      initiated.body.data.internalReference,
    );
    expect(createArgs.line_items[0]?.price_data.unit_amount).toBe(2550);
    expect(createArgs.metadata.ecomestaInternalReference).toBe(
      initiated.body.data.internalReference,
    );
    expect(createArgs.metadata.orderId).toBeTruthy();
    expect(createArgs.metadata.storeId).toBe(storeId);
    expect(createArgs.metadata.paymentId).toBe(initiated.body.data.paymentId);
    expect(createArgs.payment_intent_data.metadata.ecomestaInternalReference).toBe(
      initiated.body.data.internalReference,
    );

    // Success URL must not mark paid — payment stays PENDING until webhook.
    const payment = await prisma.payment.findFirst({
      where: { internalReference: initiated.body.data.internalReference },
    });
    expect(payment?.status).toBe('PENDING');
  });

  it('rejects invalid Stripe signatures and pays only on verified webhook', async () => {
    const payment = await prisma.payment.findFirst({
      where: { storeId, provider: 'STRIPE', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    expect(payment).toBeTruthy();
    const internalReference = payment!.internalReference;
    const sessionId = payment!.providerPaymentId!;

    const eventBody = JSON.stringify({
      id: `evt_paid_${suffix}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          payment_status: 'paid',
          amount_total: 2550,
          client_reference_id: internalReference,
          metadata: {
            ecomestaInternalReference: internalReference,
            storeId,
            paymentId: payment!.id,
            orderId: payment!.orderId,
          },
        },
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/STRIPE')
      .set('Content-Type', 'application/json')
      .send(eventBody)
      .expect(401);

    stripeMock.constructEvent.mockImplementationOnce(() => {
      throw new Error('bad sig');
    });
    await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/STRIPE')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=deadbeef')
      .send(eventBody)
      .expect(401);

    stripeMock.constructEvent.mockReturnValueOnce({
      id: `evt_paid_${suffix}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          payment_status: 'paid',
          amount_total: 2550,
          client_reference_id: internalReference,
          metadata: { ecomestaInternalReference: internalReference },
        },
      },
    });

    const ok = await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/STRIPE')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=valid')
      .send(eventBody)
      .expect(201);

    expect(ok.body.data.replayed).toBe(false);
    expect(ok.body.data.status).toBe('PAID');

    stripeMock.constructEvent.mockReturnValueOnce({
      id: `evt_paid_${suffix}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          payment_status: 'paid',
          amount_total: 2550,
          client_reference_id: internalReference,
          metadata: { ecomestaInternalReference: internalReference },
        },
      },
    });

    const replay = await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/STRIPE')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=valid')
      .send(eventBody)
      .expect(201);
    expect(replay.body.data.replayed).toBe(true);

    const status = await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/payments/${internalReference}?email=${encodeURIComponent(`stripe.guest.${suffix}@example.com`)}`,
      )
      .expect(200);
    expect(status.body.data.status).toBe('PAID');
  });

  it('maps payment_intent.payment_failed to FAILED and supports retry', async () => {
    stripeMock.sessionsCreate.mockResolvedValueOnce({
      id: `cs_fail_${suffix}`,
      url: `https://checkout.stripe.test/pay/cs_fail_${suffix}`,
    });

    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p18-fail-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'Fail Guest',
          email: `fail.guest.${suffix}@example.com`,
          phone: '01711000000',
        },
        shippingAddress: {
          name: 'Fail Guest',
          addressLine1: '3 Main',
          city: 'Austin',
          country: 'US',
        },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'STRIPE',
        paymentMethod: 'CARD',
      })
      .expect(201);

    const publicReference = checkout.body.data.publicReference as string;
    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({
        publicReference,
        provider: 'STRIPE',
        email: `fail.guest.${suffix}@example.com`,
      })
      .expect(201);

    const internalReference = initiated.body.data.internalReference as string;
    const failBody = JSON.stringify({
      id: `evt_fail_${suffix}`,
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: `pi_fail_${suffix}`,
          object: 'payment_intent',
          amount: 2550,
          metadata: { ecomestaInternalReference: internalReference },
        },
      },
    });

    stripeMock.constructEvent.mockReturnValueOnce({
      id: `evt_fail_${suffix}`,
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: `pi_fail_${suffix}`,
          amount: 2550,
          metadata: { ecomestaInternalReference: internalReference },
        },
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/STRIPE')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=valid')
      .send(failBody)
      .expect(201);

    const failed = await prisma.payment.findFirst({
      where: { internalReference },
    });
    expect(failed?.status).toBe('FAILED');

    stripeMock.sessionsCreate.mockResolvedValueOnce({
      id: `cs_retry_${suffix}`,
      url: `https://checkout.stripe.test/pay/cs_retry_${suffix}`,
    });

    const retried = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/retry`)
      .send({
        publicReference,
        provider: 'STRIPE',
        email: `fail.guest.${suffix}@example.com`,
      })
      .expect(201);

    expect(retried.body.data.attemptNumber).toBe(2);
    expect(retried.body.data.provider).toBe('STRIPE');
    expect(retried.body.data.internalReference).not.toBe(internalReference);

    const orders = await prisma.order.findMany({
      where: { storeId, publicReference },
    });
    expect(orders).toHaveLength(1);
  });

  it('returns the shopper with an opaque payment reference the result page can use', async () => {
    const email = `return.guest.${suffix}@example.com`;
    const phone = '01711222333';
    const placeOrder = async (key: string) => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/public/stores/${storeSlug}/checkout`)
        .set('Idempotency-Key', `p18-return-${key}-${suffix}`)
        .send({
          items: [{ productId, quantity: 1 }],
          customer: { name: 'Return Guest', email, phone },
          shippingAddress: { name: 'Return Guest', addressLine1: '4 Main', city: 'Austin', country: 'US', email, phone },
          billingSameAsShipping: true,
          shippingMethodId,
          paymentProvider: 'STRIPE',
          paymentMethod: 'CARD',
        })
        .expect(201);
      return res.body.data.publicReference as string;
    };
    const lastSession = () =>
      stripeMock.sessionsCreate.mock.calls.at(-1)![0] as { success_url: string; cancel_url: string };
    const webhook = (event: { id: string; type: string; data: unknown }) => {
      stripeMock.constructEvent.mockReturnValueOnce(event);
      return request(app.getHttpServer())
        .post('/api/v1/public/payment-webhooks/STRIPE')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 't=1,v1=valid')
        .send(JSON.stringify(event))
        .expect(201);
    };

    // --- Successful payment.
    const publicReference = await placeOrder('ok');
    stripeMock.sessionsCreate.mockResolvedValueOnce({
      id: `cs_return_${suffix}`,
      url: `https://checkout.stripe.test/pay/cs_return_${suffix}`,
    });
    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({ publicReference, provider: 'STRIPE', phone })
      .expect(201);
    const internalReference = initiated.body.data.internalReference as string;
    const order = await prisma.order.findFirstOrThrow({ where: { storeId, publicReference } });
    const forbidden = [email, phone, storeId, order.id, initiated.body.data.paymentId, stripeSecret, stripeWebhookSecret];
    const { success_url: successUrl, cancel_url: cancelUrl } = lastSession();
    expectSafeReturnUrl(successUrl, { path: '/payment/success', storeSlug, publicReference, internalReference, forbidden });
    expectSafeReturnUrl(cancelUrl, { path: '/payment/cancel', storeSlug, publicReference, internalReference, forbidden });

    // Coming back is informational: still pending until the verified webhook.
    const pending = await paymentStatusFromReturnUrl(app, successUrl, { phone }).expect(200);
    expect(pending.body.data).toMatchObject({ internalReference, status: 'PENDING', publicReference });

    await webhook({
      id: `evt_return_${suffix}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_return_${suffix}`,
          payment_status: 'paid',
          amount_total: 2550,
          client_reference_id: internalReference,
          metadata: { ecomestaInternalReference: internalReference },
        },
      },
    });
    const paid = await paymentStatusFromReturnUrl(app, successUrl, { phone }).expect(200);
    expect(paid.body.data).toMatchObject({ status: 'PAID', orderPaymentStatus: 'PAID', orderNumber: order.orderNumber });
    // A refresh of the success page asks again with the same URL: same answer.
    const refreshed = await paymentStatusFromReturnUrl(app, successUrl, { email }).expect(200);
    expect(refreshed.body.data.status).toBe('PAID');
    for (const secret of [stripeSecret, stripeWebhookSecret, storeId, order.id]) {
      expect(JSON.stringify(paid.body)).not.toContain(secret);
    }

    // Ownership: unknown reference, wrong or missing contact, another store → nothing.
    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/pay_unknownReference000000/status`)
      .send({ phone })
      .expect(404);
    await paymentStatusFromReturnUrl(app, successUrl, { phone: '01999999999' }).expect(404);
    await paymentStatusFromReturnUrl(app, successUrl, { email: 'someone.else@example.com' }).expect(404);
    await paymentStatusFromReturnUrl(app, successUrl, {}).expect((res) => expect([400, 404]).toContain(res.status));
    const otherToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: `phase18.other.${suffix}@example.com`, password: 'SecurePass1', firstName: 'Other', lastName: 'Store' })
        .expect(201)
    ).body.data.accessToken as string;
    const otherStoreSlug = `stripe-other-${suffix}`;
    await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${otherToken}`)
      .send(withPayment({ businessName: 'Stripe Other', tenantSlug: `stripe-other-t-${suffix}`, storeName: 'Stripe Other', storeSlug: otherStoreSlug }))
      .expect(201)
      .then(activateOnboarded(app));
    await prisma.store.update({ where: { slug: otherStoreSlug }, data: { status: StoreStatus.ACTIVE } });
    await paymentStatusFromReturnUrl(app, successUrl, { phone }, otherStoreSlug).expect(404);

    // --- Failed / cancelled payment, then a retry with its own reference.
    const failedOrder = await placeOrder('fail');
    stripeMock.sessionsCreate.mockResolvedValueOnce({
      id: `cs_return_fail_${suffix}`,
      url: `https://checkout.stripe.test/pay/cs_return_fail_${suffix}`,
    });
    const failing = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({ publicReference: failedOrder, provider: 'STRIPE', phone })
      .expect(201);
    const failingRef = failing.body.data.internalReference as string;
    const failCancelUrl = lastSession().cancel_url;
    expectSafeReturnUrl(failCancelUrl, { path: '/payment/cancel', storeSlug, publicReference: failedOrder, internalReference: failingRef, forbidden });
    // Cancelling at Stripe only brings the shopper back; the redirect marks nothing.
    expect((await paymentStatusFromReturnUrl(app, failCancelUrl, { phone }).expect(200)).body.data.status).toBe('PENDING');

    await webhook({
      id: `evt_return_fail_${suffix}`,
      type: 'payment_intent.payment_failed',
      data: { object: { id: `pi_return_fail_${suffix}`, amount: 2550, metadata: { ecomestaInternalReference: failingRef } } },
    });
    const failed = await paymentStatusFromReturnUrl(app, failCancelUrl, { phone }).expect(200);
    expect(failed.body.data).toMatchObject({ status: 'FAILED', provider: 'STRIPE' });

    stripeMock.sessionsCreate.mockResolvedValueOnce({
      id: `cs_return_retry_${suffix}`,
      url: `https://checkout.stripe.test/pay/cs_return_retry_${suffix}`,
    });
    const retried = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/retry`)
      .send({ publicReference: failedOrder, provider: 'STRIPE', phone })
      .expect(201);
    const retryRef = retried.body.data.internalReference as string;
    expect(retryRef).not.toBe(failingRef);
    const retrySuccessUrl = lastSession().success_url;
    expectSafeReturnUrl(retrySuccessUrl, { path: '/payment/success', storeSlug, publicReference: failedOrder, internalReference: retryRef, forbidden });
    expect((await paymentStatusFromReturnUrl(app, retrySuccessUrl, { phone }).expect(200)).body.data).toMatchObject({ status: 'PENDING', attemptNumber: 2 });
    expect((await paymentStatusFromReturnUrl(app, failCancelUrl, { phone }).expect(200)).body.data.status).toBe('FAILED');
  });

  it('still supports TEST initiation while Stripe is configured', async () => {
    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p18-test-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'Test Guest',
          email: `test.guest.${suffix}@example.com`,
          phone: '01711000000',
        },
        shippingAddress: {
          name: 'Test Guest',
          addressLine1: '4 Main',
          city: 'Austin',
          country: 'US',
        },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'TEST',
        paymentMethod: 'CARD',
      })
      .expect(201);

    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({
        publicReference: checkout.body.data.publicReference,
        provider: 'TEST',
        email: `test.guest.${suffix}@example.com`,
      })
      .expect(201);

    expect(initiated.body.data.provider).toBe('TEST');
    expect(initiated.body.data.redirectUrl).toBeTruthy();
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
  });

  it('maps payment_intent.succeeded to PAID via nested metadata peek', async () => {
    stripeMock.sessionsCreate.mockResolvedValueOnce({
      id: `cs_pi_${suffix}`,
      url: `https://checkout.stripe.test/pay/cs_pi_${suffix}`,
    });

    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p18-pi-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'PI Guest',
          email: `pi.guest.${suffix}@example.com`,
          phone: '01711000000',
        },
        shippingAddress: {
          name: 'PI Guest',
          addressLine1: '5 Main',
          city: 'Austin',
          country: 'US',
        },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'STRIPE',
        paymentMethod: 'CARD',
      })
      .expect(201);

    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({
        publicReference: checkout.body.data.publicReference,
        provider: 'STRIPE',
        email: `pi.guest.${suffix}@example.com`,
      })
      .expect(201);

    const internalReference = initiated.body.data.internalReference as string;
    const body = JSON.stringify({
      id: `evt_pi_${suffix}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: `pi_ok_${suffix}`,
          object: 'payment_intent',
          amount_received: 2550,
          metadata: { ecomestaInternalReference: internalReference },
        },
      },
    });

    stripeMock.constructEvent.mockReturnValueOnce({
      id: `evt_pi_${suffix}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: `pi_ok_${suffix}`,
          amount_received: 2550,
          metadata: { ecomestaInternalReference: internalReference },
        },
      },
    });

    const ok = await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/STRIPE')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=valid')
      .send(body)
      .expect(201);

    expect(ok.body.data.status).toBe('PAID');
  });

  it('SF-01: a Stripe payment completing after merchant cancellation is recorded, never PAID', async () => {
    const email = `stripe.late.${suffix}@example.com`;
    stripeMock.sessionsCreate.mockResolvedValueOnce({
      id: `cs_late_${suffix}`,
      url: `https://checkout.stripe.test/pay/cs_late_${suffix}`,
    });
    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p18-late-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: { name: 'Late Guest', email, phone: '01711000000' },
        shippingAddress: { name: 'Late Guest', addressLine1: '3 Main', city: 'Austin', country: 'US', email },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'STRIPE',
        paymentMethod: 'CARD',
      })
      .expect(201);
    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({ publicReference: checkout.body.data.publicReference, provider: 'STRIPE', email })
      .expect(201);
    const internalReference = initiated.body.data.internalReference as string;
    const order = await prisma.order.findFirstOrThrow({
      where: { storeId, publicReference: checkout.body.data.publicReference },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ status: 'CANCELLED' })
      .expect(200);

    const event = {
      id: `evt_late_${suffix}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_late_${suffix}`,
          payment_status: 'paid',
          amount_total: 2550,
          client_reference_id: internalReference,
          metadata: { ecomestaInternalReference: internalReference },
        },
      },
    };
    stripeMock.constructEvent.mockReturnValueOnce(event);
    const late = await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/STRIPE')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=valid')
      .send(JSON.stringify(event))
      .expect(201);
    expect(late.body.data.lateCapture).toBe(true);
    expect(late.body.data.status).toBe('CANCELLED');

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
    expect([after.status, after.paymentStatus]).toEqual(['CANCELLED', 'CANCELLED']);
    expect(after.payments.map((p) => p.status)).toEqual(['CANCELLED']);
    expect((after.payments[0]?.metadata as { lateCapture?: { requiresManualRefund?: boolean } }).lateCapture?.requiresManualRefund).toBe(true);
    const audit = await prisma.auditLog.findFirst({
      where: { storeId, entityId: after.payments[0]!.id, action: 'PAYMENT_LATE_CAPTURE_REFUND_REQUIRED' },
    });
    expect(audit).not.toBeNull();
  });
});
