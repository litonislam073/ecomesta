import { createHmac } from 'node:crypto';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { MembershipStatus, StoreRole, StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';

describe('Phase 12 payment providers (e2e)', () => {
  jest.setTimeout(60_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const webhookSecret = `whsec_test_${suffix}`;

  const manager = {
    email: `phase12.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staff = {
    email: `phase12.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeId = '';
  const storeSlug = `pay-store-${suffix}`;
  let productId = '';
  let shippingMethodId = '';
  let publicReference = '';
  let internalReference = '';

  function sign(body: string): string {
    return createHmac('sha256', webhookSecret).update(body).digest('hex');
  }

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
          lastName: 'Twelve',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${manager.token}`)
      .send(withPayment({
        businessName: 'Pay Tenant',
        tenantSlug: `pay-tenant-${suffix}`,
        storeName: 'Pay Store',
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
        name: 'Pay Product',
        slug: `pay-prod-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '20.00',
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
  });

  afterAll(async () => {
    await app?.close();
  });

  it('masks secrets and enforces provider config RBAC', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        provider: 'TEST',
        enabled: true,
        secrets: { webhookSecret },
      })
      .expect(403);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        provider: 'TEST',
        enabled: true,
        mode: 'test',
        publicConfig: { label: 'Test' },
        secrets: { webhookSecret },
      })
      .expect(201);

    expect(created.body.data.hasSecrets).toBe(true);
    expect(created.body.data).not.toHaveProperty('encryptedSecrets');
    expect(JSON.stringify(created.body)).not.toContain(webhookSecret);

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/payment-providers`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(listed.body.data.find((p: { provider: string }) => p.provider === 'TEST')
      ?.hasSecrets).toBe(true);
    expect(JSON.stringify(listed.body)).not.toContain(webhookSecret);
  });

  it('initiates online payment from order total and rejects fake amounts', async () => {
    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p12-chk-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'Pay Guest',
          email: `pay.guest.${suffix}@example.com`,
          phone: '01711000000',
        },
        shippingAddress: {
          name: 'Pay Guest',
          addressLine1: '1 Main',
          city: 'Austin',
          country: 'US',
        },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'TEST',
        paymentMethod: 'CARD',
      })
      .expect(201);

    publicReference = checkout.body.data.publicReference;
    expect(checkout.body.data.total).toBe('20.00');

    const forbidden = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({
        publicReference,
        provider: 'TEST',
        email: `pay.guest.${suffix}@example.com`,
        amount: '1.00',
      });
    expect(forbidden.status).toBe(400);

    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({ publicReference, provider: 'TEST', email: `pay.guest.${suffix}@example.com` })
      .expect(201);

    expect(initiated.body.data.amount).toBe('20.00');
    expect(initiated.body.data.redirectUrl).toBeTruthy();
    expect(initiated.body.data.internalReference).toMatch(/^pay_/);
    internalReference = initiated.body.data.internalReference;
  });

  it('rejects invalid/missing webhook signatures and processes verified events idempotently', async () => {
    const payload = {
      eventId: `evt-paid-${suffix}`,
      eventType: 'payment.paid',
      internalReference,
      providerPaymentId: `test_${internalReference}`,
      status: 'PAID',
      amount: '20.00',
    };
    const body = JSON.stringify(payload);

    await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/TEST')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/TEST')
      .set('Content-Type', 'application/json')
      .set('x-ecomesta-test-signature', 'deadbeef')
      .send(body)
      .expect(401);

    const ok = await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/TEST')
      .set('Content-Type', 'application/json')
      .set('x-ecomesta-test-signature', sign(body))
      .send(body)
      .expect(201);
    expect(ok.body.data.replayed).toBe(false);
    expect(ok.body.data.status).toBe('PAID');

    const replay = await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/TEST')
      .set('Content-Type', 'application/json')
      .set('x-ecomesta-test-signature', sign(body))
      .send(body)
      .expect(201);
    expect(replay.body.data.replayed).toBe(true);

    const status = await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/payments/${internalReference}?email=${encodeURIComponent(`pay.guest.${suffix}@example.com`)}`,
      )
      .expect(200);
    expect(status.body.data.status).toBe('PAID');

    const payments = await prisma.payment.findMany({
      where: { storeId, order: { publicReference } },
    });
    expect(payments.filter((p) => p.status === 'PAID')).toHaveLength(1);
  });

  it('supports retry after failure without creating a new order', async () => {
    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p12-retry-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'Retry Guest',
          email: `retry.guest.${suffix}@example.com`,
          phone: '01711000000',
        },
        shippingAddress: {
          name: 'Retry Guest',
          addressLine1: '2 Main',
          city: 'Austin',
          country: 'US',
        },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'TEST',
        paymentMethod: 'CARD',
      })
      .expect(201);

    const ref = checkout.body.data.publicReference;
    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({ publicReference: ref, provider: 'TEST', email: `retry.guest.${suffix}@example.com` })
      .expect(201);

    const failPayload = {
      eventId: `evt-fail-${suffix}`,
      eventType: 'payment.failed',
      internalReference: initiated.body.data.internalReference,
      status: 'FAILED',
      amount: '20.00',
    };
    const failBody = JSON.stringify(failPayload);
    await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/TEST')
      .set('Content-Type', 'application/json')
      .set('x-ecomesta-test-signature', sign(failBody))
      .send(failBody)
      .expect(201);

    const retried = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/retry`)
      .send({ publicReference: ref, provider: 'TEST', email: `retry.guest.${suffix}@example.com` })
      .expect(201);

    expect(retried.body.data.attemptNumber).toBe(2);
    expect(retried.body.data.internalReference).not.toBe(
      initiated.body.data.internalReference,
    );

    const orders = await prisma.order.findMany({
      where: { storeId, publicReference: ref },
    });
    expect(orders).toHaveLength(1);
  });
});
