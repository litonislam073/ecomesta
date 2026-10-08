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
import { activateOnboarded, withPayment } from './support/onboarding';

describe('Customers (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const managerA = {
    email: `phase6.a.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const managerB = {
    email: `phase6.b.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staffA = {
    email: `phase6.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeAId = '';
  let storeBId = '';
  let tenantAId = '';
  let tenantBId = '';
  let customerAId = '';
  let customerBId = '';
  let addressAId = '';
  let addressBId = '';

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
    const redis = app.get(RedisService);
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
          lastName: 'Six',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboardA = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${managerA.token}`)
      .send(withPayment({
        businessName: 'Customer Tenant A',
        tenantSlug: `cust-tenant-a-${suffix}`,
        storeName: 'Customer Store A',
        storeSlug: `cust-store-a-${suffix}`,
      }))
      .expect(201).then(activateOnboarded(app));
    tenantAId = onboardA.body.data.tenant.id;
    storeAId = onboardA.body.data.store.id;

    const onboardB = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${managerB.token}`)
      .send(withPayment({
        businessName: 'Customer Tenant B',
        tenantSlug: `cust-tenant-b-${suffix}`,
        storeName: 'Customer Store B',
        storeSlug: `cust-store-b-${suffix}`,
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
      await prisma.customerAddress.deleteMany({
        where: { customer: { storeId: { in: storeIds } } },
      });
      await prisma.customer.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.auditLog.deleteMany({
        where: { storeId: { in: storeIds } },
      });
      await prisma.storeUser.deleteMany({
        where: { storeId: { in: storeIds } },
      });
      // New stores start with ready-made shipping (see default-shipping.ts).
      await prisma.shippingMethod.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.shippingZone.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.store.deleteMany({ where: { id: { in: storeIds } } });
    }
    if (tenantIds.length > 0) {
      await prisma.tenantUser.deleteMany({
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

  it('creates customers in each store', async () => {
    const a = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/customers`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        email: `john.a.${suffix}@example.com`,
        phone: '+8801711000001',
        firstName: 'John',
        lastName: 'Doe',
        notes: 'VIP customer',
      })
      .expect(201);
    customerAId = a.body.data.id;
    expect(a.body.data.email).toBe(`john.a.${suffix}@example.com`);
    expect(a.body.data.storeId).toBe(storeAId);

    const b = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeBId}/customers`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({
        email: `jane.b.${suffix}@example.com`,
        phone: '+1-555-0100',
        firstName: 'Jane',
        lastName: 'Roe',
      })
      .expect(201);
    customerBId = b.body.data.id;
  });

  it('lists and searches customers', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/customers`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .query({ search: 'John' })
      .expect(200);
    expect(list.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(list.body.data.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('gets customer details with addresses array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/customers/${customerAId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);
    expect(res.body.data.id).toBe(customerAId);
    expect(Array.isArray(res.body.data.addresses)).toBe(true);
    expect(res.body.data.totalOrders).toBeUndefined();
  });

  it('updates a customer', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeAId}/customers/${customerAId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ notes: 'Updated notes', firstName: 'Jonathan' })
      .expect(200);
    expect(res.body.data.firstName).toBe('Jonathan');
    expect(res.body.data.notes).toBe('Updated notes');
  });

  it('rejects invalid email/phone and UUID', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/customers`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        email: 'not-an-email',
        firstName: 'Bad',
        lastName: 'Email',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/customers`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        phone: 'abc',
        firstName: 'Bad',
        lastName: 'Phone',
      })
      .expect(400);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/customers/not-a-uuid`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(400);
  });

  it('rejects duplicate email in same store', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/customers`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        email: `john.a.${suffix}@example.com`,
        firstName: 'Dup',
        lastName: 'Email',
      })
      .expect(409);
  });

  it('blocks STORE_STAFF from creating customers but allows read', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/customers`)
      .set('Authorization', `Bearer ${staffA.token}`)
      .send({
        email: `staff.${suffix}@example.com`,
        firstName: 'Staff',
        lastName: 'Blocked',
      })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/customers`)
      .set('Authorization', `Bearer ${staffA.token}`)
      .expect(200);
  });

  it('blocks cross-store customer access (IDOR)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeBId}/customers/${customerBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeBId}/customers/${customerBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ firstName: 'Hacked' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeBId}/customers/${customerBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/customers/${customerBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(404);
  });

  it('creates and manages addresses', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/customers/${customerAId}/addresses`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        type: 'SHIPPING',
        firstName: 'John',
        lastName: 'Doe',
        addressLine1: '12 Example Road',
        city: 'Dhaka',
        state: 'Dhaka',
        postalCode: '1205',
        country: 'BD',
        phone: '+8801711000001',
      })
      .expect(201);
    addressAId = created.body.data.id;
    expect(created.body.data.country).toBe('BD');

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/customers/${customerAId}/addresses`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);
    expect(listed.body.data).toHaveLength(1);

    const updated = await request(app.getHttpServer())
      .patch(
        `/api/v1/stores/${storeAId}/customers/${customerAId}/addresses/${addressAId}`,
      )
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ city: 'Chittagong', type: 'BILLING' })
      .expect(200);
    expect(updated.body.data.city).toBe('Chittagong');
    expect(updated.body.data.type).toBe('BILLING');

    const bAddr = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeBId}/customers/${customerBId}/addresses`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({
        type: 'SHIPPING',
        addressLine1: '99 Other St',
        city: 'Austin',
        country: 'US',
      })
      .expect(201);
    addressBId = bAddr.body.data.id;
  });

  it('blocks cross-store address access (IDOR)', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/stores/${storeBId}/customers/${customerBId}/addresses/${addressBId}`,
      )
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(
        `/api/v1/stores/${storeBId}/customers/${customerBId}/addresses/${addressBId}`,
      )
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ city: 'Hacked' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/stores/${storeBId}/customers/${customerBId}/addresses/${addressBId}`,
      )
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(
        `/api/v1/stores/${storeAId}/customers/${customerAId}/addresses/${addressBId}`,
      )
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(404);
  });

  it('rejects invalid address id', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/stores/${storeAId}/customers/${customerAId}/addresses/not-a-uuid`,
      )
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(400);
  });

  it('deletes address then deletes customer without history', async () => {
    await request(app.getHttpServer())
      .delete(
        `/api/v1/stores/${storeAId}/customers/${customerAId}/addresses/${addressAId}`,
      )
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);

    const temp = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/customers`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        email: `temp.${suffix}@example.com`,
        firstName: 'Temp',
        lastName: 'Delete',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeAId}/customers/${temp.body.data.id}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);

    const gone = await prisma.customer.findUnique({
      where: { id: temp.body.data.id },
    });
    expect(gone).toBeNull();
  });

  it('writes customer audit events', async () => {
    const actions = await prisma.auditLog.findMany({
      where: {
        storeId: storeAId,
        action: {
          in: [
            'CUSTOMER_CREATED',
            'CUSTOMER_UPDATED',
            'CUSTOMER_ADDRESS_CREATED',
            'CUSTOMER_ADDRESS_DELETED',
            'CUSTOMER_DELETED',
          ],
        },
      },
      select: { action: true },
    });
    const set = new Set(actions.map((a) => a.action));
    expect(set.has('CUSTOMER_CREATED')).toBe(true);
    expect(set.has('CUSTOMER_UPDATED')).toBe(true);
    expect(set.has('CUSTOMER_ADDRESS_CREATED')).toBe(true);
    expect(set.has('CUSTOMER_ADDRESS_DELETED')).toBe(true);
    expect(set.has('CUSTOMER_DELETED')).toBe(true);
  });
});
