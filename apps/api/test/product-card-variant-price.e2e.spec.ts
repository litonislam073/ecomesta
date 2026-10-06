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
import { activateOnboarded, withPayment } from './support/onboarding';

/**
 * Product cards for products with variants showed `basePrice` (often 0.00).
 * Public cards now carry the price range of the variants that can be bought.
 */
describe('Public product cards: variant price range (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const slug = `vcard-${suffix}`;
  let token = '';
  let storeId = '';
  let categoryId = '';

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  async function product(name: string, basePrice: string, stock: number, variants: [string, string, number][] = [], status = 'ACTIVE') {
    const id = (
      await http()
        .post(`/api/v1/stores/${storeId}/products`)
        .set(auth())
        .send({ name, slug: name.toLowerCase().replace(/\s+/g, '-'), status, productType: 'PHYSICAL', basePrice, trackInventory: true, categoryIds: [categoryId] })
        .expect(201)
    ).body.data.id as string;
    if (stock) {
      await http().post(`/api/v1/stores/${storeId}/inventory/adjust`).set(auth()).send({ productId: id, quantity: stock, type: 'ADJUSTMENT' }).expect(201);
    }
    for (const [variantName, price, variantStock] of variants) {
      const variantId = (
        await http().post(`/api/v1/stores/${storeId}/products/${id}/variants`).set(auth()).send({ name: variantName, price }).expect(201)
      ).body.data.id;
      if (variantStock) {
        await http().post(`/api/v1/stores/${storeId}/inventory/adjust`).set(auth()).send({ productId: id, variantId, quantity: variantStock, type: 'ADJUSTMENT' }).expect(201);
      }
    }
  }

  const pick = (card: Record<string, unknown>) => ({
    price: card.price,
    available: card.available,
    hasVariants: card.hasVariants,
    variantPriceMin: card.variantPriceMin,
    variantPriceMax: card.variantPriceMax,
  });

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

    token = (
      await http().post('/api/v1/auth/register').send({ email: `${slug}@example.com`, password: 'SecurePass1', firstName: 'V', lastName: 'C' }).expect(201)
    ).body.data.accessToken;
    storeId = (
      await http().post('/api/v1/onboarding/store').set(auth()).send(withPayment({ businessName: 'VCard', tenantSlug: `${slug}-t`, storeName: 'VCard', storeSlug: slug })).expect(201).then(activateOnboarded(app))
    ).body.data.store.id;
    await prisma.store.update({ where: { id: storeId }, data: { status: StoreStatus.ACTIVE } });
    categoryId = (await http().post(`/api/v1/stores/${storeId}/categories`).set(auth()).send({ name: 'Tops', slug: 'tops' }).expect(201)).body.data.id;

    await product('A Simple', '1200.00', 5);
    await product('B One', '0.00', 0, [['Red', '650.00', 3]]);
    await product('C Same', '0.00', 0, [['Red', '650.00', 1], ['Blue', '650.00', 1]]);
    await product('D Range', '0.00', 0, [['Red', '650.00', 1], ['Blue', '800.00', 1], ['Green', '950.00', 1]]);
    await product('E Cheap Sold Out', '0.00', 0, [['Red', '300.00', 0], ['Blue', '700.00', 2]]);
    await product('F All Gone', '0.00', 0, [['Red', '500.00', 0], ['Blue', '600.00', 0]]);
    await product('G Draft', '0.00', 0, [['Red', '400.00', 2]], 'DRAFT');
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  const expected = {
    'A Simple': { price: '1200.00', available: true, hasVariants: false, variantPriceMin: null, variantPriceMax: null },
    'B One': { price: '0.00', available: true, hasVariants: true, variantPriceMin: '650.00', variantPriceMax: '650.00' },
    'C Same': { price: '0.00', available: true, hasVariants: true, variantPriceMin: '650.00', variantPriceMax: '650.00' },
    'D Range': { price: '0.00', available: true, hasVariants: true, variantPriceMin: '650.00', variantPriceMax: '950.00' },
    'E Cheap Sold Out': { price: '0.00', available: true, hasVariants: true, variantPriceMin: '700.00', variantPriceMax: '700.00' },
    'F All Gone': { price: '0.00', available: false, hasVariants: true, variantPriceMin: null, variantPriceMax: null },
  };

  it.each([
    ['product listing', () => `/api/v1/public/stores/${slug}/products?limit=50`],
    ['category listing', () => `/api/v1/public/stores/${slug}/products?categorySlug=tops&limit=50`],
  ])('%s cards carry the available-variant price range', async (_label, url) => {
    const res = await http().get(url()).expect(200);
    const cards = Object.fromEntries(
      (res.body.data.items as Record<string, unknown>[]).map((c) => [c.name as string, pick(c)]),
    );
    expect(cards).toEqual(expected);
    expect(cards).not.toHaveProperty('G Draft');
  });

  it('the product detail keeps its variants and the same range', async () => {
    const res = await http().get(`/api/v1/public/stores/${slug}/products/e-cheap-sold-out`).expect(200);
    expect(pick(res.body.data)).toEqual(expected['E Cheap Sold Out']);
    expect(res.body.data.variants.map((v: { name: string; price: string; available: boolean }) => [v.name, v.price, v.available])).toEqual([
      ['Red', '300.00', false],
      ['Blue', '700.00', true],
    ]);
    await http().get(`/api/v1/public/stores/${slug}/products/g-draft`).expect(404);
  });
});
