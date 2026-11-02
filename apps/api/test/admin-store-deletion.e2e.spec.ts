import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { MembershipStatus, PlatformRole, StoreStatus } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { EmailService } from '../src/modules/email/email.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';

describe('Admin store deletion (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const unique = Date.now().toString(36);
  const password = 'SecurePass1';
  const userIds: string[] = [];
  const tenantIds: string[] = [];
  let adminToken = '';
  let merchantToken = '';
  let merchantId = '';
  let storeId = '';
  const slug = `del-${unique}`;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function register(email: string) {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'Del', lastName: 'Test' })
      .expect(201);
    userIds.push(res.body.data.user.id);
    return res.body.data as { accessToken: string; user: { id: string } };
  }

  async function clearRateLimits() {
    const client = redis.getClient();
    for (const pattern of ['auth:rl:register*', 'auth:rl:login*']) {
      const keys = await client.keys(pattern);
      if (keys.length) await client.del(...keys);
    }
  }

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await clearRateLimits();

    const admin = await register(`del.admin.${unique}@example.com`);
    await prisma.user.update({ where: { id: admin.user.id }, data: { platformRole: PlatformRole.SUPER_ADMIN } });
    adminToken = admin.accessToken;

    const merchant = await register(`del.owner.${unique}@example.com`);
    merchantToken = merchant.accessToken;
    merchantId = merchant.user.id;
    const onboarded = await http()
      .post('/api/v1/onboarding/store')
      .set(as(merchantToken))
      .send(
        withPayment({
          businessName: 'Mistake Business',
          storeName: 'Mistake Store',
          tenantSlug: `del-biz-${unique}`,
          storeSlug: slug,
        }),
      )
      .expect(201)
      .then(activateOnboarded(app));
    storeId = onboarded.body.data.store.id;
    tenantIds.push(onboarded.body.data.tenant.id);

    // Some content, so permanent deletion has something to erase.
    const category = await prisma.category.create({ data: { storeId, name: 'Shirts', slug: 'shirts' } });
    await prisma.category.create({ data: { storeId, name: 'Polo', slug: 'polo', parentId: category.id } });
    await prisma.product.create({ data: { storeId, name: 'Tee', slug: 'tee', basePrice: '500.00' } });
    await prisma.customer.create({ data: { storeId, firstName: 'Karim', phone: '01712345678' } });
  });

  afterAll(async () => {
    await app.get(EmailService).whenIdle();
    const leftover = await prisma.store.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true, slug: true, deletedSlug: true } });
    for (const store of leftover) {
      await http()
        .post(`/api/v1/admin/stores/${store.id}/permanent-delete`)
        .set(as(adminToken))
        .send({ confirmSlug: store.deletedSlug ?? store.slug });
    }
    await prisma.emailDelivery.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { tenantId: { in: tenantIds } }] } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { tenantId: { in: tenantIds } }] } });
    await prisma.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.billingPayment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenantUser.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await clearRateLimits();
    await app.close();
  });

  it('only lets a Super Admin delete stores', async () => {
    await http().post(`/api/v1/admin/stores/${storeId}/soft-delete`).set(as(merchantToken)).send({}).expect(403);
  });

  it('soft delete takes the store away from the merchant and frees its address', async () => {
    const res = await http()
      .post(`/api/v1/admin/stores/${storeId}/soft-delete`)
      .set(as(adminToken))
      .send({ reason: 'Opened by mistake' })
      .expect(200);
    expect(res.body.data).toMatchObject({ status: 'SUSPENDED', deletedSlug: slug, slug: `deleted--${storeId}` });
    expect(res.body.data.deletedAt).toBeTruthy();

    const me = await http().get('/api/v1/auth/me').set(as(merchantToken)).expect(200);
    expect(me.body.data.memberships.stores).toEqual([]);
    await http().get(`/api/v1/stores/${storeId}`).set(as(merchantToken)).expect(403);
    await http().get(`/api/v1/public/stores/${slug}`).expect(404);

    // A deleted store cannot be switched back on through the status control.
    await http().patch(`/api/v1/admin/stores/${storeId}/status`).set(as(adminToken)).send({ status: 'ACTIVE' }).expect(409);
    const deletedList = await http().get('/api/v1/admin/stores?deleted=deleted&search=' + storeId.slice(0, 8)).set(as(adminToken)).expect(200);
    expect(deletedList.body.data.items.map((s: { id: string }) => s.id)).toContain(storeId);
  });

  it('lets the merchant open a new store on the plan they already paid for', async () => {
    const business = await http().get('/api/v1/onboarding/existing-business').set(as(merchantToken)).expect(200);
    expect(business.body.data).toEqual({ name: 'Mistake Business', planName: 'Business', planActive: true, awaitingPayment: false });

    // The freed address can be used again.
    const reopened = await http()
      .post('/api/v1/onboarding/reopen-store')
      .set(as(merchantToken))
      .send({ storeName: 'Right Store', storeSlug: slug })
      .expect(201);
    expect(reopened.body.data.store).toMatchObject({ slug, status: 'ACTIVE', tenantId: tenantIds[0] });
    expect(await prisma.billingPayment.count({ where: { tenantId: tenantIds[0] } })).toBe(1);

    const me = await http().get('/api/v1/auth/me').set(as(merchantToken)).expect(200);
    expect(me.body.data.memberships.stores).toHaveLength(1);
    // Now the business has a store again, so there is nothing to reopen.
    const none = await http().get('/api/v1/onboarding/existing-business').set(as(merchantToken)).expect(200);
    expect(none.body.data).toBeNull();
    await http().post('/api/v1/onboarding/reopen-store').set(as(merchantToken)).send({ storeName: 'Third', storeSlug: `del3-${unique}` }).expect(404);
  });

  it('restores a soft-deleted store, on a new address when the old one was taken', async () => {
    await http().post(`/api/v1/admin/stores/${storeId}/restore`).set(as(adminToken)).send({}).expect(409);
    const restored = await http()
      .post(`/api/v1/admin/stores/${storeId}/restore`)
      .set(as(adminToken))
      .send({ slug: `old-${unique}` })
      .expect(200);
    expect(restored.body.data).toMatchObject({ slug: `old-${unique}`, status: 'ACTIVE', deletedAt: null, deletedSlug: null });
    const membership = await prisma.storeUser.findFirstOrThrow({ where: { storeId, userId: merchantId } });
    expect(membership.status).toBe(MembershipStatus.ACTIVE);
  });

  it('permanently deletes a store and everything in it, but keeps the business and its plan', async () => {
    await http()
      .post(`/api/v1/admin/stores/${storeId}/permanent-delete`)
      .set(as(adminToken))
      .send({ confirmSlug: 'wrong' })
      .expect(400);
    const res = await http()
      .post(`/api/v1/admin/stores/${storeId}/permanent-delete`)
      .set(as(adminToken))
      .send({ confirmSlug: `OLD-${unique}` })
      .expect(200);
    expect(res.body.data).toMatchObject({ deleted: true, removed: { products: 1, customers: 1 } });

    expect(await prisma.store.findUnique({ where: { id: storeId } })).toBeNull();
    expect(await prisma.product.count({ where: { storeId } })).toBe(0);
    expect(await prisma.category.count({ where: { storeId } })).toBe(0);
    expect(await prisma.tenant.findUnique({ where: { id: tenantIds[0] } })).not.toBeNull();
    expect(await prisma.subscription.count({ where: { tenantId: tenantIds[0] } })).toBe(1);
    const audit = await prisma.auditLog.findFirst({ where: { action: 'STORE_PERMANENTLY_DELETED', entityId: storeId } });
    expect(audit?.metadata).toMatchObject({ slug: `old-${unique}` });
    // The other store of the business is untouched.
    expect(await prisma.store.count({ where: { tenantId: tenantIds[0], status: StoreStatus.ACTIVE } })).toBe(1);
  });
});
