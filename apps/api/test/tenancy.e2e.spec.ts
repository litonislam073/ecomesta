import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { MembershipStatus, StoreRole, TenantRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { OnboardingService } from '../src/modules/onboarding/onboarding.service';
import { activateOnboarded, withPayment } from './support/onboarding';

describe('Tenancy (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const suffix = Date.now();

  const userA = {
    email: `phase4.a.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const userB = {
    email: `phase4.b.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staffUser = {
    email: `phase4.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let tenantAId = '';
  let storeAId = '';
  let tenantBId = '';
  let storeBId = '';

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

    for (const user of [userA, userB, staffUser]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Four',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }
  });

  afterAll(async () => {
    const emails = [userA.email, userB.email, staffUser.email];
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);

    await prisma.auditLog.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.storeUser.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.tenantUser.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });

    const tenantIds = [tenantAId, tenantBId].filter(Boolean);
    if (tenantIds.length > 0) {
      // New stores start with ready-made shipping (see default-shipping.ts).
      await prisma.shippingMethod.deleteMany({ where: { store: { tenantId: { in: tenantIds } } } });
      await prisma.shippingZone.deleteMany({ where: { store: { tenantId: { in: tenantIds } } } });
      await prisma.store.deleteMany({ where: { tenantId: { in: tenantIds } } });
      // Sign-up payments and the plan they started belong to the tenant.
      await prisma.billingPayment.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }

    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('creates tenant and assigns OWNER', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        name: 'Tenant A',
        slug: `tenant-a-${suffix}`,
      })
      .expect(201);

    tenantAId = res.body.data.id;
    expect(res.body.data.membership.role).toBe(TenantRole.OWNER);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.slug).toBe(`tenant-a-${suffix}`);
  });

  it('rejects privilege-escalation fields on tenant create', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        name: 'Escalation Attempt',
        slug: `tenant-escalation-${suffix}`,
        role: 'ADMIN',
        status: 'SUSPENDED',
        ownerId: userB.id,
      })
      .expect(400);
  });

  it('rejects duplicate tenant slug', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Dup', slug: `tenant-a-${suffix}` })
      .expect(409);
  });

  it('creates store for OWNER and assigns STORE_MANAGER', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantAId}/stores`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        name: 'Store A',
        slug: `store-a-${suffix}`,
        currency: 'BDT',
        timezone: 'Asia/Dhaka',
        locale: 'en-BD',
      })
      .expect(201);

    storeAId = res.body.data.id;
    expect(res.body.data.membership.role).toBe(StoreRole.STORE_MANAGER);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.tenantId).toBe(tenantAId);
  });

  it('rejects privilege-escalation fields on store create', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantAId}/stores`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        name: 'Escalation Store',
        slug: `store-escalation-${suffix}`,
        status: 'ACTIVE',
        role: 'STORE_STAFF',
        tenantId: '00000000-0000-0000-0000-000000000099',
      })
      .expect(400);
  });

  it('rejects store slug conflict', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantAId}/stores`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Dup Store', slug: `store-a-${suffix}` })
      .expect(409);
  });

  it('blocks STAFF from creating stores', async () => {
    await prisma.tenantUser.create({
      data: {
        tenantId: tenantAId,
        userId: staffUser.id,
        role: TenantRole.STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantAId}/stores`)
      .set('Authorization', `Bearer ${staffUser.token}`)
      .send({ name: 'Staff Store', slug: `staff-store-${suffix}` })
      .expect(403);
  });

  it('rejects unauthenticated onboarding', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .send(withPayment({
        businessName: 'No Auth Co',
        storeName: 'No Auth Store',
        tenantSlug: `no-auth-${suffix}`,
        storeSlug: `no-auth-store-${suffix}`,
      }))
      .expect(401);
  });

  it('onboards tenant+store atomically for user B', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${userB.token}`)
      .send(withPayment({
        businessName: 'Tenant B Co',
        storeName: 'Store B',
        tenantSlug: `tenant-b-${suffix}`,
        storeSlug: `store-b-${suffix}`,
      }))
      .expect(201).then(activateOnboarded(app));

    tenantBId = res.body.data.tenant.id;
    storeBId = res.body.data.store.id;
    // Offline until the sign-up payment is confirmed (activateOnboarded does that next).
    expect(res.body.data.store.status).toBe('INACTIVE');
    expect(res.body.data.store.currency).toBe('BDT');
    expect(res.body.data.store.timezone).toBe('Asia/Dhaka');
    expect(res.body.data.store.locale).toBe('en-BD');

    const owner = await prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: { tenantId: tenantBId, userId: userB.id },
      },
    });
    const manager = await prisma.storeUser.findUnique({
      where: {
        storeId_userId: { storeId: storeBId, userId: userB.id },
      },
    });
    expect(owner?.role).toBe(TenantRole.OWNER);
    expect(manager?.role).toBe(StoreRole.STORE_MANAGER);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/stores')
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(200);
    const ids = listed.body.data.map((item: { id: string }) => item.id);
    expect(ids).toContain(storeBId);
  });

  it('rolls back onboarding when tenant slug conflicts', async () => {
    const beforeStores = await prisma.store.count({
      where: { slug: `orphan-store-${suffix}` },
    });

    await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${userB.token}`)
      .send(withPayment({
        businessName: 'Should Fail',
        storeName: 'Orphan Store',
        tenantSlug: `tenant-a-${suffix}`,
        storeSlug: `orphan-store-${suffix}`,
      }))
      .expect(409);

    const afterStores = await prisma.store.count({
      where: { slug: `orphan-store-${suffix}` },
    });
    expect(afterStores).toBe(beforeStores);
  });

  it('blocks unauthorized store creation in another tenant', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantBId}/stores`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Hack Store', slug: `hack-store-${suffix}` })
      .expect(403);
  });

  it('lists only own tenants for normal users', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants')
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);

    const ids = res.body.data.map((item: { id: string }) => item.id);
    expect(ids).toContain(tenantAId);
    expect(ids).not.toContain(tenantBId);
  });

  it('blocks cross-tenant IDOR reads', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantBId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantBId}/stores`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantBId}/members`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeBId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(403);
  });

  it('allows authorized store access and blocks STAFF without StoreUser', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}`)
      .set('Authorization', `Bearer ${staffUser.token}`)
      .expect(403);
  });

  it('rolls back tenant create when membership fails mid-transaction', async () => {
    const onboarding = app.get(OnboardingService);
    const spy = jest
      .spyOn(prisma, '$transaction')
      .mockImplementationOnce(async () => {
        throw new Error('forced failure');
      });

    const before = await prisma.tenant.count({
      where: { slug: `tx-fail-${suffix}` },
    });

    await expect(
      onboarding.createTenantAndStore(
        userA.id,
        withPayment({
          businessName: 'TX Fail',
          storeName: 'TX Fail Store',
          tenantSlug: `tx-fail-${suffix}`,
          storeSlug: `tx-fail-store-${suffix}`,
        }),
      ),
    ).rejects.toThrow('forced failure');

    const after = await prisma.tenant.count({
      where: { slug: `tx-fail-${suffix}` },
    });
    expect(after).toBe(before);
    spy.mockRestore();
  });

  it('allows Super Admin to read another tenant', async () => {
    const adminEmail = (
      process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@ecomesta.local'
    )
      .trim()
      .toLowerCase();
    const adminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
    if (!adminPassword) {
      return;
    }

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantAId}`)
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(200);
  });
});
