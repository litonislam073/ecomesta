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
import { SslCommerzHttp } from '../src/modules/payments/providers/sslcommerz/sslcommerz.http';

describe('Phase 19 SSLCommerz payments (e2e)', () => {
  jest.setTimeout(60_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  const httpMock = {
    postForm: jest.fn(),
    getJson: jest.fn(),
  };

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const storeIdSecret = `sslstore_${suffix}`;
  const storePassword = `sslpass_${suffix}`;
  const testWebhookSecret = `whsec_test_${suffix}`;

  const manager = {
    email: `phase19.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staff = {
    email: `phase19.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const otherManager = {
    email: `phase19.other.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeId = '';
  let otherStoreId = '';
  const storeSlug = `ssl-store-${suffix}`;
  const otherStoreSlug = `ssl-other-${suffix}`;
  let productId = '';
  let shippingMethodId = '';
  let bdtProductId = '';

  beforeAll(async () => {
    process.env.PAYMENT_SECRETS_ENCRYPTION_KEY =
      process.env.PAYMENT_SECRETS_ENCRYPTION_KEY ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SslCommerzHttp)
      .useValue(httpMock)
      .compile();

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

    for (const user of [manager, staff, otherManager]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Nineteen',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        businessName: 'SSL Tenant',
        tenantSlug: `ssl-tenant-${suffix}`,
        storeName: 'SSL Store',
        storeSlug,
      })
      .expect(201);
    storeId = onboard.body.data.store.id;
    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE, currency: 'USD' },
    });

    const otherOnboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${otherManager.token}`)
      .send({
        businessName: 'SSL Other Tenant',
        tenantSlug: `ssl-other-tenant-${suffix}`,
        storeName: 'SSL Other Store',
        storeSlug: otherStoreSlug,
      })
      .expect(201);
    otherStoreId = otherOnboard.body.data.store.id;
    await prisma.store.update({
      where: { id: otherStoreId },
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
        name: 'SSL Product',
        slug: `ssl-prod-${suffix}`,
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

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        provider: 'STRIPE',
        enabled: true,
        mode: 'test',
        secrets: {
          secretKey: `sk_test_phase19_${suffix}`,
          webhookSecret: `whsec_stripe_${suffix}`,
        },
      })
      .expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    httpMock.postForm.mockReset();
    httpMock.getJson.mockReset();
  });

  it('upserts SSL_COMMERZ config with masked secrets and rejects staff writes', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        provider: 'SSL_COMMERZ',
        enabled: true,
        secrets: { storeId: storeIdSecret, storePassword },
      })
      .expect(403);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        provider: 'SSL_COMMERZ',
        enabled: true,
        mode: 'test',
        publicConfig: { label: 'SSLCommerz' },
        secrets: { storeId: storeIdSecret, storePassword },
      })
      .expect(201);

    expect(created.body.data.provider).toBe('SSL_COMMERZ');
    expect(created.body.data.hasSecrets).toBe(true);
    expect(created.body.data.enabled).toBe(true);
    expect(created.body.data).not.toHaveProperty('encryptedSecrets');
    expect(created.body.data).not.toHaveProperty('secrets');
    expect(JSON.stringify(created.body)).not.toContain(storePassword);
    expect(JSON.stringify(created.body)).not.toContain('storePassword');

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        provider: 'SSL_COMMERZ',
        enabled: true,
        secrets: { storeId: storeIdSecret },
      })
      .expect(400);
  });

  it('validates SSLCommerz config via mocked session API and rejects staff', async () => {
    httpMock.postForm.mockResolvedValueOnce({
      status: 200,
      body: {
        status: 'SUCCESS',
        sessionkey: `sess_cfg_${suffix}`,
        GatewayPageURL: `https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=PAY&SESSIONKEY=sess_cfg_${suffix}`,
      },
    });

    const ok = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers/SSL_COMMERZ/validate`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(201);

    expect(ok.body.data.ok).toBe(true);
    expect(httpMock.postForm).toHaveBeenCalledTimes(1);
    const [url, fields] = httpMock.postForm.mock.calls[0] as [
      string,
      Record<string, string>,
    ];
    expect(url).toContain('sandbox-gw.sslcommerz.com');
    expect(fields.store_id).toBe(storeIdSecret);
    expect(fields.store_passwd).toBe(storePassword);
    expect(fields.total_amount).toBe('10.00');
    expect(JSON.stringify(ok.body)).not.toContain(storePassword);

    httpMock.postForm.mockResolvedValueOnce({
      status: 200,
      body: {
        status: 'FAILED',
        failedreason: 'Invalid Store ID',
      },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers/SSL_COMMERZ/validate`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(422);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers/SSL_COMMERZ/validate`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);
  });

  it('lists SSL_COMMERZ publicly when enabled', async () => {
    const providers = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/payment-providers`)
      .expect(200);

    const online = providers.body.data.online as { provider: string }[];
    expect(online.some((p) => p.provider === 'SSL_COMMERZ')).toBe(true);
    expect(online.some((p) => p.provider === 'TEST')).toBe(true);
    expect(online.some((p) => p.provider === 'STRIPE')).toBe(true);
    expect(JSON.stringify(providers.body)).not.toContain(storePassword);
  });

  it('initiates SSLCommerz session with mocked GatewayPageURL', async () => {
    httpMock.postForm.mockResolvedValueOnce({
      status: 200,
      body: {
        status: 'SUCCESS',
        sessionkey: `sess_pay_${suffix}`,
        GatewayPageURL: `https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=PAY&SESSIONKEY=sess_pay_${suffix}`,
      },
    });

    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p19-ssl-chk-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'SSL Guest',
          email: `ssl.guest.${suffix}@example.com`,
          phone: '01712345678',
        },
        shippingAddress: {
          name: 'SSL Guest',
          phone: '01712345678',
          addressLine1: '12 Gulshan',
          city: 'Dhaka',
          country: 'BD',
          postalCode: '1212',
          email: `ssl.guest.${suffix}@example.com`,
        },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'SSL_COMMERZ',
        paymentMethod: 'CARD',
      })
      .expect(201);

    const publicReference = checkout.body.data.publicReference as string;

    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({ publicReference, provider: 'SSL_COMMERZ', email: `ssl.guest.${suffix}@example.com` })
      .expect(201);

    expect(initiated.body.data.amount).toBe('25.50');
    expect(initiated.body.data.provider).toBe('SSL_COMMERZ');
    expect(initiated.body.data.redirectUrl).toContain('sandbox.sslcommerz.com');
    expect(initiated.body.data.providerPaymentId).toBe(`sess_pay_${suffix}`);
    expect(JSON.stringify(initiated.body)).not.toContain(storePassword);

    expect(httpMock.postForm).toHaveBeenCalledTimes(1);
    const [url, fields] = httpMock.postForm.mock.calls[0] as [
      string,
      Record<string, string>,
    ];
    expect(url).toBe(
      'https://sandbox-gw.sslcommerz.com/gwprocess/v4/api.php',
    );
    expect(fields.tran_id).toBe(initiated.body.data.internalReference);
    expect(fields.total_amount).toBe('25.50');
    expect(fields.ipn_url).toContain(
      '/api/v1/public/payment-webhooks/SSL_COMMERZ',
    );
    expect(fields.value_a).toBe(initiated.body.data.paymentId);
    expect(fields.store_passwd).toBe(storePassword);

    const payment = await prisma.payment.findFirst({
      where: { internalReference: initiated.body.data.internalReference },
    });
    expect(payment?.status).toBe('PENDING');
  });

  it('marks PAID only after IPN + mocked Order Validation VALID', async () => {
    const payment = await prisma.payment.findFirst({
      where: { storeId, provider: 'SSL_COMMERZ', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    expect(payment).toBeTruthy();
    const internalReference = payment!.internalReference;
    const valId = `val_paid_${suffix}`;

    const formBody = [
      `tran_id=${encodeURIComponent(internalReference)}`,
      `val_id=${encodeURIComponent(valId)}`,
      'status=VALID',
      'amount=25.50',
      'currency_amount=25.50',
      'currency=USD',
      `bank_tran_id=bank_${suffix}`,
      `sessionkey=${encodeURIComponent(payment!.providerPaymentId!)}`,
    ].join('&');

    httpMock.getJson.mockResolvedValueOnce({
      status: 200,
      body: {
        status: 'VALID',
        tran_id: internalReference,
        val_id: valId,
        amount: '25.50',
        currency_amount: '25.50',
        sessionkey: payment!.providerPaymentId,
      },
    });

    const ok = await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/SSL_COMMERZ')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(formBody)
      .expect(201);

    expect(ok.body.data.replayed).toBe(false);
    expect(ok.body.data.status).toBe('PAID');
    expect(httpMock.getJson).toHaveBeenCalledTimes(1);
    const [validateUrl, query] = httpMock.getJson.mock.calls[0] as [
      string,
      Record<string, string>,
    ];
    expect(validateUrl).toContain('validationserverAPI.php');
    expect(query.val_id).toBe(valId);
    expect(query.store_id).toBe(storeIdSecret);
    expect(query.store_passwd).toBe(storePassword);
    expect(query.format).toBe('json');

    httpMock.getJson.mockResolvedValueOnce({
      status: 200,
      body: {
        status: 'VALIDATED',
        tran_id: internalReference,
        val_id: valId,
        amount: '25.50',
        currency_amount: '25.50',
      },
    });

    const replay = await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/SSL_COMMERZ')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(formBody)
      .expect(201);
    expect(replay.body.data.replayed).toBe(true);

    const status = await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/payments/${internalReference}?email=${encodeURIComponent(`ssl.guest.${suffix}@example.com`)}`,
      )
      .expect(200);
    expect(status.body.data.status).toBe('PAID');
  });

  it('rejects unsigned FAILED IPN without val_id; marks FAILED after INVALID validation', async () => {
    httpMock.postForm.mockResolvedValueOnce({
      status: 200,
      body: {
        status: 'SUCCESS',
        sessionkey: `sess_fail_${suffix}`,
        GatewayPageURL: `https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=PAY&SESSIONKEY=sess_fail_${suffix}`,
      },
    });

    const failEmail = `ssl.fail.${suffix}@example.com`;
    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p19-fail-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'Fail Guest',
          email: failEmail,
        },
        shippingAddress: {
          name: 'Fail Guest',
          addressLine1: '1 Main',
          city: 'Dhaka',
          country: 'BD',
          email: failEmail,
        },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'SSL_COMMERZ',
        paymentMethod: 'CARD',
      })
      .expect(201);

    const publicReference = checkout.body.data.publicReference as string;
    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({
        publicReference,
        provider: 'SSL_COMMERZ',
        email: failEmail,
      })
      .expect(201);

    const internalReference = initiated.body.data.internalReference as string;

    // Unsigned fail/cancel without val_id must not mutate payment state.
    const unsignedFail = [
      `tran_id=${encodeURIComponent(internalReference)}`,
      'status=FAILED',
      'amount=25.50',
      `bank_tran_id=bank_fail_${suffix}`,
    ].join('&');
    await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/SSL_COMMERZ')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(unsignedFail)
      .expect(401);
    expect(httpMock.getJson).not.toHaveBeenCalled();
    expect(
      (
        await prisma.payment.findFirstOrThrow({
          where: { internalReference },
        })
      ).status,
    ).toBe('PENDING');

    httpMock.getJson.mockResolvedValueOnce({
      status: 200,
      body: { status: 'INVALID_TRANSACTION', tran_id: internalReference },
    });

    const validatedFail = [
      `tran_id=${encodeURIComponent(internalReference)}`,
      'status=FAILED',
      'amount=25.50',
      `val_id=val_fail_${suffix}`,
      `bank_tran_id=bank_fail_${suffix}`,
    ].join('&');
    await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/SSL_COMMERZ')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(validatedFail)
      .expect(201);
    expect(httpMock.getJson).toHaveBeenCalled();

    const failed = await prisma.payment.findFirst({
      where: { internalReference },
    });
    expect(failed?.status).toBe('FAILED');

    httpMock.postForm.mockResolvedValueOnce({
      status: 200,
      body: {
        status: 'SUCCESS',
        sessionkey: `sess_retry_${suffix}`,
        GatewayPageURL: `https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=PAY&SESSIONKEY=sess_retry_${suffix}`,
      },
    });

    const retried = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/retry`)
      .send({
        publicReference,
        provider: 'SSL_COMMERZ',
        email: failEmail,
      })
      .expect(201);

    expect(retried.body.data.attemptNumber).toBe(2);
    expect(retried.body.data.provider).toBe('SSL_COMMERZ');
    expect(retried.body.data.internalReference).not.toBe(internalReference);
  });

  it('rejects wrong tran_id and cross-store config access', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/public/payment-webhooks/SSL_COMMERZ')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('tran_id=pay_does_not_exist_zzzz&status=FAILED')
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/payment-providers`)
      .set('Authorization', `Bearer ${otherManager.token}`)
      .send({
        provider: 'SSL_COMMERZ',
        enabled: true,
        secrets: { storeId: 'other', storePassword: 'other' },
      })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${otherStoreId}/payment-providers`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(403);
  });

  it('rejects BDT amounts below 10.00', async () => {
    await prisma.store.update({
      where: { id: storeId },
      data: { currency: 'BDT' },
    });

    const cheap = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Cheap BDT',
        slug: `ssl-cheap-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '5.00',
        trackInventory: false,
      })
      .expect(201);
    bdtProductId = cheap.body.data.id;

    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p19-bdt-min-${suffix}`)
      .send({
        items: [{ productId: bdtProductId, quantity: 1 }],
        customer: {
          name: 'BDT Guest',
          email: `ssl.bdt.${suffix}@example.com`,
        },
        shippingAddress: {
          name: 'BDT Guest',
          addressLine1: '1 Main',
          city: 'Dhaka',
          country: 'BD',
        },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'SSL_COMMERZ',
        paymentMethod: 'CARD',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/payments/create`)
      .send({
        publicReference: checkout.body.data.publicReference,
        provider: 'SSL_COMMERZ',
        email: `ssl.bdt.${suffix}@example.com`,
      })
      .expect(400);

    expect(httpMock.postForm).not.toHaveBeenCalled();

    await prisma.store.update({
      where: { id: storeId },
      data: { currency: 'USD' },
    });
  });

  it('still supports TEST initiation while SSLCommerz is configured', async () => {
    const checkout = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p19-test-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'Test Guest',
          email: `ssl.test.${suffix}@example.com`,
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
        email: `ssl.test.${suffix}@example.com`,
      })
      .expect(201);

    expect(initiated.body.data.provider).toBe('TEST');
    expect(initiated.body.data.redirectUrl).toBeTruthy();
    expect(httpMock.postForm).not.toHaveBeenCalled();
  });
});
