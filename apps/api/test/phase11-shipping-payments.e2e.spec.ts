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

describe('Phase 11 shipping + payments (e2e)', () => {
  jest.setTimeout(60_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const manager = {
    email: `phase11.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staff = {
    email: `phase11.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const other = {
    email: `phase11.other.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeId = '';
  let otherStoreId = '';
  let productId = '';
  let shippingMethodId = '';
  let orderId = '';
  let paymentId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
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
      if (keys.length > 0) {
        await redis.getClient().del(...keys);
      }
    }

    for (const user of [manager, staff, other]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Eleven',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        businessName: 'Ship Tenant',
        tenantSlug: `ship-tenant-${suffix}`,
        storeName: 'Ship Store',
        storeSlug: `ship-store-${suffix}`,
      })
      .expect(201);
    storeId = onboard.body.data.store.id;

    const onboardB = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${other.token}`)
      .send({
        businessName: 'Other Ship Tenant',
        tenantSlug: `ship-tenant-b-${suffix}`,
        storeName: 'Other Ship Store',
        storeSlug: `ship-other-${suffix}`,
      })
      .expect(201);
    otherStoreId = onboardB.body.data.store.id;

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
        name: 'Ship Product',
        slug: `ship-prod-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '10.00',
        trackInventory: false,
      })
      .expect(201);
    productId = product.body.data.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('supports shipping method CRUD with store isolation', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Express',
        type: 'FLAT',
        price: '7.50',
        active: true,
        configuration: { description: '2-day' },
      })
      .expect(201);
    shippingMethodId = created.body.data.id;
    expect(created.body.data.price).toBe('7.50');

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${otherStoreId}/shipping-methods`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Hack', type: 'FLAT', price: '1.00' })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/shipping-methods/${shippingMethodId}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/shipping-methods/${shippingMethodId}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ price: '8.00' })
      .expect(403);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/shipping-methods/${shippingMethodId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ price: '8.00' })
      .expect(200);
    expect(updated.body.data.price).toBe('8.00');

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${otherStoreId}/shipping-methods/${shippingMethodId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(404);
  });

  it('creates order payment and enforces payment status transitions + RBAC', async () => {
    const order = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/orders`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        items: [{ productId, quantity: 1 }],
        shippingAddress: {
          name: 'Buyer',
          addressLine1: '1 Main',
          city: 'Austin',
          country: 'US',
        },
        shippingTotal: '0',
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
      })
      .expect(201);
    orderId = order.body.data.id;
    paymentId = order.body.data.payments[0].id;

    const list = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/payments`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(list.body.data.items.some((p: { id: string }) => p.id === paymentId)).toBe(
      true,
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/payments/${paymentId}/status`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ status: 'PAID' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/payments/${paymentId}/status`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ status: 'REFUNDED' })
      .expect(422);

    const paid = await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/payments/${paymentId}/status`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ status: 'PAID' })
      .expect(200);
    expect(paid.body.data.status).toBe('PAID');

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${otherStoreId}/payments/${paymentId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(404);
  });

  it('creates shipments, enforces transitions, and syncs fulfillment', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/orders/${orderId}/shipments`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ provider: 'MANUAL', status: 'PENDING' })
      .expect(201);
    const shipmentId = created.body.data.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/shipments/${shipmentId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ status: 'DELIVERED' })
      .expect(422);

    const shipped = await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/shipments/${shipmentId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ status: 'SHIPPED', trackingNumber: 'TRK-11' })
      .expect(200);
    expect(shipped.body.data.status).toBe('SHIPPED');
    expect(shipped.body.data.trackingNumber).toBe('TRK-11');

    const order = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/orders/${orderId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);
    expect(order.body.data.fulfillmentStatus).toBe('FULFILLED');

    await request(app.getHttpServer())
      .patch(
        `/api/v1/stores/${otherStoreId}/orders/${orderId}/shipments/${shipmentId}`,
      )
      .set('Authorization', `Bearer ${other.token}`)
      .send({ status: 'IN_TRANSIT' })
      .expect(404);
  });

  it('deletes shipping methods for managers only', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeId}/shipping-methods/${shippingMethodId}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeId}/shipping-methods/${shippingMethodId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);
  });
});
