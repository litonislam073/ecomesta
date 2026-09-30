import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

/**
 * SF-04: merchants upload, replace and remove a product image. Images are kept
 * in the store-scoped `media` table and served from /public/media/:id; the
 * product's `imageUrl` is only ever set by the server.
 */
describe('SF-04 merchant product images (e2e)', () => {
  jest.setTimeout(180_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  type Store = { key: string; token: string; id: string; slug: string; productId: string };
  const A: Store = { key: 'a', token: '', id: '', slug: `sf04-a-${suffix}`, productId: '' };
  const B: Store = { key: 'b', token: '', id: '', slug: `sf04-b-${suffix}`, productId: '' };

  const http = () => request(app.getHttpServer());
  const auth = (s: Store) => ({ Authorization: `Bearer ${s.token}` });
  const MEDIA_URL = /^http:\/\/localhost:3001\/api\/v1\/public\/media\/([0-9a-f-]{36})$/;

  // Real headers followed by filler; the server checks content, not the name.
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(`png-body-${suffix}`),
  ]);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`jpeg-body-${suffix}`)]);
  const webp = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x20, 0, 0, 0]),
    Buffer.from('WEBPVP8 '),
    Buffer.from(`webp-body-${suffix}`),
  ]);

  const upload = (s: Store, productId: string, file: Buffer, filename = 'photo.png', storeId = s.id) =>
    http()
      .post(`/api/v1/stores/${storeId}/products/${productId}/image`)
      .set(auth(s))
      .attach('file', file, { filename, contentType: 'image/png' });
  const removeImage = (s: Store, productId: string, storeId = s.id) =>
    http().delete(`/api/v1/stores/${storeId}/products/${productId}/image`).set(auth(s));
  const storefrontProduct = (s: Store, slug: string) => http().get(`/api/v1/public/stores/${s.slug}/products/${slug}`);
  const mediaIdOf = (url: string | null) => url?.match(MEDIA_URL)?.[1] ?? null;

  async function product(s: Store, name: string, status = 'ACTIVE') {
    return (
      await http()
        .post(`/api/v1/stores/${s.id}/products`)
        .set(auth(s))
        .send({ name, slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${suffix}`, status, productType: 'PHYSICAL', basePrice: '250.00', trackInventory: false })
        .expect(201)
    ).body.data as { id: string; slug: string };
  }

  function expectCleanError(body: { error?: Record<string, unknown> }) {
    expect(Object.keys(body.error ?? {}).sort()).toEqual(['code', 'message']);
    expect(JSON.stringify(body)).not.toMatch(/prisma|stack|[A-Z]:\\|\/tmp\/|node_modules|S3_|secret/i);
  }

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
        .send({ email: `sf04.${s.key}.${suffix}@example.com`, password: 'SecurePass1', firstName: 'S', lastName: 'F' })
        .expect(201);
      s.token = reg.body.data.accessToken;
      s.id = (
        await http()
          .post('/api/v1/onboarding/store')
          .set(auth(s))
          .send({ businessName: `SF04 ${s.key}`, tenantSlug: `${s.slug}-t`, storeName: `SF04 ${s.key}`, storeSlug: s.slug })
          .expect(201)
      ).body.data.store.id;
      await prisma.store.update({ where: { id: s.id }, data: { status: StoreStatus.ACTIVE } });
      s.productId = (await product(s, `Kurta ${s.key}`)).id;
    }
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  it('A — uploads an image for the merchant’s own product and serves it to the storefront', async () => {
    const p = await product(A, 'Upload Saree');
    const res = await upload(A, p.id, png, 'my photo.png');
    expect(res.status).toBe(200);
    const imageUrl = res.body.data.imageUrl as string;
    expect(imageUrl).toMatch(MEDIA_URL);
    const mediaId = mediaIdOf(imageUrl)!;

    const media = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } });
    expect(media).toMatchObject({
      storeId: A.id,
      mimeType: 'image/png',
      size: png.length,
      filename: 'my photo.png',
      key: `products/${p.id}/${mediaId}.png`,
      url: imageUrl,
    });
    expect(Buffer.from(media.data!).equals(png)).toBe(true);

    const merchant = await http().get(`/api/v1/stores/${A.id}/products/${p.id}`).set(auth(A)).expect(200);
    expect(merchant.body.data.imageUrl).toBe(imageUrl);

    const detail = await storefrontProduct(A, p.slug).expect(200);
    expect(detail.body.data.images).toEqual([{ url: imageUrl, alt: 'Upload Saree' }]);
    const listing = await http().get(`/api/v1/public/stores/${A.slug}/products?limit=100`).expect(200);
    const card = listing.body.data.items.find((i: { id: string }) => i.id === p.id);
    expect(card.images[0].url).toBe(imageUrl);

    const served = await http().get(`/api/v1/public/media/${mediaId}`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(served.status).toBe(200);
    expect(Buffer.from(served.body as Buffer).equals(png)).toBe(true);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('B — replaces the image; the storefront gets the new one and the old upload is retired', async () => {
    const p = await product(A, 'Replace Panjabi');
    const first = mediaIdOf((await upload(A, p.id, png).expect(200)).body.data.imageUrl)!;
    const second = await upload(A, p.id, jpeg, 'new.jpg').expect(200);
    const secondId = mediaIdOf(second.body.data.imageUrl)!;

    expect(secondId).not.toBe(first);
    expect((await prisma.media.findUniqueOrThrow({ where: { id: secondId } })).mimeType).toBe('image/jpeg');
    await http().get(`/api/v1/public/media/${secondId}`).expect(200);
    // Still served during the grace period for briefly cached storefront pages.
    await http().get(`/api/v1/public/media/${first}`).expect(200);
    expect((await storefrontProduct(A, p.slug)).body.data.images[0].url).toBe(second.body.data.imageUrl);

    // A demo-catalog path is simply replaced; nothing else is deleted.
    const demo = await product(A, 'Demo Fatua');
    await prisma.product.update({ where: { id: demo.id }, data: { imageUrl: '/demo-catalog/fatua.jpg' } });
    const mediaBefore = await prisma.media.count({ where: { storeId: A.id } });
    const replaced = await upload(A, demo.id, webp, 'x.webp').expect(200);
    expect(replaced.body.data.imageUrl).toMatch(MEDIA_URL);
    expect(await prisma.media.count({ where: { storeId: A.id } })).toBe(mediaBefore + 1);
  });

  it('B — concurrent uploads settle on one image; the rest are retired and purged after the grace period', async () => {
    const p = await product(A, 'Race Lungi');
    const results = await Promise.all([png, jpeg, webp, png].map((f) => upload(A, p.id, f)));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    const current = mediaIdOf((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).imageUrl)!;
    const rows = await prisma.media.findMany({ where: { key: { startsWith: `products/${p.id}/` } }, select: { id: true } });
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.id)).toContain(current);

    // Age the retired uploads past the grace period; the next image change in the store purges them.
    await prisma.media.updateMany({
      where: { key: { startsWith: `products/${p.id}/` }, id: { not: current } },
      data: { updatedAt: new Date(Date.now() - 11 * 60_000) },
    });
    await upload(A, A.productId, png).expect(200);
    const left = await prisma.media.findMany({ where: { key: { startsWith: `products/${p.id}/` } }, select: { id: true } });
    expect(left.map((r) => r.id)).toEqual([current]);
    await http().get(`/api/v1/public/media/${current}`).expect(200);
  });

  it('C — purging never touches images in use or another store’s uploads', async () => {
    const bInUse = mediaIdOf((await upload(B, B.productId, png).expect(200)).body.data.imageUrl)!;
    const bOld = await product(B, 'B Retired');
    const bRetired = mediaIdOf((await upload(B, bOld.id, png).expect(200)).body.data.imageUrl)!;
    await removeImage(B, bOld.id).expect(200);
    const aInUse = await product(A, 'A In Use');
    const aCurrent = mediaIdOf((await upload(A, aInUse.id, png).expect(200)).body.data.imageUrl)!;
    const old = new Date(Date.now() - 60 * 60_000);
    await prisma.media.updateMany({ where: { id: { in: [bInUse, bRetired, aCurrent] } }, data: { updatedAt: old } });

    await upload(A, A.productId, jpeg).expect(200); // purge runs for store A only
    expect(await prisma.media.findUnique({ where: { id: aCurrent } })).not.toBeNull();
    expect(await prisma.media.findUnique({ where: { id: bRetired } })).not.toBeNull();

    await upload(B, B.productId, jpeg).expect(200); // store B: bRetired and the replaced bInUse go
    expect(await prisma.media.findUnique({ where: { id: bRetired } })).toBeNull();
  });

  it('C — removes the image from the product, storage and storefront', async () => {
    const p = await product(A, 'Remove Shawl');
    const mediaId = mediaIdOf((await upload(A, p.id, png).expect(200)).body.data.imageUrl)!;

    const removed = await removeImage(A, p.id).expect(200);
    expect(removed.body.data.imageUrl).toBeNull();
    expect((await storefrontProduct(A, p.slug)).body.data.images).toEqual([]);

    // Retired, then purged once the grace period has passed.
    await prisma.media.update({ where: { id: mediaId }, data: { updatedAt: new Date(Date.now() - 11 * 60_000) } });
    await removeImage(A, p.id).expect(200);
    expect(await prisma.media.findUnique({ where: { id: mediaId } })).toBeNull();
    await http().get(`/api/v1/public/media/${mediaId}`).expect(404);
    expect((await http().get(`/api/v1/stores/${A.id}/products/${p.id}`).set(auth(A))).body.data.imageUrl).toBeNull();

    // Removing again is harmless.
    expect((await removeImage(A, p.id).expect(200)).body.data.imageUrl).toBeNull();
  });

  it('D — a merchant cannot upload, replace or remove another store’s product image', async () => {
    const bImage = (await upload(B, B.productId, png).expect(200)).body.data.imageUrl;
    const bMedia = mediaIdOf(bImage)!;

    // Store A's token against store B's routes: no store access.
    const crossUpload = await upload(A, B.productId, jpeg, 'x.jpg', B.id);
    expect(crossUpload.status).toBe(403);
    expectCleanError(crossUpload.body);
    expect((await removeImage(A, B.productId, B.id)).status).toBe(403);

    // Store B's product id under store A: not found in A.
    const underOwnStore = await upload(A, B.productId, jpeg);
    expect(underOwnStore.status).toBe(404);
    expectCleanError(underOwnStore.body);
    expect((await removeImage(A, B.productId)).status).toBe(404);

    const bProduct = await prisma.product.findUniqueOrThrow({ where: { id: B.productId } });
    expect(bProduct.imageUrl).toBe(bImage);
    expect(await prisma.media.findUnique({ where: { id: bMedia } })).not.toBeNull();

    // A's uploads are stored under A only.
    const aMedia = mediaIdOf((await upload(A, A.productId, png).expect(200)).body.data.imageUrl)!;
    expect((await prisma.media.findUniqueOrThrow({ where: { id: aMedia } })).storeId).toBe(A.id);
  });

  it('E — requires a valid merchant session', async () => {
    const anonymous = await http()
      .post(`/api/v1/stores/${A.id}/products/${A.productId}/image`)
      .attach('file', png, { filename: 'a.png', contentType: 'image/png' });
    expect(anonymous.status).toBe(401);
    const forged = await http()
      .post(`/api/v1/stores/${A.id}/products/${A.productId}/image`)
      .set('Authorization', 'Bearer not-a-real-token')
      .attach('file', png, { filename: 'a.png', contentType: 'image/png' });
    expect(forged.status).toBe(401);
    expect((await http().delete(`/api/v1/stores/${A.id}/products/${A.productId}/image`)).status).toBe(401);
  });

  it('F — accepts JPEG, PNG and WebP by content and rejects everything else cleanly', async () => {
    const p = await product(A, 'Format Tupi');
    for (const [file, mime] of [[jpeg, 'image/jpeg'], [png, 'image/png'], [webp, 'image/webp']] as const) {
      const res = await upload(A, p.id, file, 'upload.bin').expect(200);
      expect((await prisma.media.findUniqueOrThrow({ where: { id: mediaIdOf(res.body.data.imageUrl)! } })).mimeType).toBe(mime);
    }
    const before = (await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).imageUrl;

    const rejects: [string, () => request.Test, number][] = [
      ['text named .png', () => upload(A, p.id, Buffer.from('hello, not an image'), 'evil.png'), 415],
      ['script', () => upload(A, p.id, Buffer.from('<script>alert(1)</script>'), 'x.svg'), 415],
      ['executable', () => upload(A, p.id, Buffer.from('MZ\x90\x00executable'), 'setup.exe'), 415],
      ['gif', () => upload(A, p.id, Buffer.from('GIF89a....'), 'a.gif'), 415],
      ['oversized', () => upload(A, p.id, Buffer.concat([png, Buffer.alloc(1_500_001)]), 'big.png'), 413],
      ['empty', () => upload(A, p.id, Buffer.alloc(0), 'empty.png'), 400],
      ['json body', () => http().post(`/api/v1/stores/${A.id}/products/${p.id}/image`).set(auth(A)).send({ imageUrl: 'https://evil.example/x.png' }), 400],
      ['wrong field', () => http().post(`/api/v1/stores/${A.id}/products/${p.id}/image`).set(auth(A)).attach('image', png, 'a.png'), 400],
      ['two files', () => http().post(`/api/v1/stores/${A.id}/products/${p.id}/image`).set(auth(A)).attach('file', png, 'a.png').attach('file', png, 'b.png'), 400],
    ];
    for (const [label, pending, status] of rejects) {
      const res = await pending();
      expect([label, res.status]).toEqual([label, status]);
      expectCleanError(res.body);
    }
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).imageUrl).toBe(before);

    // The ordinary product update still cannot set an arbitrary image URL.
    const injected = await http().patch(`/api/v1/stores/${A.id}/products/${p.id}`).set(auth(A)).send({ imageUrl: 'https://evil.example/x.png' });
    expect(injected.status).toBe(400);
  });

  it('G — validates the product and follows the existing product-edit rules', async () => {
    expect((await upload(A, 'not-a-uuid', png)).status).toBe(400);
    const missing = await upload(A, '00000000-0000-4000-8000-000000000000', png);
    expect(missing.status).toBe(404);
    expect(missing.body.error.message).toBe('Product not found');
    expect((await http().get('/api/v1/public/media/not-a-uuid')).status).toBe(400);
    expect((await http().get('/api/v1/public/media/00000000-0000-4000-8000-000000000000')).status).toBe(404);

    // Archived/draft products stay editable (as with PATCH) but are not public.
    const archived = await product(A, 'Archived Gamcha');
    await http().delete(`/api/v1/stores/${A.id}/products/${archived.id}`).set(auth(A)).expect(200);
    expect((await upload(A, archived.id, png)).status).toBe(200);
    expect((await storefrontProduct(A, archived.slug)).status).toBe(404);
    const draft = await product(A, 'Draft Gamcha', 'DRAFT');
    expect((await upload(A, draft.id, png)).status).toBe(200);
    expect((await storefrontProduct(A, draft.slug)).status).toBe(404);
  });

  it('H — ordinary product edits keep the uploaded image', async () => {
    const p = await product(A, 'Keep Sherwani');
    const imageUrl = (await upload(A, p.id, png).expect(200)).body.data.imageUrl;
    const updated = await http().patch(`/api/v1/stores/${A.id}/products/${p.id}`).set(auth(A)).send({ name: 'Keep Sherwani 2', basePrice: '300.00' }).expect(200);
    expect(updated.body.data).toMatchObject({ name: 'Keep Sherwani 2', basePrice: '300.00', imageUrl });
    const list = await http().get(`/api/v1/stores/${A.id}/products?limit=100`).set(auth(A)).expect(200);
    expect(list.body.data.items.find((i: { id: string }) => i.id === p.id).imageUrl).toBe(imageUrl);
  });
});
