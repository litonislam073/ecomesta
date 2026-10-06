import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { MembershipStatus, StoreRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  assertOrderStatusTransition,
  assertPaymentStatusTransition,
} from '../src/modules/orders/order-transitions';
import { UnprocessableEntityException } from '@nestjs/common';
import { activateOnboarded, withPayment } from './support/onboarding';

describe('Orders (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const managerA = {
    email: `phase8.a.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const managerB = {
    email: `phase8.b.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staffA = {
    email: `phase8.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeAId = '';
  let storeBId = '';
  let tenantAId = '';
  let tenantBId = '';
  let productAId = '';
  let productBId = '';
  let customerAId = '';
  let customerBId = '';
  let orderAId = '';

  const shippingAddress = {
    name: 'Ada Lovelace',
    phone: '+15550001',
    email: `guest.${suffix}@example.com`,
    addressLine1: '123 Main St',
    city: 'Dallas',
    state: 'TX',
    postalCode: '75001',
    country: 'US',
  };

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

    const keys = await redis.getClient().keys('auth:rl:*');
    if (keys.length > 0) {
      await redis.getClient().del(...keys);
    }

    for (const user of [managerA, managerB, staffA]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Eight',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboardA = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${managerA.token}`)
      .send(withPayment({
        businessName: 'Orders Tenant A',
        tenantSlug: `ord-tenant-a-${suffix}`,
        storeName: 'Orders Store A',
        storeSlug: `ord-store-a-${suffix}`,
      }))
      .expect(201).then(activateOnboarded(app));
    tenantAId = onboardA.body.data.tenant.id;
    storeAId = onboardA.body.data.store.id;

    const onboardB = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${managerB.token}`)
      .send(withPayment({
        businessName: 'Orders Tenant B',
        tenantSlug: `ord-tenant-b-${suffix}`,
        storeName: 'Orders Store B',
        storeSlug: `ord-store-b-${suffix}`,
      }))
      .expect(201).then(activateOnboarded(app));
    tenantBId = onboardB.body.data.tenant.id;
    storeBId = onboardB.body.data.store.id;

    await prisma.storeUser.create({
      data: {
        storeId: storeAId,
        userId: staffA.id,
        role: StoreRole.STORE_STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });
    const loginStaff = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: staffA.email, password: staffA.password })
      .expect(200);
    staffA.token = loginStaff.body.data.accessToken;

    const productA = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/products`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Widget',
        slug: `widget-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '10.50',
        trackInventory: true,
        allowBackorder: false,
        sku: `W-${suffix}`,
      })
      .expect(201);
    productAId = productA.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/inventory/adjust`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        productId: productAId,
        quantity: 5,
        type: 'ADJUSTMENT',
        note: 'seed',
      })
      .expect(201);

    const productB = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeBId}/products`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({
        name: 'Gadget',
        slug: `gadget-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '20.00',
        trackInventory: true,
        allowBackorder: false,
        sku: `G-${suffix}`,
      })
      .expect(201);
    productBId = productB.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeBId}/inventory/adjust`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({
        productId: productBId,
        quantity: 3,
        type: 'ADJUSTMENT',
      })
      .expect(201);

    const customerA = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/customers`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        email: `cust.a.${suffix}@example.com`,
        firstName: 'Store',
        lastName: 'Alpha',
        phone: '+15551111',
      })
      .expect(201);
    customerAId = customerA.body.data.id;

    const customerB = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeBId}/customers`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({
        email: `cust.b.${suffix}@example.com`,
        firstName: 'Store',
        lastName: 'Beta',
      })
      .expect(201);
    customerBId = customerB.body.data.id;
  });

  afterAll(async () => {
    const emails = [managerA.email, managerB.email, staffA.email];
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const storeIds = [storeAId, storeBId].filter(Boolean);
    const tenantIds = [tenantAId, tenantBId].filter(Boolean);

    if (storeIds.length > 0) {
      await prisma.shipment.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.payment.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.orderItem.deleteMany({
        where: { order: { storeId: { in: storeIds } } },
      });
      await prisma.orderAddress.deleteMany({
        where: { order: { storeId: { in: storeIds } } },
      });
      await prisma.order.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.inventoryMovement.deleteMany({
        where: { storeId: { in: storeIds } },
      });
      await prisma.inventoryItem.deleteMany({
        where: { storeId: { in: storeIds } },
      });
      await prisma.productVariant.deleteMany({
        where: { storeId: { in: storeIds } },
      });
      await prisma.product.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.customerAddress.deleteMany({
        where: { customer: { storeId: { in: storeIds } } },
      });
      await prisma.customer.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.auditLog.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.storeUser.deleteMany({
        where: { storeId: { in: storeIds } },
      });
      await prisma.store.deleteMany({ where: { id: { in: storeIds } } });
    }
    if (tenantIds.length > 0) {
      await prisma.tenantUser.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      // Sign-up payments and the plan they started belong to the tenant.
      await prisma.billingPayment.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('creates guest order with snapshots, totals, and inventory deduction', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/orders`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        items: [{ productId: productAId, quantity: 2 }],
        shippingAddress,
        shippingTotal: '5.00',
        discountTotal: '1.00',
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
      })
      .expect(201);

    orderAId = res.body.data.id;
    expect(res.body.data.orderNumber).toMatch(/^EM-\d+$/);
    expect(res.body.data.subtotal).toBe('21.00');
    expect(res.body.data.discountTotal).toBe('1.00');
    expect(res.body.data.shippingTotal).toBe('5.00');
    expect(res.body.data.grandTotal).toBe('25.00');
    expect(res.body.data.items[0].productName).toBe('Widget');
    expect(res.body.data.items[0].unitPrice).toBe('10.50');
    expect(res.body.data.items[0].totalPrice).toBe('21.00');
    expect(res.body.data.customerId).toBeNull();
    expect(res.body.data.addresses).toHaveLength(2);

    const inv = await prisma.inventoryItem.findFirst({
      where: { storeId: storeAId, productId: productAId, variantId: null },
    });
    expect(inv?.quantity).toBe(3);

    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        storeId: storeAId,
        referenceType: 'ORDER',
        referenceId: orderAId,
        type: 'SALE',
      },
    });
    expect(movement?.quantity).toBe(-2);
  });

  it('creates order linked to same-store customer', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/orders`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        customerId: customerAId,
        items: [{ productId: productAId, quantity: 1 }],
        shippingAddress,
      })
      .expect(201);
    expect(res.body.data.customerId).toBe(customerAId);
  });

  it('rejects cross-store product, customer, and body storeId injection', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/orders`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        items: [{ productId: productBId, quantity: 1 }],
        shippingAddress,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/orders`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        customerId: customerBId,
        items: [{ productId: productAId, quantity: 1 }],
        shippingAddress,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/orders`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        items: [{ productId: productAId, quantity: 1 }],
        shippingAddress,
        storeId: storeBId,
        tenantId: tenantBId,
        role: 'SUPER_ADMIN',
      })
      .expect(400);
  });

  it('enforces IDOR: cannot read or update another store order', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeBId}/orders/${orderAId}`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeBId}/orders/${orderAId}/status`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ status: 'CONFIRMED' })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/orders/${orderAId}`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .expect(403);
  });

  it('allows staff to list/view but not create or mutate', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/orders`)
      .set('Authorization', `Bearer ${staffA.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/orders`)
      .set('Authorization', `Bearer ${staffA.token}`)
      .send({
        items: [{ productId: productAId, quantity: 1 }],
        shippingAddress,
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeAId}/orders/${orderAId}/status`)
      .set('Authorization', `Bearer ${staffA.token}`)
      .send({ status: 'CONFIRMED' })
      .expect(403);
  });

  it('rejects unauthorized access', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/orders`)
      .expect(401);
  });

  it('lists and details orders with filters', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/orders?status=PENDING&search=EM-`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);
    expect(list.body.data.items.length).toBeGreaterThan(0);
    expect(list.body.data.meta.page).toBe(1);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/orders/${orderAId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);
    expect(detail.body.data.items.length).toBe(1);
    expect(detail.body.data.payments.length).toBe(1);
  });

  it('updates order/payment/fulfillment status with valid transitions only', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeAId}/orders/${orderAId}/status`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ status: 'COMPLETED' })
      .expect(422);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeAId}/orders/${orderAId}/status`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ status: 'CONFIRMED' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeAId}/orders/${orderAId}/payment-status`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ paymentStatus: 'PAID' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeAId}/orders/${orderAId}/fulfillment-status`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ fulfillmentStatus: 'FULFILLED' })
      .expect(200);

    expect(() => assertOrderStatusTransition('PENDING', 'COMPLETED')).toThrow(
      UnprocessableEntityException,
    );
    expect(() => assertPaymentStatusTransition('REFUNDED', 'PAID')).toThrow(
      UnprocessableEntityException,
    );
  });

  it('cancels order once, restores stock once, rejects double cancel', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/orders`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        items: [{ productId: productAId, quantity: 1 }],
        shippingAddress,
      })
      .expect(201);

    const before = await prisma.inventoryItem.findFirst({
      where: { storeId: storeAId, productId: productAId, variantId: null },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeAId}/orders/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ status: 'CANCELLED' })
      .expect(200);

    const after = await prisma.inventoryItem.findFirst({
      where: { storeId: storeAId, productId: productAId, variantId: null },
    });
    expect(after?.quantity).toBe((before?.quantity ?? 0) + 1);

    const returns = await prisma.inventoryMovement.count({
      where: {
        storeId: storeAId,
        referenceType: 'ORDER',
        referenceId: created.body.data.id,
        type: 'RETURN',
      },
    });
    expect(returns).toBe(1);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeAId}/orders/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ status: 'CANCELLED' })
      .expect(400);

    const afterSecond = await prisma.inventoryItem.findFirst({
      where: { storeId: storeAId, productId: productAId, variantId: null },
    });
    expect(afterSecond?.quantity).toBe(after?.quantity);
  });

  it('handles concurrent purchase of the last unit safely', async () => {
    const limited = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/products`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Limited',
        slug: `limited-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '9.99',
        trackInventory: true,
        allowBackorder: false,
        sku: `L-${suffix}`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/inventory/adjust`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        productId: limited.body.data.id,
        quantity: 1,
        type: 'ADJUSTMENT',
      })
      .expect(201);

    const payload = {
      items: [{ productId: limited.body.data.id, quantity: 1 }],
      shippingAddress,
    };

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/stores/${storeAId}/orders`)
        .set('Authorization', `Bearer ${managerA.token}`)
        .send(payload),
      request(app.getHttpServer())
        .post(`/api/v1/stores/${storeAId}/orders`)
        .set('Authorization', `Bearer ${managerA.token}`)
        .send(payload),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 422]);

    const inv = await prisma.inventoryItem.findFirst({
      where: {
        storeId: storeAId,
        productId: limited.body.data.id,
        variantId: null,
      },
    });
    expect(inv?.quantity).toBe(0);
    expect(inv!.quantity).toBeGreaterThanOrEqual(0);

    const sales = await prisma.inventoryMovement.count({
      where: {
        storeId: storeAId,
        productId: limited.body.data.id,
        type: 'SALE',
      },
    });
    expect(sales).toBe(1);
  });

  it('rejects empty items and negative monetary values', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/orders`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ items: [], shippingAddress })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/orders`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        items: [{ productId: productAId, quantity: 1 }],
        shippingAddress,
        discountTotal: '-1',
      })
      .expect(400);
  });
});
