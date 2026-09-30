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
import {
  mergeThemeConfiguration,
  normalizeThemeConfiguration,
  themeConfigurationsEqual,
} from '../src/modules/themes/theme-config.normalizer';

describe('Phase 16 storefront theming (e2e)', () => {
  jest.setTimeout(90_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const manager = {
    email: `phase16.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staff = {
    email: `phase16.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const otherManager = {
    email: `phase16.other.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeId = '';
  const storeSlug = `p16-store-${suffix}`;
  let otherStoreId = '';
  let defaultThemeId = '';
  let minimalThemeId = '';

  const authManager = () => ({ Authorization: `Bearer ${manager.token}` });
  const authStaff = () => ({ Authorization: `Bearer ${staff.token}` });
  const authOther = () => ({ Authorization: `Bearer ${otherManager.token}` });

  const themeUrl = (id = storeId) => `/api/v1/stores/${id}/theme`;
  const publicThemeUrl = (slug = storeSlug) =>
    `/api/v1/public/stores/${slug}/theme`;

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

    for (const pattern of ['auth:rl:*', 'rl:*', 'storefront:theme:*']) {
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
          lastName: 'Sixteen',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set(authManager())
      .send({
        businessName: 'P16 Tenant',
        tenantSlug: `p16-tenant-${suffix}`,
        storeName: 'P16 Store',
        storeSlug,
      })
      .expect(201);
    storeId = onboard.body.data.store.id;

    const otherOnboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set(authOther())
      .send({
        businessName: 'P16 Other Tenant',
        tenantSlug: `p16-tenant-b-${suffix}`,
        storeName: 'P16 Other Store',
        storeSlug: `p16-other-${suffix}`,
      })
      .expect(201);
    otherStoreId = otherOnboard.body.data.store.id;

    for (const id of [storeId, otherStoreId]) {
      await prisma.store.update({
        where: { id },
        data: { status: StoreStatus.ACTIVE },
      });
    }

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
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  describe('normalizeThemeConfiguration', () => {
    it('strips unknown keys and trims known text fields', () => {
      const normalized = normalizeThemeConfiguration({
        branding: { brandName: '  Acme  ', trackingScript: '<script>' },
        unknownSection: { nested: true },
      });

      expect(normalized).toEqual({ branding: { brandName: 'Acme' } });
    });

    it('merges section-wise and compares order-insensitively', () => {
      const merged = mergeThemeConfiguration(
        { branding: { brandName: 'Acme', primaryColor: '#111111' } },
        { branding: { primaryColor: '#222222' } },
      );
      expect(merged.branding).toEqual({
        brandName: 'Acme',
        primaryColor: '#222222',
      });

      expect(
        themeConfigurationsEqual({ a: 1, b: 2 }, { b: 2, a: 1 }),
      ).toBe(true);
      expect(themeConfigurationsEqual({ a: 1 }, { a: 2 })).toBe(false);
    });
  });

  it('lists active themes and flags the selected one', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/themes`)
      .set(authManager())
      .expect(200);

    const items: Array<{ id: string; slug: string; selected: boolean }> =
      res.body.data.items;
    const slugs = items.map((item) => item.slug);
    expect(slugs).toEqual(expect.arrayContaining(['default', 'minimal']));

    defaultThemeId = items.find((item) => item.slug === 'default')!.id;
    minimalThemeId = items.find((item) => item.slug === 'minimal')!.id;
    expect(defaultThemeId).toBeTruthy();
    expect(minimalThemeId).toBeTruthy();
  });

  it('auto-creates the default store theme on first read', async () => {
    const res = await request(app.getHttpServer())
      .get(themeUrl())
      .set(authManager())
      .expect(200);

    expect(res.body.data.theme.slug).toBe('default');
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.configuration.branding.primaryColor).toBe('#2563eb');
    expect(res.body.data.publishedConfiguration).toBeNull();
    expect(res.body.data.publishedAt).toBeNull();
    expect(res.body.data.hasUnpublishedChanges).toBe(true);

    const rows = await prisma.storeTheme.findMany({ where: { storeId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.isActive).toBe(true);
  });

  it('rejects invalid colors, URLs, markup and oversized collections', async () => {
    const invalidPayloads: Array<Record<string, unknown>> = [
      { branding: { primaryColor: 'blue' } },
      { branding: { primaryColor: '#12345' } },
      { branding: { logoUrl: 'javascript:alert(1)' } },
      { branding: { logoUrl: 'ftp://cdn.example.com/logo.png' } },
      { hero: { headline: '<script>alert(1)</script>Hello' } },
      { announcement: { text: 'a'.repeat(281) } },
      { branding: { brandName: 'a'.repeat(121) } },
      { seo: { description: 'a'.repeat(1001) } },
      {
        header: {
          menuItems: Array.from({ length: 13 }, (_, index) => ({
            label: `Item ${index}`,
            href: '/products',
          })),
        },
      },
      { footer: { socialLinks: [{ network: 'myspace', url: '/x' }] } },
      // TE-01: menu and social URLs typed in the editor stay server-validated.
      ...['javascript:alert(1)', 'data:text/plain,x', 'ftp://example.com/x', 'not a url', '//evil.example.com', ''].flatMap(
        (href) => [
          { header: { menuItems: [{ label: 'Item', href }] } },
          { footer: { menuItems: [{ label: 'Item', href }] } },
          { footer: { socialLinks: [{ network: 'facebook', url: href }] } },
        ],
      ),
      { homepage: { featuredProducts: ['not-a-uuid'] } },
      { homepage: { sections: [{ type: 'unsupported_section' }] } },
      { typography: { baseFontSize: 99 } },
      { hero: { overlayOpacity: 4 } },
      { branding: 'not-an-object' },
    ];

    for (const configuration of invalidPayloads) {
      await request(app.getHttpServer())
        .patch(themeUrl())
        .set(authManager())
        .send({ configuration })
        .expect(400);
    }

    await request(app.getHttpServer())
      .patch(themeUrl())
      .set(authManager())
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .patch(themeUrl())
      .set(authManager())
      .send({ themeId: 'not-a-uuid' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(themeUrl())
      .set(authManager())
      .send({ themeId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);
  });

  it('deep-merges the draft and strips unknown keys', async () => {
    const res = await request(app.getHttpServer())
      .patch(themeUrl())
      .set(authManager())
      .send({
        configuration: {
          branding: {
            primaryColor: '#FF0000',
            brandName: 'Phase16 Store',
            trackingScript: 'ignored',
          },
          header: {
            menuItems: [{ label: 'Deals', href: 'https://example.com/deals' }],
          },
          unknownSection: { nope: true },
        },
      })
      .expect(200);

    const config = res.body.data.configuration;
    expect(config.branding.primaryColor).toBe('#ff0000');
    expect(config.branding.brandName).toBe('Phase16 Store');
    // Untouched defaults survive the partial patch.
    expect(config.branding.accentColor).toBe('#f59e0b');
    expect(config.branding.trackingScript).toBeUndefined();
    expect(config.unknownSection).toBeUndefined();
    expect(config.header.menuItems).toEqual([
      { label: 'Deals', href: 'https://example.com/deals' },
    ]);
    expect(res.body.data.hasUnpublishedChanges).toBe(true);
  });

  it('serves an empty public configuration before the first publish', async () => {
    const res = await request(app.getHttpServer())
      .get(publicThemeUrl())
      .expect(200);

    expect(res.body.data.theme.slug).toBe('default');
    expect(res.body.data.publishedAt).toBeNull();
    expect(res.body.data.configuration).toEqual({});
  });

  it('publishes the draft and exposes it publicly', async () => {
    const published = await request(app.getHttpServer())
      .post(`${themeUrl()}/publish`)
      .set(authManager())
      .expect(200);

    expect(published.body.data.publishedAt).toBeTruthy();
    expect(published.body.data.publishedConfiguration.branding.primaryColor).toBe(
      '#ff0000',
    );
    expect(published.body.data.hasUnpublishedChanges).toBe(false);

    // Publishing invalidates the cached public payload written above.
    const publicRes = await request(app.getHttpServer())
      .get(publicThemeUrl())
      .expect(200);
    expect(publicRes.body.data.configuration.branding.primaryColor).toBe(
      '#ff0000',
    );
    expect(publicRes.body.data.publishedAt).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({
      where: { storeId, action: 'THEME_PUBLISHED' },
    });
    expect(audit).not.toBeNull();
  });

  it('never leaks draft-only edits to the public endpoint', async () => {
    await request(app.getHttpServer())
      .patch(themeUrl())
      .set(authManager())
      .send({ configuration: { hero: { headline: 'Draft only headline' } } })
      .expect(200);

    const merchant = await request(app.getHttpServer())
      .get(themeUrl())
      .set(authManager())
      .expect(200);
    expect(merchant.body.data.configuration.hero.headline).toBe(
      'Draft only headline',
    );
    expect(merchant.body.data.hasUnpublishedChanges).toBe(true);

    const publicRes = await request(app.getHttpServer())
      .get(publicThemeUrl())
      .expect(200);
    expect(JSON.stringify(publicRes.body)).not.toContain('Draft only headline');
    expect(publicRes.body.data.configuration.hero.headline).toBe(
      'Shop the new arrivals',
    );
  });

  it('returns the draft configuration from the authenticated preview route', async () => {
    const res = await request(app.getHttpServer())
      .post(`${themeUrl()}/preview`)
      .set(authManager())
      .expect(200);
    expect(res.body.data.configuration.hero.headline).toBe(
      'Draft only headline',
    );

    const staffPreview = await request(app.getHttpServer())
      .post(`${themeUrl()}/preview`)
      .set(authStaff())
      .expect(200);
    expect(staffPreview.body.data.configuration.hero.headline).toBe(
      'Draft only headline',
    );

    await request(app.getHttpServer())
      .post(`${themeUrl()}/preview`)
      .expect(401);
  });

  it('allows staff to read but not to write theme settings', async () => {
    await request(app.getHttpServer())
      .get(themeUrl())
      .set(authStaff())
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/themes`)
      .set(authStaff())
      .expect(200);

    await request(app.getHttpServer())
      .patch(themeUrl())
      .set(authStaff())
      .send({ configuration: { branding: { primaryColor: '#00ff00' } } })
      .expect(403);
    await request(app.getHttpServer())
      .post(`${themeUrl()}/publish`)
      .set(authStaff())
      .expect(403);
    await request(app.getHttpServer())
      .post(`${themeUrl()}/reset`)
      .set(authStaff())
      .expect(403);
  });

  it('isolates themes across stores and rejects unknown stores', async () => {
    await request(app.getHttpServer())
      .get(themeUrl())
      .set(authOther())
      .expect(403);
    await request(app.getHttpServer())
      .patch(themeUrl())
      .set(authOther())
      .send({ configuration: { branding: { primaryColor: '#00ff00' } } })
      .expect(403);
    await request(app.getHttpServer())
      .get(themeUrl(otherStoreId))
      .set(authManager())
      .expect(403);

    await request(app.getHttpServer())
      .get(themeUrl('11111111-1111-4111-8111-111111111111'))
      .set(authManager())
      .expect(404);

    // The other store keeps its own untouched draft.
    const otherTheme = await request(app.getHttpServer())
      .get(themeUrl(otherStoreId))
      .set(authOther())
      .expect(200);
    expect(otherTheme.body.data.configuration.branding.primaryColor).toBe(
      '#2563eb',
    );
  });

  it('switches themes and keeps the draft of a previously used theme', async () => {
    const minimal = await request(app.getHttpServer())
      .patch(themeUrl())
      .set(authManager())
      .send({ themeId: minimalThemeId })
      .expect(200);
    expect(minimal.body.data.theme.slug).toBe('minimal');
    expect(minimal.body.data.configuration.branding.primaryColor).toBe(
      '#111111',
    );
    expect(minimal.body.data.configuration.hero.headline).toBe(
      'A quieter way to shop',
    );

    const activeRows = await prisma.storeTheme.findMany({
      where: { storeId, isActive: true },
    });
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]?.themeId).toBe(minimalThemeId);

    const selectedAudit = await prisma.auditLog.findFirst({
      where: { storeId, action: 'THEME_SELECTED' },
    });
    expect(selectedAudit).not.toBeNull();

    const back = await request(app.getHttpServer())
      .patch(themeUrl())
      .set(authManager())
      .send({ themeId: defaultThemeId })
      .expect(200);
    expect(back.body.data.theme.slug).toBe('default');
    expect(back.body.data.configuration.branding.primaryColor).toBe('#ff0000');
    expect(back.body.data.configuration.hero.headline).toBe(
      'Draft only headline',
    );
  });

  it('resets the draft to the theme defaults without touching published config', async () => {
    const res = await request(app.getHttpServer())
      .post(`${themeUrl()}/reset`)
      .set(authManager())
      .expect(200);

    expect(res.body.data.configuration.branding.primaryColor).toBe('#2563eb');
    expect(res.body.data.configuration.hero.headline).toBe(
      'Shop the new arrivals',
    );
    expect(res.body.data.publishedConfiguration.branding.primaryColor).toBe(
      '#ff0000',
    );

    const audit = await prisma.auditLog.findFirst({
      where: { storeId, action: 'THEME_RESET' },
    });
    expect(audit).not.toBeNull();
  });

  it('hides the public theme for stores that are not ACTIVE', async () => {
    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.INACTIVE },
    });
    await redis.getClient().del(`storefront:theme:published:${storeId}`);

    await request(app.getHttpServer()).get(publicThemeUrl()).expect(404);
    await request(app.getHttpServer())
      .get(publicThemeUrl(`missing-store-${suffix}`))
      .expect(404);

    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });
  });

  it('rejects theme writes and reads for a suspended store', async () => {
    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.SUSPENDED },
    });

    try {
      const write = await request(app.getHttpServer())
        .patch(themeUrl())
        .set(authManager())
        .send({ configuration: { branding: { primaryColor: '#00ff00' } } })
        .expect(403);
      expect(write.body.error.message).toMatch(/suspended/i);

      await request(app.getHttpServer())
        .post(`${themeUrl()}/publish`)
        .set(authManager())
        .expect(403);
      await request(app.getHttpServer())
        .get(themeUrl())
        .set(authManager())
        .expect(403);
      await request(app.getHttpServer()).get(publicThemeUrl()).expect(403);
    } finally {
      await prisma.store.update({
        where: { id: storeId },
        data: { status: StoreStatus.ACTIVE },
      });
    }
  });
});
