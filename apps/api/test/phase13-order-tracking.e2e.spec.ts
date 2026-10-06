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

describe('Phase 13 order tracking + operations (e2e)', () => {
  jest.setTimeout(90_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const manager = {
    email: `phase13.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staff = {
    email: `phase13.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const otherManager = {
    email: `phase13.other.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeId = '';
  const storeSlug = `p13-store-${suffix}`;
  let otherStoreId = '';
  const otherStoreSlug = `p13-other-${suffix}`;
  let productId = '';
  let freeShippingId = '';
  let orderId = '';
  let publicReference = '';
  const customerEmail = `guest.p13.${suffix}@example.com`;

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

    for (const user of [manager, staff, otherManager]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Thirteen',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${manager.token}`)
      .send(withPayment({
        businessName: 'P13 Tenant',
        tenantSlug: `p13-tenant-${suffix}`,
        storeName: 'P13 Store',
        storeSlug,
      }))
      .expect(201).then(activateOnboarded(app));
    storeId = onboard.body.data.store.id;

    const otherOnboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${otherManager.token}`)
      .send(withPayment({
        businessName: 'P13 Other Tenant',
        tenantSlug: `p13-tenant-b-${suffix}`,
        storeName: 'P13 Other Store',
        storeSlug: otherStoreSlug,
      }))
      .expect(201).then(activateOnboarded(app));
    otherStoreId = otherOnboard.body.data.store.id;

    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });
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
    const loginStaff = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: staff.email, password: staff.password })
      .expect(200);
    staff.token = loginStaff.body.data.accessToken;

    const product = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'P13 Widget',
        slug: `p13-widget-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '12.00',
        trackInventory: true,
        allowBackorder: false,
        sku: `P13-${suffix}`,
      })
      .expect(201);
    productId = product.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/inventory/adjust`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        productId,
        quantity: 20,
        type: 'ADJUSTMENT',
        note: 'Stock for phase 13',
      })
      .expect(201);

    const shipping = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Free Track',
        type: 'FREE',
        provider: 'MANUAL',
        price: '0',
        active: true,
      })
      .expect(201);
    freeShippingId = shipping.body.data.id;
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  it('places a public order and returns timeline + fulfillment on lookup', async () => {
    const placed = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p13-place-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: {
          name: 'Track Guest',
          email: customerEmail,
          phone: '+15550013',
        },
        shippingAddress: {
          name: 'Track Guest',
          phone: '+15550013',
          addressLine1: '13 Track St',
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
          country: 'US',
        },
        billingSameAsShipping: true,
        shippingMethodId: freeShippingId,
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
      })
      .expect(201);

    publicReference = placed.body.data.publicReference;
    expect(publicReference.length).toBeGreaterThanOrEqual(16);

    const order = await prisma.order.findFirstOrThrow({
      where: { storeId, publicReference },
    });
    orderId = order.id;

    const tracked = await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/orders/${publicReference}?email=${encodeURIComponent(customerEmail)}`,
      )
      .expect(200);

    expect(tracked.body.data.fulfillmentStatus).toBe('UNFULFILLED');
    expect(tracked.body.data.timeline?.length).toBeGreaterThan(0);
    expect(tracked.body.data.timeline[0].type).toBe('ORDER_CREATED');
    expect(tracked.body.data.shipments).toEqual([]);
    expect(JSON.stringify(tracked.body)).not.toMatch(
      /internalNote|tenantId|userId|ipAddress|password/,
    );
  });

  it('rejects enumeration and cross-store lookups safely', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/orders/not-a-real-reference`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/orders/EM-100001`)
      .expect(404);

    await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/orders/${publicReference}?email=wrong@example.com`,
      )
      .expect(404);

    await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${otherStoreSlug}/orders/${publicReference}?email=${encodeURIComponent(customerEmail)}`,
      )
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/orders/${publicReference}`)
      .expect(404);

    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.INACTIVE },
    });
    await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/orders/${publicReference}?email=${encodeURIComponent(customerEmail)}`,
      )
      .expect(404);
    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });
  });

  it('looks an order up with the contact proof in the body, for its own customer only', async () => {
    const lookup = (slug: string, proof: Record<string, string>) =>
      request(app.getHttpServer())
        .post(`/api/v1/public/stores/${slug}/orders/${publicReference}/lookup`)
        .send(proof);

    const own = await lookup(storeSlug, { email: customerEmail }).expect(200);
    expect(own.body.data.publicReference).toBe(publicReference);
    expect(own.body.data.timeline[0].type).toBe('ORDER_CREATED');
    await lookup(storeSlug, { phone: '+15550013' }).expect(200);

    // Another customer, no proof, another store: the same not-found as a bad reference.
    await lookup(storeSlug, { email: 'someone.else@example.com' }).expect(404);
    await lookup(storeSlug, { phone: '01999999999' }).expect(404);
    await lookup(storeSlug, {}).expect(404);
    await lookup(otherStoreSlug, { email: customerEmail }).expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/orders/EM-100001/lookup`)
      .send({ email: customerEmail })
      .expect(404);
  });

  it('supports merchant filters, timeline, cancel reason, and shipment tracking', async () => {
    const list = await request(app.getHttpServer())
      .get(
        `/api/v1/stores/${storeId}/orders?search=Track&shippingMethod=Free&sortBy=grandTotal&sortOrder=desc`,
      )
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);
    expect(list.body.data.items.some((o: { id: string }) => o.id === orderId)).toBe(
      true,
    );

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/orders/${orderId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);
    expect(detail.body.data.publicReference).toBe(publicReference);
    expect(detail.body.data.timeline?.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ status: 'CONFIRMED' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ status: 'CONFIRMED' })
      .expect(200);

    const shipment = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/orders/${orderId}/shipments`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        provider: 'MANUAL',
        status: 'PENDING',
        trackingNumber: 'TRK-P13-001',
      })
      .expect(201);
    const shipmentId = shipment.body.data.id;

    await request(app.getHttpServer())
      .patch(
        `/api/v1/stores/${storeId}/orders/${orderId}/shipments/${shipmentId}`,
      )
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ status: 'SHIPPED', trackingNumber: 'TRK-P13-001' })
      .expect(200);

    const publicAfterShip = await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/orders/${publicReference}?email=${encodeURIComponent(customerEmail)}`,
      )
      .expect(200);
    expect(publicAfterShip.body.data.shipments[0].trackingNumber).toBe(
      'TRK-P13-001',
    );
    expect(publicAfterShip.body.data.fulfillmentStatus).toBe('FULFILLED');
    expect(
      publicAfterShip.body.data.timeline.some(
        (e: { type: string }) => e.type === 'SHIPPED',
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${otherStoreId}/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherManager.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(
        `/api/v1/stores/${otherStoreId}/orders/${orderId}/shipments/${shipmentId}`,
      )
      .set('Authorization', `Bearer ${otherManager.token}`)
      .send({ status: 'DELIVERED' })
      .expect(404);
  });

  it('cancels with reason, restores inventory once, and rejects repeat cancel', async () => {
    const before = await prisma.inventoryItem.findFirstOrThrow({
      where: { storeId, productId },
    });

    const placed = await request(app.getHttpServer())
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `p13-cancel-${suffix}`)
      .send({
        items: [{ productId, quantity: 2 }],
        customer: {
          name: 'Cancel Guest',
          email: `cancel.p13.${suffix}@example.com`,
          phone: '+15550099',
        },
        shippingAddress: {
          name: 'Cancel Guest',
          phone: '+15550099',
          addressLine1: '99 Cancel St',
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
          country: 'US',
        },
        billingSameAsShipping: true,
        shippingMethodId: freeShippingId,
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
      })
      .expect(201);

    const cancelOrder = await prisma.order.findFirstOrThrow({
      where: {
        storeId,
        publicReference: placed.body.data.publicReference,
      },
    });

    const mid = await prisma.inventoryItem.findFirstOrThrow({
      where: { storeId, productId },
    });
    expect(mid.quantity).toBe(before.quantity - 2);

    const cancelled = await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${cancelOrder.id}/status`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ status: 'CANCELLED', reason: 'Out of stock' })
      .expect(200);

    expect(cancelled.body.data.cancelReason).toBe('Out of stock');
    expect(cancelled.body.data.status).toBe('CANCELLED');

    const after = await prisma.inventoryItem.findFirstOrThrow({
      where: { storeId, productId },
    });
    expect(after.quantity).toBe(before.quantity);

    const returns = await prisma.inventoryMovement.count({
      where: {
        storeId,
        referenceType: 'ORDER',
        referenceId: cancelOrder.id,
        type: 'RETURN',
      },
    });
    expect(returns).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeId}/orders/${cancelOrder.id}/status`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ status: 'CANCELLED' })
      .expect(400);

    const afterRepeat = await prisma.inventoryItem.findFirstOrThrow({
      where: { storeId, productId },
    });
    expect(afterRepeat.quantity).toBe(before.quantity);

    const publicCancelled = await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/orders/${placed.body.data.publicReference}?email=${encodeURIComponent(`cancel.p13.${suffix}@example.com`)}`,
      )
      .expect(200);
    expect(publicCancelled.body.data.cancelReason).toBe('Out of stock');
    expect(
      publicCancelled.body.data.timeline.some(
        (e: { type: string }) => e.type === 'CANCELLED',
      ),
    ).toBe(true);
  });
});
