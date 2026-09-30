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
import { publishedThemeCacheKey } from '../src/modules/themes/theme-cache';
import { ThemesService } from '../src/modules/themes/themes.service';

/**
 * ST-002: selecting, saving and previewing a theme are draft-only; publishing
 * is the only operation that changes the public storefront theme.
 */
describe('ST-002 theme draft/publish separation (e2e)', () => {
  jest.setTimeout(90_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const manager = { email: `st002.${suffix}@example.com`, token: '', id: '' };
  const staff = { email: `st002.staff.${suffix}@example.com`, token: '', id: '' };
  const other = { email: `st002.other.${suffix}@example.com`, token: '', id: '' };
  const password = 'SecurePass1';

  const storeSlug = `st002-a-${suffix}`;
  const otherSlug = `st002-b-${suffix}`;
  let storeId = '';
  let otherStoreId = '';
  let defaultThemeId = '';
  let minimalThemeId = '';

  const auth = (user: { token: string }) => ({ Authorization: `Bearer ${user.token}` });
  const themeUrl = (id = storeId) => `/api/v1/stores/${id}/theme`;
  const publicTheme = async (slug = storeSlug) =>
    (await request(app.getHttpServer()).get(`/api/v1/public/stores/${slug}/theme`).expect(200))
      .body.data as {
      theme: { slug: string } | null;
      publishedAt: string | null;
      configuration: { branding?: { primaryColor?: string }; hero?: { headline?: string } };
    };
  const cacheExists = async (id = storeId) =>
    (await redis.getClient().exists(publishedThemeCacheKey(id))) === 1;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
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
        .send({ email: user.email, password, firstName: 'St', lastName: 'Two' })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboard = async (user: { token: string }, tenant: string, slug: string) =>
      (
        await request(app.getHttpServer())
          .post('/api/v1/onboarding/store')
          .set(auth(user))
          .send({ businessName: tenant, tenantSlug: `${slug}-t`, storeName: tenant, storeSlug: slug })
          .expect(201)
      ).body.data.store.id as string;
    storeId = await onboard(manager, 'ST002 A', storeSlug);
    otherStoreId = await onboard(other, 'ST002 B', otherSlug);
    await prisma.store.updateMany({
      where: { id: { in: [storeId, otherStoreId] } },
      data: { status: StoreStatus.ACTIVE },
    });

    await prisma.storeUser.create({
      data: { storeId, userId: staff.id, role: StoreRole.STORE_STAFF, status: MembershipStatus.ACTIVE },
    });
    staff.token = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: staff.email, password })
        .expect(200)
    ).body.data.accessToken;

    const list = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/themes`)
      .set(auth(manager))
      .expect(200);
    const items: Array<{ id: string; slug: string }> = list.body.data.items;
    defaultThemeId = items.find((item) => item.slug === 'default')!.id;
    minimalThemeId = items.find((item) => item.slug === 'minimal')!.id;
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  it('uses the default fallback, never an unpublished selection, before the first publish', async () => {
    await request(app.getHttpServer())
      .patch(themeUrl())
      .set(auth(manager))
      .send({ themeId: minimalThemeId })
      .expect(200);

    const pub = await publicTheme();
    expect(pub.theme?.slug).toBe('default');
    expect(pub.publishedAt).toBeNull();
    expect(pub.configuration).toEqual({});

    const merchant = await request(app.getHttpServer()).get(themeUrl()).set(auth(manager)).expect(200);
    expect(merchant.body.data.theme.slug).toBe('minimal');
    expect(merchant.body.data.isLive).toBe(false);
    expect(merchant.body.data.liveTheme).toBeNull();
    expect(merchant.body.data.hasUnpublishedChanges).toBe(true);
  });

  it('makes Theme A live on publish', async () => {
    await request(app.getHttpServer())
      .patch(themeUrl())
      .set(auth(manager))
      .send({ themeId: defaultThemeId, configuration: { branding: { primaryColor: '#aa0000' } } })
      .expect(200);

    const published = await request(app.getHttpServer())
      .post(`${themeUrl()}/publish`)
      .set(auth(manager))
      .expect(200);
    expect(published.body.data.isLive).toBe(true);
    expect(published.body.data.liveTheme.slug).toBe('default');
    expect(published.body.data.hasUnpublishedChanges).toBe(false);

    const pub = await publicTheme();
    expect(pub.theme?.slug).toBe('default');
    expect(pub.configuration.branding?.primaryColor).toBe('#aa0000');
    expect(await cacheExists()).toBe(true);
  });

  it('selecting Theme B does not change the storefront or its cache', async () => {
    const before = await publicTheme();

    const res = await request(app.getHttpServer())
      .patch(themeUrl())
      .set(auth(manager))
      .send({ themeId: minimalThemeId })
      .expect(200);
    expect(res.body.data.theme.slug).toBe('minimal');
    expect(res.body.data.isLive).toBe(false);
    expect(res.body.data.liveTheme.slug).toBe('default');
    expect(res.body.data.hasUnpublishedChanges).toBe(true);

    // Selection leaves the cached published payload in place.
    expect(await cacheExists()).toBe(true);
    await redis.getClient().del(publishedThemeCacheKey(storeId));
    expect(await publicTheme()).toEqual(before);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/themes`)
      .set(auth(manager))
      .expect(200);
    const flags = Object.fromEntries(
      (list.body.data.items as Array<{ slug: string; selected: boolean; live: boolean }>).map(
        (item) => [item.slug, { selected: item.selected, live: item.live }],
      ),
    );
    expect(flags.default).toEqual({ selected: false, live: true });
    expect(flags.minimal).toEqual({ selected: true, live: false });
  });

  it('saving a Theme B draft does not change the storefront or its cache', async () => {
    await publicTheme();
    await request(app.getHttpServer())
      .patch(themeUrl())
      .set(auth(manager))
      .send({ configuration: { hero: { headline: 'Theme B draft headline' } } })
      .expect(200);
    expect(await cacheExists()).toBe(true);

    await redis.getClient().del(publishedThemeCacheKey(storeId));
    const pub = await publicTheme();
    expect(pub.theme?.slug).toBe('default');
    expect(pub.configuration.branding?.primaryColor).toBe('#aa0000');
    expect(JSON.stringify(pub)).not.toContain('Theme B draft headline');
  });

  it('preview shows Theme B draft without touching the storefront', async () => {
    const preview = await request(app.getHttpServer())
      .post(`${themeUrl()}/preview`)
      .set(auth(manager))
      .expect(200);
    expect(preview.body.data.theme.slug).toBe('minimal');
    expect(preview.body.data.configuration.hero.headline).toBe('Theme B draft headline');

    await redis.getClient().del(publishedThemeCacheKey(storeId));
    expect((await publicTheme()).theme?.slug).toBe('default');
  });

  it('switching back to Theme A and again to B never affects visitors', async () => {
    for (const themeId of [defaultThemeId, minimalThemeId]) {
      await request(app.getHttpServer()).patch(themeUrl()).set(auth(manager)).send({ themeId }).expect(200);
      await redis.getClient().del(publishedThemeCacheKey(storeId));
      const pub = await publicTheme();
      expect(pub.theme?.slug).toBe('default');
      expect(pub.configuration.branding?.primaryColor).toBe('#aa0000');
    }

    // Theme B kept its draft across the round trip.
    const merchant = await request(app.getHttpServer()).get(themeUrl()).set(auth(manager)).expect(200);
    expect(merchant.body.data.configuration.hero.headline).toBe('Theme B draft headline');
  });

  it('rejects draft and publish writes from staff and other stores', async () => {
    for (const user of [staff, other]) {
      await request(app.getHttpServer())
        .patch(themeUrl())
        .set(auth(user))
        .send({ themeId: defaultThemeId })
        .expect(403);
      await request(app.getHttpServer()).post(`${themeUrl()}/publish`).set(auth(user)).expect(403);
    }
    await request(app.getHttpServer()).post(`${themeUrl()}/publish`).expect(401);
    await request(app.getHttpServer()).post(`${themeUrl()}/preview`).set(auth(other)).expect(403);

    await redis.getClient().del(publishedThemeCacheKey(storeId));
    expect((await publicTheme()).theme?.slug).toBe('default');
  });

  it('publishing Theme B makes it live and refreshes the public cache', async () => {
    const liveBefore = await prisma.storeTheme.findFirst({
      where: { storeId, themeId: defaultThemeId },
    });
    await publicTheme(); // warm the cache with Theme A

    const published = await request(app.getHttpServer())
      .post(`${themeUrl()}/publish`)
      .set(auth(manager))
      .expect(200);
    expect(published.body.data.theme.slug).toBe('minimal');
    expect(published.body.data.isLive).toBe(true);
    expect(published.body.data.liveTheme.slug).toBe('minimal');
    expect(new Date(published.body.data.publishedAt).getTime()).toBeGreaterThan(
      liveBefore!.publishedAt!.getTime(),
    );

    // No manual cache flush: publish invalidated the store's key.
    const pub = await publicTheme();
    expect(pub.theme?.slug).toBe('minimal');
    expect(pub.configuration.hero?.headline).toBe('Theme B draft headline');
    expect(pub.publishedAt).toBe(published.body.data.publishedAt);

    // Theme A's snapshot is kept, just no longer live.
    const themeA = await prisma.storeTheme.findFirst({ where: { storeId, themeId: defaultThemeId } });
    expect(themeA?.publishedAt?.getTime()).toBe(liveBefore!.publishedAt!.getTime());
  });

  it('a failed publish leaves the previous live theme and snapshot intact', async () => {
    await request(app.getHttpServer())
      .patch(themeUrl())
      .set(auth(manager))
      .send({ themeId: defaultThemeId, configuration: { branding: { primaryColor: '#00aa00' } } })
      .expect(200);
    const themeARowBefore = await prisma.storeTheme.findFirst({
      where: { storeId, themeId: defaultThemeId },
    });
    await publicTheme();

    const themes = app.get(ThemesService);
    const failure = jest
      .spyOn(themes, 'syncPublishedBranding')
      .mockRejectedValueOnce(new Error('simulated failure inside the publish transaction'));
    try {
      await request(app.getHttpServer()).post(`${themeUrl()}/publish`).set(auth(manager)).expect(500);
    } finally {
      failure.mockRestore();
    }

    // The theme row update inside the transaction was rolled back.
    const themeARowAfter = await prisma.storeTheme.findFirst({
      where: { storeId, themeId: defaultThemeId },
    });
    expect(themeARowAfter?.publishedAt?.getTime()).toBe(themeARowBefore?.publishedAt?.getTime());
    expect(themeARowAfter?.publishedConfiguration).toEqual(themeARowBefore?.publishedConfiguration);

    await redis.getClient().del(publishedThemeCacheKey(storeId));
    const pub = await publicTheme();
    expect(pub.theme?.slug).toBe('minimal');
    expect(pub.configuration.hero?.headline).toBe('Theme B draft headline');

    const merchant = await request(app.getHttpServer()).get(themeUrl()).set(auth(manager)).expect(200);
    expect(merchant.body.data.isLive).toBe(false);
    expect(merchant.body.data.liveTheme.slug).toBe('minimal');
  });

  it('keeps stores isolated: publishing in store A never changes store B', async () => {
    await request(app.getHttpServer())
      .patch(themeUrl(otherStoreId))
      .set(auth(other))
      .send({ configuration: { branding: { primaryColor: '#0000bb' } } })
      .expect(200);
    await request(app.getHttpServer()).post(`${themeUrl(otherStoreId)}/publish`).set(auth(other)).expect(200);

    const b = await publicTheme(otherSlug);
    expect(b.theme?.slug).toBe('default');
    expect(b.configuration.branding?.primaryColor).toBe('#0000bb');

    await request(app.getHttpServer()).post(`${themeUrl()}/publish`).set(auth(manager)).expect(200);
    const a = await publicTheme();
    expect(a.theme?.slug).toBe('default');
    expect(a.configuration.branding?.primaryColor).toBe('#00aa00');

    // Store B's cache and payload are untouched by store A's publish.
    expect(await cacheExists(otherStoreId)).toBe(true);
    expect(await publicTheme(otherSlug)).toEqual(b);
    expect(JSON.stringify(b)).not.toContain('#00aa00');
  });

  it('reset only changes the draft', async () => {
    await publicTheme();
    const res = await request(app.getHttpServer()).post(`${themeUrl()}/reset`).set(auth(manager)).expect(200);
    expect(res.body.data.configuration.branding.primaryColor).toBe('#2563eb');
    expect(res.body.data.isLive).toBe(true);
    expect(res.body.data.hasUnpublishedChanges).toBe(true);
    expect(await cacheExists()).toBe(true);

    await redis.getClient().del(publishedThemeCacheKey(storeId));
    expect((await publicTheme()).configuration.branding?.primaryColor).toBe('#00aa00');
  });
});
