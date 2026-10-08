import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { MembershipStatus, StoreRole, StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { jpegImage, pngImage, webpImage } from './support/image-fixtures';
import { activateOnboarded, withPayment } from './support/onboarding';

/**
 * Media gallery: every upload (logo, favicon, background, product) is kept per
 * store, listed for reuse, and can only be deleted once nothing shows it.
 */
describe('Media gallery (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  type Store = { key: string; token: string; id: string; slug: string; productId: string };
  const A: Store = { key: 'a', token: '', id: '', slug: `gal-a-${suffix}`, productId: '' };
  const B: Store = { key: 'b', token: '', id: '', slug: `gal-b-${suffix}`, productId: '' };
  let staffToken = '';

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const upload = (s: Store, file: Buffer, purpose?: string, filename = 'image.png', token = s.token, storeId = s.id) =>
    http()
      .post(`/api/v1/stores/${storeId}/media${purpose ? `?purpose=${purpose}` : ''}`)
      .set(auth(token))
      .attach('file', file, { filename, contentType: 'application/octet-stream' });
  const list = (s: Store, query = '', token = s.token, storeId = s.id) =>
    http().get(`/api/v1/stores/${storeId}/media${query}`).set(auth(token));
  const remove = (s: Store, mediaId: string, token = s.token, storeId = s.id) =>
    http().delete(`/api/v1/stores/${storeId}/media/${mediaId}`).set(auth(token));
  const useForProduct = (s: Store, productId: string, mediaId: string, storeId = s.id) =>
    http().post(`/api/v1/stores/${storeId}/products/${productId}/image/from-gallery`).set(auth(s.token)).send({ mediaId });
  const patchTheme = (s: Store, configuration: Record<string, unknown>) =>
    http().patch(`/api/v1/stores/${s.id}/theme`).set(auth(s.token)).send({ configuration });

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

    for (const s of [A, B]) {
      const reg = await http()
        .post('/api/v1/auth/register')
        .send({ email: `gal.${s.key}.${suffix}@example.com`, password: 'SecurePass1', firstName: 'G', lastName: 'L' })
        .expect(201);
      s.token = reg.body.data.accessToken;
      s.id = (
        await http()
          .post('/api/v1/onboarding/store')
          .set(auth(s.token))
          .send(withPayment({ businessName: `Gallery ${s.key}`, tenantSlug: `${s.slug}-t`, storeName: `Gallery ${s.key}`, storeSlug: s.slug }))
          .expect(201).then(activateOnboarded(app))
      ).body.data.store.id;
      await prisma.store.update({ where: { id: s.id }, data: { status: StoreStatus.ACTIVE } });
      s.productId = (
        await http()
          .post(`/api/v1/stores/${s.id}/products`)
          .set(auth(s.token))
          .send({ name: `Gallery Item ${s.key}`, slug: `gal-item-${s.key}-${suffix}`, status: 'ACTIVE', productType: 'PHYSICAL', basePrice: '100.00', trackInventory: false })
          .expect(201)
      ).body.data.id;
    }

    const staff = await http()
      .post('/api/v1/auth/register')
      .send({ email: `gal.staff.${suffix}@example.com`, password: 'SecurePass1', firstName: 'S', lastName: 'T' })
      .expect(201);
    staffToken = staff.body.data.accessToken;
    await prisma.storeUser.create({
      data: { storeId: A.id, userId: staff.body.data.user.id, role: StoreRole.STORE_STAFF, status: MembershipStatus.ACTIVE },
    });
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  it('uploads to the gallery with pixel size and lists newest first without file bytes', async () => {
    const first = await upload(A, pngImage(800, 600, `g1-${suffix}`), 'general', 'Banner One.png').expect(201);
    expect(first.body.data).toMatchObject({
      filename: 'Banner One.png',
      mimeType: 'image/png',
      width: 800,
      height: 600,
      usedBy: [],
    });
    expect(first.body.data.url).toMatch(/\/api\/v1\/public\/media\/[0-9a-f-]{36}$/);
    const second = await upload(A, jpegImage(1920, 800, `g2-${suffix}`), 'background', 'hero.jpg').expect(201);
    expect(second.body.data).toMatchObject({ mimeType: 'image/jpeg', width: 1920, height: 800 });
    const third = await upload(A, webpImage(400, 400, `g3-${suffix}`), 'logo', 'logo.webp').expect(201);
    expect(third.body.data).toMatchObject({ mimeType: 'image/webp', width: 400, height: 400 });

    const listed = await list(A).expect(200);
    const ids = listed.body.data.items.map((i: { id: string }) => i.id);
    expect(ids.slice(0, 3)).toEqual([third.body.data.id, second.body.data.id, first.body.data.id]);
    expect(JSON.stringify(listed.body)).not.toMatch(/"data":\{"type":"Buffer"/);
    expect(listed.body.data.items[0]).not.toHaveProperty('data');
    expect(listed.body.data.meta).toMatchObject({ page: 1, limit: 48 });

    const paged = await list(A, '?limit=1&page=2').expect(200);
    expect(paged.body.data.items.map((i: { id: string }) => i.id)).toEqual([second.body.data.id]);

    await http().get(new URL(first.body.data.url).pathname).expect(200).expect('Content-Type', 'image/png');
  });

  it('enforces favicon rules: square, 16–1024 px', async () => {
    const wide = await upload(A, pngImage(64, 32, `f1-${suffix}`), 'favicon').expect(422);
    expect(wide.body.error.message).toMatch(/square.*64×32/);
    await upload(A, pngImage(8, 8, `f2-${suffix}`), 'favicon').expect(422);
    await upload(A, pngImage(2048, 2048, `f3-${suffix}`), 'favicon').expect(422);
    const ok = await upload(A, pngImage(512, 512, `f4-${suffix}`), 'favicon').expect(201);
    expect(ok.body.data).toMatchObject({ width: 512, height: 512 });
    // The same non-square image is fine as a general upload.
    await upload(A, pngImage(64, 32, `f5-${suffix}`), 'general').expect(201);
  });

  it('rejects bad files cleanly and stores nothing', async () => {
    const before = await prisma.media.count({ where: { storeId: A.id } });
    await upload(A, Buffer.from('not an image at all'), 'general', 'x.png').expect(415);
    await upload(A, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]), 'general').expect(422);
    await upload(A, pngImage(7000, 100, `big-${suffix}`), 'general').expect(422);
    const tooBig = Buffer.concat([pngImage(100, 100), Buffer.alloc(1_600_000)]);
    await upload(A, tooBig, 'general').expect(413);
    await upload(A, pngImage(10, 10, `p-${suffix}`), 'wallpaper').expect(400);
    await http().post(`/api/v1/stores/${A.id}/media`).set(auth(A.token)).attach('file', Buffer.alloc(0), 'empty.png').expect(400);
    expect(await prisma.media.count({ where: { storeId: A.id } })).toBe(before);
  });

  it('uses a gallery image for a product and protects it from deletion while in use', async () => {
    const img = (await upload(A, pngImage(600, 600, `prod-${suffix}`), 'product').expect(201)).body.data;
    const set = await useForProduct(A, A.productId, img.id).expect(200);
    expect(set.body.data.imageUrl).toBe(img.url);
    const storefront = await http().get(`/api/v1/public/stores/${A.slug}/products/gal-item-a-${suffix}`).expect(200);
    expect(storefront.body.data.images[0].url).toBe(img.url);

    const listed = (await list(A).expect(200)).body.data.items.find((i: { id: string }) => i.id === img.id);
    expect(listed.usedBy).toEqual([{ kind: 'product', id: A.productId, label: `Product “Gallery Item a”` }]);

    const blocked = await remove(A, img.id).expect(409);
    expect(blocked.body.error.message).toMatch(/still used by: Product “Gallery Item a”/);
    expect(await prisma.media.findUnique({ where: { id: img.id } })).not.toBeNull();

    // Replacing the product image frees the old one; it stays in the gallery until deleted.
    const next = (await upload(A, pngImage(600, 600, `prod2-${suffix}`), 'product').expect(201)).body.data;
    await useForProduct(A, A.productId, next.id).expect(200);
    await http().get(new URL(img.url).pathname).expect(200);
    await remove(A, img.id).expect(200);
    await http().get(new URL(img.url).pathname).expect(404);
    await remove(A, img.id).expect(404);
  });

  it('treats theme logo, favicon and banner (draft or published) and store branding as in use', async () => {
    const logo = (await upload(A, pngImage(512, 512, `logo-${suffix}`), 'logo').expect(201)).body.data;
    const favicon = (await upload(A, pngImage(64, 64, `fav-${suffix}`), 'favicon').expect(201)).body.data;
    const banner = (await upload(A, jpegImage(1920, 800, `hero-${suffix}`), 'background').expect(201)).body.data;
    await patchTheme(A, {
      branding: { logoUrl: logo.url, faviconUrl: favicon.url },
      hero: { imageUrl: banner.url },
    }).expect(200);

    const items = (await list(A).expect(200)).body.data.items as Array<{ id: string; usedBy: Array<{ label: string }> }>;
    const usedBy = (id: string) => items.find((i) => i.id === id)!.usedBy.map((u) => u.label);
    expect(usedBy(logo.id)[0]).toMatch(/theme logo \(draft\)/);
    expect(usedBy(favicon.id)[0]).toMatch(/theme favicon \(draft\)/);
    expect(usedBy(banner.id)[0]).toMatch(/theme banner background \(draft\)/);
    for (const m of [logo, favicon, banner]) await remove(A, m.id).expect(409);

    // Published: clearing the draft is not enough while the live theme shows it.
    await http().post(`/api/v1/stores/${A.id}/theme/publish`).set(auth(A.token)).expect(200);
    await patchTheme(A, { hero: { imageUrl: '' } }).expect(200);
    const blocked = await remove(A, banner.id).expect(409);
    expect(blocked.body.error.message).toMatch(/\(published\)/);

    // Store-level branding counts too.
    const storeLogo = (await upload(A, pngImage(256, 256, `slogo-${suffix}`), 'logo').expect(201)).body.data;
    await prisma.store.update({ where: { id: A.id }, data: { ogImageUrl: storeLogo.url } });
    await remove(A, storeLogo.id).expect(409);
    await prisma.store.update({ where: { id: A.id }, data: { ogImageUrl: null } });
    await remove(A, storeLogo.id).expect(200);
  });

  it("refuses an upload past the plan's storage (counting the whole business) and accepts it once space is freed", async () => {
    const GB = 1024 * 1024 * 1024;
    // A is on Business (5 GB). Fill it to 100 bytes under the limit; an int column cannot hold 5 GB in one row.
    const sizes = [2_000_000_000, 2_000_000_000, 5 * GB - 4_000_000_000 - 100];
    const filler = await Promise.all(
      sizes.map((size, i) =>
        prisma.media.create({
          data: { storeId: A.id, url: `https://example.invalid/fill-${i}`, key: `test/fill-${suffix}-${i}`, filename: `fill-${i}.png`, mimeType: 'image/png', size },
          select: { id: true },
        }),
      ),
    );
    try {
      const before = await prisma.media.count({ where: { storeId: A.id } });
      const refused = await upload(A, pngImage(64, 64, `full-${suffix}`), 'general').expect(403);
      expect(refused.body.error.code).toBe('PLAN_UPGRADE_REQUIRED');
      expect(refused.body.error.message).toMatch(/includes 5 GB of storage and you have used 5\.00 GB/);
      expect(await prisma.media.count({ where: { storeId: A.id } })).toBe(before);
      // Product image uploads count against the same storage.
      await http()
        .post(`/api/v1/stores/${A.id}/products/${A.productId}/image`)
        .set(auth(A.token))
        .attach('file', pngImage(64, 64, `full-p-${suffix}`), { filename: 'p.png', contentType: 'application/octet-stream' })
        .expect(403);
      // Another business is not affected.
      await upload(B, pngImage(64, 64, `other-${suffix}`), 'general').expect(201);
    } finally {
      await prisma.media.deleteMany({ where: { id: { in: filler.map((row) => row.id) } } });
    }
    await upload(A, pngImage(64, 64, `freed-${suffix}`), 'general').expect(201);
  });

  it('applies the chosen plan while its sign-up payment still waits for approval (no subscription yet)', async () => {
    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email: `gal.pending.${suffix}@example.com`, password: 'SecurePass1', firstName: 'P', lastName: 'N' })
      .expect(201);
    const P: Store = { key: 'p', token: reg.body.data.accessToken, id: '', slug: `gal-p-${suffix}`, productId: '' };
    P.id = (
      await http()
        .post('/api/v1/onboarding/store')
        .set(auth(P.token))
        .send(withPayment({ planSlug: 'starter', businessName: 'Gallery pending', tenantSlug: `${P.slug}-t`, storeName: 'Gallery pending', storeSlug: P.slug }))
        .expect(201)
    ).body.data.store.id;
    const tenantId = (await prisma.store.findUniqueOrThrow({ where: { id: P.id } })).tenantId;
    expect(await prisma.subscription.count({ where: { tenantId } })).toBe(0);

    // Starter storage: 1 GB.
    const filler = await prisma.media.create({
      data: { storeId: P.id, url: 'https://example.invalid/fill-p', key: `test/fill-p-${suffix}`, filename: 'fill.png', mimeType: 'image/png', size: 1024 * 1024 * 1024 - 10 },
      select: { id: true },
    });
    try {
      const refused = await upload(P, pngImage(64, 64, `pending-${suffix}`), 'general').expect(403);
      expect(refused.body.error.message).toMatch(/includes 1 GB of storage/);
    } finally {
      await prisma.media.delete({ where: { id: filler.id } });
    }
    await upload(P, pngImage(64, 64, `pending-ok-${suffix}`), 'general').expect(201);

    // Starter products: 25.
    const make = (i: number) =>
      http()
        .post(`/api/v1/stores/${P.id}/products`)
        .set(auth(P.token))
        .send({ name: `Pending ${i}`, slug: `pending-${i}-${suffix}`, basePrice: '10.00', trackInventory: false });
    for (let i = 1; i <= 25; i += 1) await make(i).expect(201);
    expect((await make(26).expect(403)).body.error.message).toMatch(/up to 25 products/);
  });

  it('keeps stores apart', async () => {
    const bImg = (await upload(B, pngImage(300, 300, `b-${suffix}`), 'general').expect(201)).body.data;
    expect((await list(A).expect(200)).body.data.items.map((i: { id: string }) => i.id)).not.toContain(bImg.id);

    await list(A, '', A.token, B.id).expect(403);
    await upload(A, pngImage(10, 10, `x-${suffix}`), 'general', 'x.png', A.token, B.id).expect(403);
    await remove(A, bImg.id, A.token, B.id).expect(403);
    await remove(A, bImg.id).expect(404); // B's image through A's own store
    await useForProduct(A, A.productId, bImg.id).expect(404); // B's image on A's product
    expect(await prisma.media.findUnique({ where: { id: bImg.id } })).not.toBeNull();
  });

  it('lets staff browse but not change the gallery, and requires a session', async () => {
    await list(A, '', staffToken).expect(200);
    await upload(A, pngImage(10, 10, `s-${suffix}`), 'general', 's.png', staffToken).expect(403);
    const any = (await list(A).expect(200)).body.data.items[0].id as string;
    await remove(A, any, staffToken).expect(403);
    await http().get(`/api/v1/stores/${A.id}/media`).expect(401);
  });
});
