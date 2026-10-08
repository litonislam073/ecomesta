import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PlatformRole, StoreRole, MembershipStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, uniqueTransactionId, withPayment } from './support/onboarding';

/**
 * Premium theme (ShopEase): included in Business; Starter and Growth buy it
 * for ৳999 by mobile wallet and can use it once a Super Admin approves.
 */
describe('Premium themes (e2e)', () => {
  jest.setTimeout(180_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  type Shop = { key: string; plan: string; token: string; userId: string; storeId: string; tenantId: string; slug: string };
  const shop = (key: string, plan: string): Shop => ({ key, plan, token: '', userId: '', storeId: '', tenantId: '', slug: `prem-${key}-${suffix}` });
  const business = shop('biz', 'business');
  const growth = shop('gro', 'growth');
  const starter = shop('sta', 'starter');
  const admin = { token: '', email: '' };
  let shopeaseId = '';

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const themes = async (s: Shop) =>
    (await http().get(`/api/v1/stores/${s.storeId}/themes`).set(auth(s.token)).expect(200)).body.data.items as {
      id: string;
      slug: string;
      premium: boolean;
      priceBdt: string | null;
      access: string;
      purchase: { status: string; rejectionReason: string | null } | null;
    }[];
  const shopease = async (s: Shop) => (await themes(s)).find((t) => t.slug === 'shopease')!;
  const select = (s: Shop, themeId = shopeaseId) => http().patch(`/api/v1/stores/${s.storeId}/theme`).set(auth(s.token)).send({ themeId });
  const publish = (s: Shop) => http().post(`/api/v1/stores/${s.storeId}/theme/publish`).set(auth(s.token)).send({});
  const publicTheme = async (s: Shop) => {
    await redis.getClient().del(`storefront:theme:published:${s.storeId}`);
    return (await http().get(`/api/v1/public/stores/${s.slug}/theme`).expect(200)).body.data.theme?.slug as string | undefined;
  };
  const buy = (s: Shop, transactionId = uniqueTransactionId(), token = s.token) =>
    http()
      .post(`/api/v1/stores/${s.storeId}/themes/${shopeaseId}/purchase`)
      .set(auth(token))
      .send({ method: 'BKASH', senderNumber: '01712345678', transactionId });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 60 }) })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }
    for (const s of [business, growth, starter]) {
      const reg = await http()
        .post('/api/v1/auth/register')
        .send({ email: `prem.${s.key}.${suffix}@example.com`, password: 'SecurePass1', firstName: 'P', lastName: s.key })
        .expect(201);
      s.token = reg.body.data.accessToken;
      s.userId = reg.body.data.user.id;
      const store = (
        await http()
          .post('/api/v1/onboarding/store')
          .set(auth(s.token))
          .send(withPayment({ planSlug: s.plan, businessName: `Prem ${s.key}`, tenantSlug: `${s.slug}-t`, storeName: `Prem ${s.key}`, storeSlug: s.slug }))
          .expect(201)
          .then(activateOnboarded(app))
      ).body.data.store;
      s.storeId = store.id;
      s.tenantId = (await prisma.store.findUniqueOrThrow({ where: { id: s.storeId } })).tenantId;
    }
    const sa = await http()
      .post('/api/v1/auth/register')
      .send({ email: `prem.admin.${suffix}@example.com`, password: 'SecurePass1', firstName: 'S', lastName: 'A' })
      .expect(201);
    admin.token = sa.body.data.accessToken;
    admin.email = sa.body.data.user.email;
    await prisma.user.update({ where: { id: sa.body.data.user.id }, data: { platformRole: PlatformRole.SUPER_ADMIN } });
    shopeaseId = (await shopease(business)).id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lists ShopEase as a ৳999 premium theme: included for Business, locked for Growth and Starter', async () => {
    expect(await shopease(business)).toMatchObject({ premium: true, priceBdt: '999.00', access: 'included' });
    expect(await shopease(growth)).toMatchObject({ premium: true, access: 'locked' });
    expect(await shopease(starter)).toMatchObject({ premium: true, access: 'locked' });
    // Free themes keep their rules.
    expect((await themes(starter)).find((t) => t.slug === 'default')).toMatchObject({ premium: false, access: 'free', priceBdt: null });
    expect((await themes(growth)).find((t) => t.slug === 'minimal')).toMatchObject({ access: 'included' });
    expect((await themes(starter)).find((t) => t.slug === 'minimal')).toMatchObject({ access: 'locked' });
  });

  it('Business uses it straight away; the storefront serves it', async () => {
    await select(business).expect(200);
    await publish(business).expect((r) => expect([200, 201]).toContain(r.status));
    expect(await publicTheme(business)).toBe('shopease');
  });

  it('Growth (all free themes) still has to buy it', async () => {
    const refused = await select(growth).expect(403);
    expect(refused.body.error.code).toBe('THEME_PURCHASE_REQUIRED');
    expect(refused.body.error.message).toMatch(/Buy it for ৳999 or upgrade to the Business plan/);
  });

  it('Starter buys it: pending until approved, a rejection explains why, approval unlocks it', async () => {
    await select(starter).expect(403);
    const first = await buy(starter).expect(201);
    expect(first.body.data).toMatchObject({ status: 'PENDING', amount: '999.00', theme: { slug: 'shopease' } });
    expect(await shopease(starter)).toMatchObject({ access: 'pending', purchase: { status: 'PENDING' } });
    expect((await select(starter).expect(403)).body.error.message).toMatch(/waiting for review/);
    // One payment at a time per theme.
    expect((await buy(starter).expect(409)).body.error.message).toMatch(/already waiting for review/);

    // Merchants cannot review payments.
    await http().post(`/api/v1/admin/theme-purchases/${first.body.data.id}/approve`).set(auth(starter.token)).expect(403);
    const pendingList = (await http().get('/api/v1/admin/theme-purchases?status=PENDING&limit=100').set(auth(admin.token)).expect(200)).body.data;
    expect(pendingList.pendingCount).toBeGreaterThanOrEqual(1);
    const pending = pendingList.items;
    expect(pending.find((p: { id: string }) => p.id === first.body.data.id)).toMatchObject({ tenant: { id: starter.tenantId }, payToNumber: expect.any(String) });

    await http().post(`/api/v1/admin/theme-purchases/${first.body.data.id}/reject`).set(auth(admin.token)).send({ reason: 'No payment with this ID reached us.' }).expect(200);
    expect(await shopease(starter)).toMatchObject({ access: 'locked', purchase: { status: 'REJECTED', rejectionReason: 'No payment with this ID reached us.' } });
    const rejected = (await http().get('/api/v1/admin/theme-purchases?status=REJECTED&limit=100').set(auth(admin.token)).expect(200)).body.data.items;
    expect(rejected.find((p: { id: string }) => p.id === first.body.data.id)).toMatchObject({ reviewedBy: { email: admin.email }, reviewedAt: expect.any(String) });

    const second = await buy(starter).expect(201);
    await http().post(`/api/v1/admin/theme-purchases/${second.body.data.id}/approve`).set(auth(admin.token)).expect(200);
    // Approving twice is harmless; a rejected payment cannot be approved.
    await http().post(`/api/v1/admin/theme-purchases/${second.body.data.id}/approve`).set(auth(admin.token)).expect(200);
    await http().post(`/api/v1/admin/theme-purchases/${first.body.data.id}/approve`).set(auth(admin.token)).expect(409);

    expect(await shopease(starter)).toMatchObject({ access: 'owned' });
    await select(starter).expect(200);
    await publish(starter).expect((r) => expect([200, 201]).toContain(r.status));
    expect(await publicTheme(starter)).toBe('shopease');
    expect((await buy(starter).expect(409)).body.error.message).toMatch(/already own/);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: second.body.data.id, action: 'THEME_PURCHASE_APPROVED' } });
    expect(audit).not.toBeNull();
  });

  it('the theme editor previews an unsaved draft on the real storefront, only with its token', async () => {
    const session = (body: Record<string, unknown>, s: Shop = growth) =>
      http().put(`/api/v1/stores/${s.storeId}/theme/preview-session`).set(auth(s.token)).send(body);
    const read = (slug: string, token?: string) =>
      http().get(`/api/v1/public/stores/${slug}/theme${token ? `?preview=${token}` : ''}`).expect(200);

    // Growth has not bought ShopEase but may try it in the editor.
    const first = await session({ themeId: shopeaseId, configuration: { hero: { headline: 'Try, Before You Buy' } } }).expect(200);
    const token = first.body.data.token as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const shown = await read(growth.slug, token);
    expect(shown.headers['cache-control']).toBe('no-store');
    expect(shown.body.data).toMatchObject({ preview: true, theme: { slug: 'shopease' }, configuration: { hero: { headline: 'Try, Before You Buy' } } });

    // Updating keeps the token; the next read shows the new draft.
    const again = await session({ themeId: shopeaseId, token, configuration: { hero: { headline: 'Second, Draft' } } }).expect(200);
    expect(again.body.data.token).toBe(token);
    expect((await read(growth.slug, token)).body.data.configuration.hero.headline).toBe('Second, Draft');

    // Without the token, for another store, or with a junk token: the published theme.
    expect((await read(growth.slug)).body.data.preview).toBeUndefined();
    expect((await read(growth.slug)).body.data.theme?.slug).not.toBe('shopease');
    expect((await read(business.slug, token)).body.data.preview).toBeUndefined();
    expect((await read(growth.slug, 'x'.repeat(32))).body.data.preview).toBeUndefined();

    // Another store's editor cannot take over the token.
    const other = await session({ token, configuration: {} }, business).expect(200);
    expect(other.body.data.token).not.toBe(token);
    expect((await read(growth.slug, token)).body.data.configuration.hero.headline).toBe('Second, Draft');

    // Without a configuration the theme previews as it ships: try before you buy.
    const tryIt = await session({ themeId: shopeaseId }).expect(200);
    const tried = (await read(growth.slug, tryIt.body.data.token)).body.data;
    expect(tried).toMatchObject({ preview: true, theme: { slug: 'shopease' }, configuration: { hero: { headline: 'Shop More, Save More!' } } });
    expect(await shopease(growth)).toMatchObject({ access: 'locked' });

    // Markup is refused like on save; unknown themes are not found; non-members are refused.
    await session({ configuration: { hero: { headline: '<script>x</script>' } } }).expect(400);
    await session({ themeId: '00000000-0000-4000-8000-000000000000' }).expect(404);
    await session({}, { ...growth, token: business.token }).expect(403);
  });

  it('a wallet transaction pays for one thing only', async () => {
    const plan = await prisma.billingPayment.findFirstOrThrow({ where: { tenantId: growth.tenantId } });
    expect((await buy(growth, plan.transactionId).expect(409)).body.error.message).toMatch(/already been submitted/);
  });

  it('only the business owner or an admin can pay', async () => {
    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email: `prem.staff.${suffix}@example.com`, password: 'SecurePass1', firstName: 'S', lastName: 'T' })
      .expect(201);
    await prisma.storeUser.create({
      data: { storeId: growth.storeId, userId: reg.body.data.user.id, role: StoreRole.STORE_MANAGER, status: MembershipStatus.ACTIVE },
    });
    await buy(growth, uniqueTransactionId(), reg.body.data.accessToken).expect(403);
  });

  it('a Business store falls back to the default theme when its plan no longer includes ShopEase', async () => {
    const growthPlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { slug: 'growth' } });
    const sub = await prisma.subscription.findFirstOrThrow({ where: { tenantId: business.tenantId } });
    await prisma.subscription.update({ where: { id: sub.id }, data: { planId: growthPlan.id } });
    try {
      expect(await publicTheme(business)).toBe('default');
      expect((await publish(business).expect(403)).body.error.code).toBe('THEME_PURCHASE_REQUIRED');
    } finally {
      const businessPlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { slug: 'business' } });
      await prisma.subscription.update({ where: { id: sub.id }, data: { planId: businessPlan.id } });
    }
    expect(await publicTheme(business)).toBe('shopease');
  });
});
