import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { publishedThemeCacheKey } from '../src/modules/themes/theme-cache';

/** TE-02: optional URL fields can be removed and the removal can be published. */
describe('TE-02 clearing optional theme URLs (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const stores: Record<'a' | 'b', { token: string; id: string; slug: string }> = {
    a: { token: '', id: '', slug: `te02-a-${suffix}` },
    b: { token: '', id: '', slug: `te02-b-${suffix}` },
  };
  const A = stores.a;
  const B = stores.b;

  type Config = Record<string, Record<string, unknown> | undefined>;
  const FIELDS: Array<[string, string, string, string]> = [
    ['branding', 'logoUrl', 'https://cdn.example.com/logo-1.png', 'https://cdn.example.com/logo-2.png'],
    ['branding', 'faviconUrl', 'https://cdn.example.com/fav-1.ico', '/fav-2.ico'],
    ['announcement', 'href', '/sale-1', 'https://example.com/sale-2'],
    ['hero', 'ctaHref', '/cta-1', 'http://example.com/cta-2'],
    ['hero', 'imageUrl', 'https://cdn.example.com/hero-1.jpg', '/hero-2.jpg'],
    ['seo', 'ogImageUrl', 'https://cdn.example.com/og-1.png', 'https://cdn.example.com/og-2.png'],
  ];

  const http = () => request(app.getHttpServer());
  const auth = (s = A) => ({ Authorization: `Bearer ${s.token}` });
  const patch = (configuration: Config, s = A) =>
    http().patch(`/api/v1/stores/${s.id}/theme`).set(auth(s)).send({ configuration });
  const draft = async (s = A): Promise<Config> =>
    (await http().get(`/api/v1/stores/${s.id}/theme`).set(auth(s)).expect(200)).body.data.configuration;
  const publish = (s = A) => http().post(`/api/v1/stores/${s.id}/theme/publish`).set(auth(s)).expect(200);
  const publicConfig = async (s = A, fresh = true): Promise<Config> => {
    if (fresh) await redis.getClient().del(publishedThemeCacheKey(s.id));
    return (await http().get(`/api/v1/public/stores/${s.slug}/theme`).expect(200)).body.data.configuration;
  };
  const publicStore = async (s = A) =>
    (await http().get(`/api/v1/public/stores/${s.slug}`).expect(200)).body.data as {
      logoUrl: string | null;
      faviconUrl: string | null;
    };
  const liveRow = (s = A) =>
    prisma.storeTheme.findFirst({
      where: { storeId: s.id, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true, publishedConfiguration: true },
    });

  beforeAll(async () => {
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
    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }
    for (const [key, s] of Object.entries(stores)) {
      const reg = await http()
        .post('/api/v1/auth/register')
        .send({ email: `te02.${key}.${suffix}@example.com`, password: 'SecurePass1', firstName: 'T', lastName: 'E' })
        .expect(201);
      s.token = reg.body.data.accessToken;
      s.id = (
        await http()
          .post('/api/v1/onboarding/store')
          .set(auth(s))
          .send({ businessName: `TE02 ${key}`, tenantSlug: `${s.slug}-t`, storeName: `TE02 ${key}`, storeSlug: s.slug })
          .expect(201)
      ).body.data.store.id;
      await prisma.store.update({ where: { id: s.id }, data: { status: StoreStatus.ACTIVE } });
      await draft(s);
    }
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  it('never-set optional URLs: saving and publishing works and creates no URL', async () => {
    const d = await draft();
    for (const [section, field] of FIELDS) {
      if (section !== 'hero') expect(d[section]?.[field]).toBeUndefined();
    }
    await patch({ hero: { headline: 'Untouched URLs' } }).expect(200);
    await publish();
    const pub = await publicConfig();
    expect(pub.branding?.logoUrl).toBeUndefined();
    expect(pub.hero?.headline).toBe('Untouched URLs');
  });

  it.each(FIELDS)('%s.%s: set → clear → publish → re-add', async (section, field, first, second) => {
    // Set
    await patch({ [section]: { [field]: first } }).expect(200);
    expect((await draft())[section]?.[field]).toBe(first);
    await publish();
    expect((await publicConfig())[section]?.[field]).toBe(first);

    // Clear: draft loses it, live state untouched
    const liveBefore = await liveRow();
    const publicBefore = await publicConfig(A, false);
    await publicConfig(A, false); // make sure the cache is warm
    const cacheBefore = await redis.getClient().get(publishedThemeCacheKey(A.id));
    const cleared = await patch({ [section]: { [field]: '' } }).expect(200);
    expect(cleared.body.data.configuration[section]).not.toHaveProperty(field);
    expect(await draft()).not.toHaveProperty([section, field]);
    expect(await liveRow()).toEqual(liveBefore);
    expect(await redis.getClient().get(publishedThemeCacheKey(A.id))).toBe(cacheBefore);
    expect(await publicConfig()).toEqual(publicBefore);
    expect((await publicConfig())[section]?.[field]).toBe(first);

    // Publish the removal
    await publish();
    const live = await liveRow();
    expect(live?.publishedConfiguration).not.toHaveProperty([section, field]);
    const pubAfter = await publicConfig(A, false); // publish invalidated the cache
    expect(pubAfter[section]).not.toHaveProperty(field);
    expect(JSON.stringify(pubAfter)).not.toContain(first);

    // Re-add
    await patch({ [section]: { [field]: second } }).expect(200);
    expect((await draft())[section]?.[field]).toBe(second);
    await publish();
    expect((await publicConfig(A, false))[section]?.[field]).toBe(second);
  });

  it('whitespace-only clears; null is ignored; required URLs still reject empty', async () => {
    await patch({ branding: { logoUrl: '/keep.png' } }).expect(200);
    await patch({ branding: { logoUrl: null } }).expect(200);
    expect((await draft()).branding?.logoUrl).toBe('/keep.png');
    await patch({ branding: { logoUrl: '   ' } }).expect(200);
    expect(await draft()).not.toHaveProperty(['branding', 'logoUrl']);

    await patch({ header: { menuItems: [{ label: 'X', href: '' }] } }).expect(400);
    await patch({ footer: { menuItems: [{ label: 'X', href: '  ' }] } }).expect(400);
    await patch({ footer: { socialLinks: [{ network: 'x', url: '' }] } }).expect(400);
  });

  it('partial clears keep every other URL and sibling value', async () => {
    const all = {
      branding: { brandName: 'Partial', logoUrl: '/l.png', faviconUrl: '/f.ico' },
      hero: { headline: 'Keep me', ctaHref: '/c', imageUrl: '/h.jpg' },
      announcement: { text: 'Keep', href: '/a' },
    };
    await patch(all).expect(200);

    await patch({ branding: { logoUrl: '' } }).expect(200);
    let d = await draft();
    expect(d.branding).not.toHaveProperty('logoUrl');
    expect(d.branding).toMatchObject({ brandName: 'Partial', faviconUrl: '/f.ico' });
    expect(d.hero).toMatchObject(all.hero);
    expect(d.announcement).toMatchObject(all.announcement);

    await patch({ hero: { ctaHref: '' } }).expect(200);
    d = await draft();
    expect(d.hero).not.toHaveProperty('ctaHref');
    expect(d.hero).toMatchObject({ headline: 'Keep me', imageUrl: '/h.jpg' });
    expect(d.branding).toMatchObject({ brandName: 'Partial', faviconUrl: '/f.ico' });
    expect(d.announcement).toMatchObject(all.announcement);
  });

  it('unsafe values are rejected and do not overwrite the saved URL', async () => {
    for (const [section, field] of FIELDS) {
      await patch({ [section]: { [field]: '/safe' } }).expect(200);
      for (const bad of ['javascript:alert(1)', 'data:text/plain,x', 'ftp://e.com/x', '//evil.com/x', 'not a url', '<script>x</script>', `https://e.com/${'a'.repeat(2100)}`]) {
        await patch({ [section]: { [field]: bad } }).expect(400);
      }
      expect((await draft())[section]?.[field]).toBe('/safe');
    }
  });

  it('a published logo/favicon removal also stops the store-level fallback', async () => {
    await patch({ branding: { logoUrl: 'https://cdn.example.com/brand.png', faviconUrl: 'https://cdn.example.com/brand.ico' } }).expect(200);
    await publish();
    expect(await publicStore()).toMatchObject({
      logoUrl: 'https://cdn.example.com/brand.png',
      faviconUrl: 'https://cdn.example.com/brand.ico',
    });

    await patch({ branding: { logoUrl: '' } }).expect(200);
    // Draft only: the store record still carries the live logo.
    expect((await publicStore()).logoUrl).toBe('https://cdn.example.com/brand.png');
    await publish();
    expect(await publicStore()).toMatchObject({ logoUrl: null, faviconUrl: 'https://cdn.example.com/brand.ico' });

    await patch({ branding: { faviconUrl: '' } }).expect(200);
    await publish();
    expect((await publicStore()).faviconUrl).toBeNull();
  });

  it('keeps a store-level logo that was not copied from this theme', async () => {
    await prisma.store.update({ where: { id: B.id }, data: { logoUrl: 'https://cdn.example.com/external.png' } });
    await patch({ branding: { logoUrl: '/theme-b.png' } }, B).expect(200);
    await publish(B);
    await prisma.store.update({ where: { id: B.id }, data: { logoUrl: 'https://cdn.example.com/external-2.png' } });
    await patch({ branding: { logoUrl: '' } }, B).expect(200);
    await publish(B);
    // The store value no longer matches what the theme copied, so it is left alone.
    expect((await publicStore(B)).logoUrl).toBe('https://cdn.example.com/external-2.png');
  });

  it("publishing a removal invalidates only that store's cache", async () => {
    await publicConfig(A, false);
    await publicConfig(B, false);
    const cacheB = await redis.getClient().get(publishedThemeCacheKey(B.id));
    await patch({ hero: { imageUrl: '/iso.jpg' } }).expect(200);
    await publish();
    await publicConfig(A, false);
    await patch({ hero: { imageUrl: '' } }).expect(200);
    await publish();
    expect(await redis.getClient().exists(publishedThemeCacheKey(A.id))).toBe(0);
    expect(await redis.getClient().get(publishedThemeCacheKey(B.id))).toBe(cacheB);
    expect((await publicConfig(A, false)).hero).not.toHaveProperty('imageUrl');
  });
});
