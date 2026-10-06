import { createHmac } from 'node:crypto';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PaymentStatus, StoreStatus, TenantStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';

describe('Prod remediation — payment races + tenant suspend (e2e)', () => {
  jest.setTimeout(90_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const webhookSecret = `whsec_race_${suffix}`;
  const guestEmail = `race.guest.${suffix}@example.com`;

  const manager = {
    email: `race.mgr.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeId = '';
  let tenantId = '';
  const storeSlug = `race-store-${suffix}`;
  let productId = '';
  let shippingMethodId = '';

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

    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: manager.email,
        password: manager.password,
        firstName: 'Race',
        lastName: 'Mgr',
      })
      .expect(201);
    manager.token = registered.body.data.accessToken;
    manager.id = registered.body.data.user.id;

    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${manager.token}`)
      .send(withPayment({
        businessName: 'Race Tenant',
        tenantSlug: `race-tenant-${suffix}`,
        storeName: 'Race Store',
        storeSlug,
      }))
      .expect(201).then(activateOnboarded(app));
    storeId = onboard.body.data.store.id;
    tenantId = onboard.body.data.tenant.id;
    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });

    const product = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Race Product',
        slug: `race-prod-${suffix}`,
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

    await request(app.getHttpServer())
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
  });

  afterAll(async () => {
    await app?.close();
  });

  async function placeOrder(key: string) {
    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', key)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: { name: 'Race Guest', email: guestEmail, phone: '01711000000' },
        shippingAddress: {
          name: 'Race Guest',
          addressLine1: '1 Main',
          city: 'Austin',
          country: 'US',
          email: guestEmail,
        },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'TEST',
        paymentMethod: 'CARD',
      })
      .expect(201);
    return checkout.body.data.publicReference as string;
  }

  it('serializes concurrent initiate under order lock (single attempt)', async () => {
    const publicReference = await placeOrder(`race-lock-${suffix}`);

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
        .set('Idempotency-Key', `idem-a-${suffix}`)
        .send({
          publicReference,
          provider: 'TEST',
          email: guestEmail,
        }),
      request(app.getHttpServer())
        .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
        .set('Idempotency-Key', `idem-b-${suffix}`)
        .send({
          publicReference,
          provider: 'TEST',
          email: guestEmail,
        }),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 201]);
    const order = await prisma.order.findFirstOrThrow({
      where: { storeId, publicReference },
      include: { payments: true },
    });
    // Placement creates attempt 1; concurrent initiates reuse or add at most one.
    expect(order.payments.length).toBeLessThanOrEqual(2);
    expect(order.paymentStatus).not.toBe(PaymentStatus.PAID);
  });

  it('honors idempotencyKey so retries do not double-create', async () => {
    const publicReference = await placeOrder(`race-idem-${suffix}`);
    const key = `same-key-${suffix}`;

    const first = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .set('Idempotency-Key', key)
      .send({ publicReference, provider: 'TEST', email: guestEmail })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .set('Idempotency-Key', key)
      .send({ publicReference, provider: 'TEST', email: guestEmail })
      .expect(201);

    expect(second.body.data.internalReference).toBe(
      first.body.data.internalReference,
    );
    expect(second.body.data.paymentId).toBe(first.body.data.paymentId);
  });

  it('rejects initiate after PAID and never rewrites PAID→PENDING', async () => {
    const publicReference = await placeOrder(`race-paid-${suffix}`);
    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({ publicReference, provider: 'TEST', email: guestEmail })
      .expect(201);

    const payload = {
      eventId: `evt-race-paid-${suffix}`,
      eventType: 'payment.paid',
      internalReference: initiated.body.data.internalReference,
      providerPaymentId: `test_${initiated.body.data.internalReference}`,
      status: 'PAID',
      amount: '20.00',
    };
    const body = JSON.stringify(payload);
    await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/TEST')
      .set('Content-Type', 'application/json')
      .set('x-ecomesta-test-signature', sign(body))
      .send(body)
      .expect(201);

    const orderBefore = await prisma.order.findFirstOrThrow({
      where: { storeId, publicReference },
    });
    expect(orderBefore.paymentStatus).toBe(PaymentStatus.PAID);

    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({ publicReference, provider: 'TEST', email: guestEmail })
      .expect(422);

    const orderAfter = await prisma.order.findFirstOrThrow({
      where: { storeId, publicReference },
    });
    expect(orderAfter.paymentStatus).toBe(PaymentStatus.PAID);
  });

  it('on webhook P2002 continues apply when processedAt is still null', async () => {
    const publicReference = await placeOrder(`race-p2002-${suffix}`);
    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({ publicReference, provider: 'TEST', email: guestEmail })
      .expect(201);

    const eventId = `evt-race-p2002-${suffix}`;
    const payment = await prisma.payment.findFirstOrThrow({
      where: { internalReference: initiated.body.data.internalReference },
    });

    await prisma.paymentWebhookEvent.create({
      data: {
        provider: 'TEST',
        eventId,
        eventType: 'payment.paid',
        storeId,
        paymentId: payment.id,
        summary: {},
      },
    });

    const payload = {
      eventId,
      eventType: 'payment.paid',
      internalReference: initiated.body.data.internalReference,
      providerPaymentId: `test_${initiated.body.data.internalReference}`,
      status: 'PAID',
      amount: '20.00',
    };
    const body = JSON.stringify(payload);
    const res = await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/TEST')
      .set('Content-Type', 'application/json')
      .set('x-ecomesta-test-signature', sign(body))
      .send(body)
      .expect(201);

    expect(res.body.data.replayed).toBe(false);
    expect(res.body.data.status).toBe('PAID');

    const order = await prisma.order.findFirstOrThrow({
      where: { storeId, publicReference },
    });
    expect(order.paymentStatus).toBe(PaymentStatus.PAID);

    const event = await prisma.paymentWebhookEvent.findUniqueOrThrow({
      where: { provider_eventId: { provider: 'TEST', eventId } },
    });
    expect(event.processedAt).not.toBeNull();
  });

  it('rejects PAID webhook without amount', async () => {
    const publicReference = await placeOrder(`race-amt-${suffix}`);
    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({ publicReference, provider: 'TEST', email: guestEmail })
      .expect(201);

    const payload = {
      eventId: `evt-race-amt-${suffix}`,
      eventType: 'payment.paid',
      internalReference: initiated.body.data.internalReference,
      status: 'PAID',
    };
    const body = JSON.stringify(payload);
    await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/TEST')
      .set('Content-Type', 'application/json')
      .set('x-ecomesta-test-signature', sign(body))
      .send(body)
      .expect(422);
  });

  it('refuses payment create/retry as store unavailable when tenant is suspended', async () => {
    const publicReference = await placeOrder(`race-susp-${suffix}`);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: TenantStatus.SUSPENDED },
    });

    const created = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({ publicReference, provider: 'TEST', email: guestEmail })
      .expect(403);
    expect(created.body.error.code).toBe('STORE_UNAVAILABLE');

    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/retry`)
      .send({ publicReference, provider: 'TEST', email: guestEmail })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/payment-providers`)
      .expect(403);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: TenantStatus.ACTIVE },
    });
  });
});
