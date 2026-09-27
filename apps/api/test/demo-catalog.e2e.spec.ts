import { existsSync } from 'fs';
import { join } from 'path';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { MembershipStatus, Prisma, StoreRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  DEMO_CATEGORIES,
  DEMO_PRODUCTS,
} from '../src/modules/demo-catalog/demo-catalog.data';

describe('Demo catalog import (e2e)', () => {
  jest.setTimeout(90_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const expectedVariants = DEMO_PRODUCTS.reduce(
    (sum, p) => sum + (p.variants?.length ?? 0),
    0,
  );
  const expectedInventory = DEMO_PRODUCTS.reduce(
    (sum, p) => sum + (p.variants?.length ? p.variants.length : 1),
    0,
  );

  type TestUser = { email: string; password: string; token: string; id: string };
  const makeUser = (tag: string): TestUser => ({
    email: `demo.${tag}.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  });

  const managerA = makeUser('a');
  const managerB = makeUser('b');
  const managerC = makeUser('c');
  const staffA = makeUser('staff');

  const stores: Record<'A' | 'B' | 'C', { tenantId: string; id: string; slug: string }> = {
    A: { tenantId: '', id: '', slug: `demo-store-a-${suffix}` },
    B: { tenantId: '', id: '', slug: `demo-store-b-${suffix}` },
    C: { tenantId: '', id: '', slug: `demo-store-c-${suffix}` },
  };

  const status = (user: TestUser, storeId: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/demo-catalog/status`)
      .set('Authorization', `Bearer ${user.token}`);

  const importDemo = (user: TestUser, storeId: string) =>
    request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/demo-catalog/import`)
      .set('Authorization', `Bearer ${user.token}`);

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

    const keys = await redis.getClient().keys('auth:rl:*');
    if (keys.length > 0) {
      await redis.getClient().del(...keys);
    }

    for (const user of [managerA, managerB, managerC, staffA]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Demo',
          lastName: 'Catalog',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const owners: Record<'A' | 'B' | 'C', TestUser> = {
      A: managerA,
      B: managerB,
      C: managerC,
    };
    for (const key of ['A', 'B', 'C'] as const) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/onboarding/store')
        .set('Authorization', `Bearer ${owners[key].token}`)
        .send({
          businessName: `Demo Tenant ${key}`,
          tenantSlug: `demo-tenant-${key.toLowerCase()}-${suffix}`,
          storeName: `Demo Store ${key}`,
          storeSlug: stores[key].slug,
        })
        .expect(201);
      stores[key].tenantId = res.body.data.tenant.id;
      stores[key].id = res.body.data.store.id;
    }

    await prisma.storeUser.create({
      data: {
        storeId: stores.A.id,
        userId: staffA.id,
        role: StoreRole.STORE_STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    const emails = [managerA, managerB, managerC, staffA].map((u) => u.email);
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const storeIds = Object.values(stores).map((s) => s.id).filter(Boolean);
    const tenantIds = Object.values(stores).map((s) => s.tenantId).filter(Boolean);

    if (storeIds.length > 0) {
      await prisma.inventoryMovement.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.inventoryItem.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.productCategory.deleteMany({
        where: { product: { storeId: { in: storeIds } } },
      });
      await prisma.productVariant.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.product.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.category.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.auditLog.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.storeUser.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.store.deleteMany({ where: { id: { in: storeIds } } });
    }
    if (tenantIds.length > 0) {
      await prisma.tenantUser.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('does not import sample products during onboarding', async () => {
    for (const key of ['A', 'B', 'C'] as const) {
      expect(await prisma.product.count({ where: { storeId: stores[key].id } })).toBe(0);
      expect(await prisma.category.count({ where: { storeId: stores[key].id } })).toBe(0);
    }
  });

  it('reports import available for a new store', async () => {
    const res = await status(managerA, stores.A.id).expect(200);
    expect(res.body.data).toEqual({
      available: true,
      imported: false,
      hasRealProducts: false,
    });
  });

  it('rejects unauthenticated status and import', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${stores.A.id}/demo-catalog/status`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${stores.A.id}/demo-catalog/import`)
      .expect(401);
  });

  it('rejects STORE_STAFF import (manager permission required)', async () => {
    await importDemo(staffA, stores.A.id).expect(403);
  });

  it('rejects cross-store / cross-tenant status and import', async () => {
    await status(managerB, stores.A.id).expect(403);
    await importDemo(managerB, stores.A.id).expect(403);
    expect(await prisma.product.count({ where: { storeId: stores.A.id } })).toBe(0);
  });

  it('imports the sample catalog atomically with BDT pricing and demo markers', async () => {
    const res = await importDemo(managerA, stores.A.id).expect(201);
    expect(res.body.data).toEqual({
      categories: DEMO_CATEGORIES.length,
      products: DEMO_PRODUCTS.length,
      variants: expectedVariants,
      inventoryItems: expectedInventory,
    });

    const storeId = stores.A.id;
    const categories = await prisma.category.findMany({ where: { storeId } });
    const products = await prisma.product.findMany({
      where: { storeId },
      include: { categories: true },
    });
    const variants = await prisma.productVariant.count({ where: { storeId } });
    const inventory = await prisma.inventoryItem.findMany({ where: { storeId } });
    const movements = await prisma.inventoryMovement.findMany({ where: { storeId } });

    expect(categories).toHaveLength(DEMO_CATEGORIES.length);
    expect(categories.every((c) => c.isDemo)).toBe(true);
    expect(products).toHaveLength(DEMO_PRODUCTS.length);
    expect(products.every((p) => p.isDemo && p.status === 'ACTIVE')).toBe(true);
    expect(products.every((p) => p.categories.length === 1)).toBe(true);
    expect(variants).toBe(expectedVariants);
    expect(inventory).toHaveLength(expectedInventory);
    expect(inventory.every((i) => i.quantity >= 8 && i.reservedQuantity === 0)).toBe(true);
    expect(movements.every((m) => m.type === 'ADJUSTMENT')).toBe(true);
    expect(movements.some((m) => m.type === 'SALE')).toBe(false);

    const headphones = products.find((p) => p.slug === 'wireless-headphones');
    expect(headphones?.basePrice.toString()).toBe('2490');

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    expect(store?.currency).toBe('BDT');
    expect(store?.demoCatalogImportedAt).not.toBeNull();
    expect(store?.firstRealProductCreatedAt).toBeNull();
  });

  it('does not create orders, payments, customers, coupon usage, or shipments', async () => {
    const storeId = stores.A.id;
    expect(await prisma.order.count({ where: { storeId } })).toBe(0);
    expect(await prisma.payment.count({ where: { storeId } })).toBe(0);
    expect(await prisma.customer.count({ where: { storeId } })).toBe(0);
    expect(await prisma.shipment.count({ where: { storeId } })).toBe(0);
    expect(
      await prisma.couponUsage.count({ where: { coupon: { storeId } } }),
    ).toBe(0);
  });

  it('exposes isDemo to merchants and hides it from the public storefront', async () => {
    const merchant = await request(app.getHttpServer())
      .get(`/api/v1/stores/${stores.A.id}/products?limit=50`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);
    expect(
      merchant.body.data.items.every((p: { isDemo: boolean }) => p.isDemo === true),
    ).toBe(true);

    const cats = await request(app.getHttpServer())
      .get(`/api/v1/stores/${stores.A.id}/categories?limit=50`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);
    expect(
      cats.body.data.items.every((c: { isDemo: boolean }) => c.isDemo === true),
    ).toBe(true);

    const publicList = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${stores.A.slug}/products?limit=50`)
      .expect(200);
    expect(publicList.body.data.items).toHaveLength(DEMO_PRODUCTS.length);
    for (const item of publicList.body.data.items) {
      expect(item).not.toHaveProperty('isDemo');
      expect(item.currency).toBe('BDT');
      expect(item.available).toBe(true);
      expect(item.images).toEqual([
        { url: `/demo-catalog/${item.slug}.jpg`, alt: item.name },
      ]);
      expect(
        existsSync(
          join(__dirname, '../../web/public/demo-catalog', `${item.slug}.jpg`),
        ),
      ).toBe(true);
    }

    const publicCats = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${stores.A.slug}/categories`)
      .expect(200);
    expect(publicCats.body.data.items).toHaveLength(DEMO_CATEGORIES.length);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${stores.A.slug}/products/cotton-t-shirt`)
      .expect(200);
    expect(detail.body.data.hasVariants).toBe(true);
    expect(detail.body.data.variants).toHaveLength(3);
  });

  it('rejects a second import with 409', async () => {
    const res = await importDemo(managerA, stores.A.id).expect(409);
    expect(res.body.error.message).toMatch(/already been added/i);
    expect(await prisma.product.count({ where: { storeId: stores.A.id } })).toBe(
      DEMO_PRODUCTS.length,
    );
    const s = await status(managerA, stores.A.id).expect(200);
    expect(s.body.data).toEqual({
      available: false,
      imported: true,
      hasRealProducts: false,
    });
  });

  it('keeps import unavailable after all demo products are archived', async () => {
    const products = await prisma.product.findMany({
      where: { storeId: stores.A.id },
      select: { id: true },
    });
    for (const product of products) {
      await request(app.getHttpServer())
        .delete(`/api/v1/stores/${stores.A.id}/products/${product.id}`)
        .set('Authorization', `Bearer ${managerA.token}`)
        .expect(200);
    }
    const s = await status(managerA, stores.A.id).expect(200);
    expect(s.body.data.available).toBe(false);
    await importDemo(managerA, stores.A.id).expect(409);
  });

  it('allows editing a demo product and keeps it marked as demo', async () => {
    const product = await prisma.product.findFirstOrThrow({
      where: { storeId: stores.A.id, slug: 'smart-watch' },
    });
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/stores/${stores.A.id}/products/${product.id}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ name: 'My Smart Watch', basePrice: '4200.00' })
      .expect(200);
    expect(res.body.data.isDemo).toBe(true);
    expect(res.body.data.basePrice).toBe('4200.00');
  });

  it('marks a merchant-created product as real, never demo', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/stores/${stores.A.id}/products`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ name: 'My Product', slug: `my-product-${suffix}`, basePrice: '100.00' })
      .expect(201);
    expect(res.body.data.isDemo).toBe(false);
    const s = await status(managerA, stores.A.id).expect(200);
    expect(s.body.data).toEqual({
      available: false,
      imported: true,
      hasRealProducts: true,
    });
  });

  it('hides import permanently once a real product exists, even after archiving it', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/stores/${stores.B.id}/products`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ name: 'First Real', slug: `first-real-${suffix}`, basePrice: '250.00' })
      .expect(201);

    let s = await status(managerB, stores.B.id).expect(200);
    expect(s.body.data).toEqual({
      available: false,
      imported: false,
      hasRealProducts: true,
    });
    const rejected = await importDemo(managerB, stores.B.id).expect(409);
    expect(rejected.body.error.message).toMatch(/before you add your own products/i);

    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${stores.B.id}/products/${created.body.data.id}`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .expect(200);
    s = await status(managerB, stores.B.id).expect(200);
    expect(s.body.data.available).toBe(false);
    expect(await prisma.product.count({ where: { storeId: stores.B.id, isDemo: true } })).toBe(0);
  });

  it('rolls back the entire import when a step fails mid-transaction', async () => {
    const original = prisma.$transaction.bind(prisma) as (
      fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options?: unknown,
    ) => Promise<unknown>;
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(((
      fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options?: unknown,
    ) =>
      original(async (tx) => {
        const failing = new Proxy(tx, {
          get(target, prop, receiver) {
            if (prop === 'inventoryMovement') {
              return {
                create: () => Promise.reject(new Error('forced failure')),
              };
            }
            return Reflect.get(target, prop, receiver);
          },
        });
        return fn(failing);
      }, options)) as never);

    await importDemo(managerC, stores.C.id).expect(500);
    spy.mockRestore();

    const storeId = stores.C.id;
    expect(await prisma.category.count({ where: { storeId } })).toBe(0);
    expect(await prisma.product.count({ where: { storeId } })).toBe(0);
    expect(await prisma.productVariant.count({ where: { storeId } })).toBe(0);
    expect(await prisma.inventoryItem.count({ where: { storeId } })).toBe(0);
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    expect(store?.demoCatalogImportedAt).toBeNull();
    const s = await status(managerC, storeId).expect(200);
    expect(s.body.data.available).toBe(true);
  });

  it('creates exactly one demo catalog under concurrent import requests', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => importDemo(managerC, stores.C.id)),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);

    const storeId = stores.C.id;
    expect(await prisma.product.count({ where: { storeId } })).toBe(DEMO_PRODUCTS.length);
    expect(await prisma.category.count({ where: { storeId } })).toBe(DEMO_CATEGORIES.length);
    expect(await prisma.productVariant.count({ where: { storeId } })).toBe(expectedVariants);
    expect(await prisma.inventoryItem.count({ where: { storeId } })).toBe(expectedInventory);
  });
});
