import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  PlatformRole,
  StoreStatus,
  SubscriptionStatus,
  UserStatus,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  assertSubscriptionStatusTransition,
  isValidSubscriptionTransition,
} from '../src/modules/admin/subscription-transitions';
import { activateOnboarded, withPayment } from './support/onboarding';

describe('Phase 15 super admin (e2e)', () => {
  jest.setTimeout(90_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const superAdmin = {
    email: `phase15.sa.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const owner = {
    email: `phase15.owner.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let tenantId = '';
  let storeId = '';
  const storeSlug = `p15-store-${suffix}`;
  let planId = '';
  let subscriptionPlanId = '';
  let subscriptionId = '';

  const authSa = () => ({ Authorization: `Bearer ${superAdmin.token}` });
  const authOwner = () => ({ Authorization: `Bearer ${owner.token}` });

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

    for (const user of [superAdmin, owner]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Fifteen',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    await prisma.user.update({
      where: { id: superAdmin.id },
      data: {
        platformRole: PlatformRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set(authOwner())
      .send(withPayment({
        businessName: 'P15 Tenant',
        tenantSlug: `p15-tenant-${suffix}`,
        storeName: 'P15 Store',
        storeSlug,
      }))
      .expect(201).then(activateOnboarded(app));
    tenantId = onboard.body.data.tenant.id;
    storeId = onboard.body.data.store.id;

    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });
  });

  beforeAll(async () => {
    // A run that was interrupted never reached afterAll, leaving its test plan
    // active and listed on the public pricing page. Retire any such leftovers.
    await prisma.subscriptionPlan.updateMany({
      where: { slug: { startsWith: 'p15-' }, active: true },
      data: { active: false },
    });
  });

  afterAll(async () => {
    // Active plans are listed on the public pricing page; keep test plans off it.
    if (subscriptionPlanId) {
      await prisma?.subscriptionPlan.updateMany({
        where: { id: subscriptionPlanId },
        data: { active: false },
      });
    }
    await app?.close();
    await redis?.onModuleDestroy();
  });

  it('rejects merchant users and anonymous callers on admin routes', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/stats').expect(401);

    for (const path of [
      '/api/v1/admin/stats',
      '/api/v1/admin/users',
      '/api/v1/admin/tenants',
      '/api/v1/admin/stores',
      '/api/v1/admin/plans',
      '/api/v1/admin/subscriptions',
      '/api/v1/admin/audit-logs',
    ]) {
      await request(app.getHttpServer())
        .get(path)
        .set(authOwner())
        .expect(403);
    }

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/tenants/${tenantId}/status`)
      .set(authOwner())
      .send({ status: 'SUSPENDED' })
      .expect(403);
  });

  it('returns platform stats for a super admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set(authSa())
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.users.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data.users.active).toBeGreaterThanOrEqual(2);
    expect(res.body.data.tenants.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.stores.active).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.data.orders.total).toBe('number');
    expect(res.body.data.orderRevenueSum).toMatch(/^\d+\.\d{2}$/);
    expect(res.body.data.recentAuditCount).toBeGreaterThanOrEqual(1);
  });

  it('lists and inspects users without leaking credentials', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .query({ search: owner.email, limit: 10 })
      .set(authSa())
      .expect(200);

    expect(list.body.data.meta.total).toBeGreaterThanOrEqual(1);
    const found = list.body.data.items.find(
      (item: { id: string }) => item.id === owner.id,
    );
    expect(found).toBeTruthy();
    expect(found.passwordHash).toBeUndefined();

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .query({ platformRole: 'SUPER_ADMIN', status: 'ACTIVE' })
      .set(authSa())
      .expect(200);
    expect(
      filtered.body.data.items.every(
        (item: { platformRole: string }) => item.platformRole === 'SUPER_ADMIN',
      ),
    ).toBe(true);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${owner.id}`)
      .set(authSa())
      .expect(200);
    expect(detail.body.data.passwordHash).toBeUndefined();
    expect(detail.body.data.tenantMemberships).toHaveLength(1);
    expect(detail.body.data.tenantMemberships[0].tenant.id).toBe(tenantId);
    expect(detail.body.data.storeMemberships).toHaveLength(1);
    expect(detail.body.data.storeMemberships[0].store.id).toBe(storeId);
  });

  it('lists tenants and stores with search filters', async () => {
    const tenants = await request(app.getHttpServer())
      .get('/api/v1/admin/tenants')
      .query({ search: `p15-tenant-${suffix}` })
      .set(authSa())
      .expect(200);
    expect(tenants.body.data.items).toHaveLength(1);
    expect(tenants.body.data.items[0].id).toBe(tenantId);
    expect(tenants.body.data.items[0].counts.stores).toBe(1);

    const tenantDetail = await request(app.getHttpServer())
      .get(`/api/v1/admin/tenants/${tenantId}`)
      .set(authSa())
      .expect(200);
    expect(tenantDetail.body.data.stores).toHaveLength(1);
    expect(tenantDetail.body.data.memberships[0].user.email).toBe(owner.email);
    expect(tenantDetail.body.data.counts.orders).toBe(0);
    expect(Array.isArray(tenantDetail.body.data.recentAuditLogs)).toBe(true);

    const stores = await request(app.getHttpServer())
      .get('/api/v1/admin/stores')
      .query({ tenantId, search: storeSlug })
      .set(authSa())
      .expect(200);
    expect(stores.body.data.items).toHaveLength(1);
    expect(stores.body.data.items[0].tenant.id).toBe(tenantId);

    const storeDetail = await request(app.getHttpServer())
      .get(`/api/v1/admin/stores/${storeId}`)
      .set(authSa())
      .expect(200);
    expect(storeDetail.body.data.counts.products).toBe(0);
    expect(storeDetail.body.data.memberships).toHaveLength(1);
  });

  it('suspending a tenant takes its storefront offline without touching store rows', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/tenants/${tenantId}/status`)
      .set(authSa())
      .send({ status: 'SUSPENDED' })
      .expect(200);

    const offline = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}`)
      .expect(403);
    expect(offline.body.error.code).toBe('STORE_UNAVAILABLE');

    // Store row is untouched so reactivation restores the previous state.
    const store = await prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    expect(store.status).toBe(StoreStatus.ACTIVE);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/products`)
      .set(authOwner())
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/tenants/${tenantId}/status`)
      .set(authSa())
      .send({ status: 'ACTIVE' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}`)
      .expect(200);
  });

  it('suspending a store takes only that storefront offline', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/stores/${storeId}/status`)
      .set(authSa())
      .send({ status: 'SUSPENDED' })
      .expect(200);

    const offline = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}`)
      .expect(403);
    expect(offline.body.error.code).toBe('STORE_UNAVAILABLE');

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/products`)
      .set(authOwner())
      .expect(403);

    const reactivated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/stores/${storeId}/status`)
      .set(authSa())
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(reactivated.body.data.status).toBe('ACTIVE');

    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}`)
      .expect(200);
  });

  it('refuses to suspend or demote the last active super admin', async () => {
    const others = await prisma.user.findMany({
      where: {
        id: { not: superAdmin.id },
        platformRole: PlatformRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, status: true },
    });

    // Park any pre-existing super admins so this user is provably the last one.
    await prisma.user.updateMany({
      where: { id: { in: others.map((user) => user.id) } },
      data: { status: UserStatus.INACTIVE },
    });

    try {
      const suspend = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${superAdmin.id}/status`)
        .set(authSa())
        .send({ status: 'SUSPENDED' })
        .expect(422);
      expect(suspend.body.error.message).toMatch(/last active Super Admin/i);

      const demote = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${superAdmin.id}/platform-role`)
        .set(authSa())
        .send({ platformRole: 'USER' })
        .expect(422);
      expect(demote.body.error.message).toMatch(/last active Super Admin/i);

      const stillSuperAdmin = await prisma.user.findUniqueOrThrow({
        where: { id: superAdmin.id },
      });
      expect(stillSuperAdmin.platformRole).toBe(PlatformRole.SUPER_ADMIN);
      expect(stillSuperAdmin.status).toBe(UserStatus.ACTIVE);
    } finally {
      for (const user of others) {
        await prisma.user.update({
          where: { id: user.id },
          data: { status: user.status },
        });
      }
    }
  });

  it('promotes and suspends merchant users with audit trail', async () => {
    const promoted = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${owner.id}/platform-role`)
      .set(authSa())
      .send({ platformRole: 'SUPER_ADMIN' })
      .expect(200);
    expect(promoted.body.data.platformRole).toBe('SUPER_ADMIN');

    const demoted = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${owner.id}/platform-role`)
      .set(authSa())
      .send({ platformRole: 'USER' })
      .expect(200);
    expect(demoted.body.data.platformRole).toBe('USER');

    const suspended = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${owner.id}/status`)
      .set(authSa())
      .send({ status: 'SUSPENDED' })
      .expect(200);
    expect(suspended.body.data.status).toBe('SUSPENDED');

    const sessions = await prisma.authSession.findMany({
      where: { userId: owner.id, revokedAt: null },
    });
    expect(sessions).toHaveLength(0);

    // A suspended user's sessions are revoked → Unauthorized on access JWT.
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/products`)
      .set(authOwner())
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(authOwner())
      .expect(401);

    const reactivated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${owner.id}/status`)
      .set(authSa())
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(reactivated.body.data.status).toBe('ACTIVE');

    // Role downgrade is loaded from DB on subsequent access validation.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${owner.id}/platform-role`)
      .set(authSa())
      .send({ platformRole: 'SUPER_ADMIN' })
      .expect(200);

    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: owner.password })
      .expect(200);
    const elevatedToken = ownerLogin.body.data.accessToken as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${owner.id}/platform-role`)
      .set(authSa())
      .send({ platformRole: 'USER' })
      .expect(200);

    // Stale elevated JWT must not keep Super Admin powers.
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${elevatedToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${owner.id}/status`)
      .set(authSa())
      .send({ status: 'PENDING' })
      .expect(400);
  });

  it('creates, updates and deactivates subscription plans', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set(authSa())
      .send({
        name: 'P15 Growth',
        slug: `  P15-Growth-${suffix}  `,
        description: 'Phase 15 plan',
        monthlyPrice: '29',
        yearlyPrice: 290,
        configuration: { maxStores: 3 },
      })
      .expect(201);

    expect(created.body.data.slug).toBe(`p15-growth-${suffix}`);
    expect(created.body.data.monthlyPrice).toBe('29.00');
    expect(created.body.data.yearlyPrice).toBe('290.00');
    expect(created.body.data.active).toBe(true);
    expect(created.body.data.configuration).toEqual({ maxStores: 3 });
    planId = created.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set(authSa())
      .send({
        name: 'Duplicate',
        slug: `p15-growth-${suffix}`,
        monthlyPrice: '10',
        yearlyPrice: '100',
      })
      .expect(409);

    await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set(authSa())
      .send({
        name: 'Bad Money',
        slug: `p15-bad-${suffix}`,
        monthlyPrice: '-5',
        yearlyPrice: '100',
      })
      .expect(400);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/plans/${planId}`)
      .set(authSa())
      .send({ monthlyPrice: '39.50' })
      .expect(200);
    expect(updated.body.data.monthlyPrice).toBe('39.50');

    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/plans')
      .query({ search: `p15-growth-${suffix}`, active: 'true' })
      .set(authSa())
      .expect(200);
    expect(listed.body.data.items).toHaveLength(1);

    const deactivated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/plans/${planId}/status`)
      .set(authSa())
      .send({ active: false })
      .expect(200);
    expect(deactivated.body.data.active).toBe(false);

    const deactivationAudit = await prisma.auditLog.findFirst({
      where: { action: 'PLAN_DEACTIVATED', entityId: planId },
    });
    expect(deactivationAudit).toBeTruthy();
  });

  it('assigns subscriptions and enforces status transitions', async () => {
    const plan = await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set(authSa())
      .send({
        name: 'P15 Starter',
        slug: `p15-starter-${suffix}`,
        monthlyPrice: '9.00',
        yearlyPrice: '90.00',
      })
      .expect(201);
    subscriptionPlanId = plan.body.data.id;

    // An inactive plan cannot be assigned.
    await request(app.getHttpServer())
      .post('/api/v1/admin/subscriptions')
      .set(authSa())
      .send({ tenantId, planId, billingCycle: 'MONTHLY' })
      .expect(422);

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/subscriptions')
      .set(authSa())
      .send({
        tenantId,
        planId: subscriptionPlanId,
        billingCycle: 'MONTHLY',
      })
      .expect(201);
    expect(created.body.data.status).toBe('TRIALING');
    expect(created.body.data.tenant.id).toBe(tenantId);
    expect(created.body.data.plan.monthlyPrice).toBe('9.00');
    subscriptionId = created.body.data.id;

    const activated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/subscriptions/${subscriptionId}/status`)
      .set(authSa())
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(activated.body.data.status).toBe('ACTIVE');

    // ACTIVE -> TRIALING is not a legal move.
    const invalid = await request(app.getHttpServer())
      .patch(`/api/v1/admin/subscriptions/${subscriptionId}/status`)
      .set(authSa())
      .send({ status: 'TRIALING' })
      .expect(422);
    expect(invalid.body.error.message).toMatch(/Invalid subscription status/i);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/subscriptions/${subscriptionId}/status`)
      .set(authSa())
      .send({ status: 'ACTIVE' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/subscriptions/${subscriptionId}/status`)
      .set(authSa())
      .send({ status: 'PAST_DUE' })
      .expect(200);

    const cancelled = await request(app.getHttpServer())
      .patch(`/api/v1/admin/subscriptions/${subscriptionId}/status`)
      .set(authSa())
      .send({ status: 'CANCELLED' })
      .expect(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/subscriptions')
      .query({ tenantId, status: 'CANCELLED' })
      .set(authSa())
      .expect(200);
    expect(listed.body.data.items).toHaveLength(1);
    expect(listed.body.data.items[0].id).toBe(subscriptionId);

    const searched = await request(app.getHttpServer())
      .get('/api/v1/admin/subscriptions')
      .query({ search: `p15-tenant-${suffix}` })
      .set(authSa())
      .expect(200);
    // The tenant also has the plan its sign-up payment started; the search
    // finds both, and the one assigned here among them.
    const searchedIds = (searched.body.data.items as Array<{ id: string; plan: { slug: string } }>)
      .filter((item) => item.plan.slug === `p15-starter-${suffix}`)
      .map((item) => item.id);
    expect(searchedIds).toEqual([subscriptionId]);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/subscriptions/${subscriptionId}`)
      .set(authSa())
      .expect(200);
    expect(detail.body.data.plan.slug).toBe(`p15-starter-${suffix}`);
  });

  it('searches audit logs written by admin actions', async () => {
    const byAction = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .query({ action: 'TENANT_SUSPENDED', tenantId })
      .set(authSa())
      .expect(200);
    expect(byAction.body.data.items).toHaveLength(1);
    expect(byAction.body.data.items[0].user.email).toBe(superAdmin.email);
    expect(byAction.body.data.items[0].metadata.status).toBe('SUSPENDED');

    const byActor = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .query({
        userId: superAdmin.id,
        from: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        limit: 100,
      })
      .set(authSa())
      .expect(200);
    const actions = byActor.body.data.items.map(
      (item: { action: string }) => item.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        'TENANT_SUSPENDED',
        'TENANT_ACTIVATED',
        'STORE_SUSPENDED',
        'STORE_ACTIVATED',
        'PLATFORM_ROLE_CHANGED',
        'USER_SUSPENDED',
        'USER_ACTIVATED',
        'PLAN_CREATED',
        'SUBSCRIPTION_STATUS_CHANGED',
      ]),
    );

    await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .query({
        from: new Date().toISOString(),
        to: new Date(Date.now() - 60_000).toISOString(),
      })
      .set(authSa())
      .expect(400);
  });

  describe('subscription transition map', () => {
    it('allows the documented forward moves', () => {
      expect(
        isValidSubscriptionTransition(
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.ACTIVE,
        ),
      ).toBe(true);
      expect(
        isValidSubscriptionTransition(
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
        ),
      ).toBe(true);
      expect(
        isValidSubscriptionTransition(
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.ACTIVE,
        ),
      ).toBe(true);
    });

    it('only allows reactivation out of terminal states', () => {
      expect(
        isValidSubscriptionTransition(
          SubscriptionStatus.CANCELLED,
          SubscriptionStatus.ACTIVE,
        ),
      ).toBe(true);
      expect(
        isValidSubscriptionTransition(
          SubscriptionStatus.EXPIRED,
          SubscriptionStatus.ACTIVE,
        ),
      ).toBe(true);
      expect(
        isValidSubscriptionTransition(
          SubscriptionStatus.CANCELLED,
          SubscriptionStatus.TRIALING,
        ),
      ).toBe(false);
      expect(
        isValidSubscriptionTransition(
          SubscriptionStatus.EXPIRED,
          SubscriptionStatus.PAST_DUE,
        ),
      ).toBe(false);
    });

    it('throws 422 for illegal moves and 400 for no-ops', () => {
      expect(() =>
        assertSubscriptionStatusTransition(
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIALING,
        ),
      ).toThrow(/Invalid subscription status transition/);
      expect(() =>
        assertSubscriptionStatusTransition(
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.ACTIVE,
        ),
      ).toThrow(/already ACTIVE/);
    });
  });
});
