import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { ProductStatus, StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';

describe('Public storefront (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const manager = {
    email: `phase9.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let tenantId = '';
  let storeId = '';
  const storeSlug = `pub-store-${suffix}`;
  let otherStoreId = '';
  const otherStoreSlug = `other-store-${suffix}`;
  const categorySlug = `electronics-${suffix}`;
  const productSlug = `widget-${suffix}`;
  const draftProductSlug = `draft-${suffix}`;
  const managerB = {
    email: `phase9.b.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

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

    for (const user of [manager, managerB]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Nine',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${manager.token}`)
      .send(withPayment({
        businessName: 'Public Tenant',
        tenantSlug: `pub-tenant-${suffix}`,
        storeName: 'Public Store',
        storeSlug,
      }))
      .expect(201).then(activateOnboarded(app));
    tenantId = onboard.body.data.tenant.id;
    storeId = onboard.body.data.store.id;

    const onboardB = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${managerB.token}`)
      .send(withPayment({
        businessName: 'Other Tenant',
        tenantSlug: `other-tenant-${suffix}`,
        storeName: 'Other Store',
        storeSlug: otherStoreSlug,
      }))
      .expect(201).then(activateOnboarded(app));
    otherStoreId = onboardB.body.data.store.id;

    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });
    await prisma.store.update({
      where: { id: otherStoreId },
      data: { status: StoreStatus.ACTIVE },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/categories`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Electronics', slug: categorySlug })
      .expect(201);

    const otherCat = await request(app.getHttpServer())
      .post(`/api/v1/stores/${otherStoreId}/categories`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ name: 'Other Cat', slug: categorySlug })
      .expect(201);

    const catRes = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeId}/categories?search=Electronics`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);
    const categoryId = catRes.body.data.items[0].id;

    const product = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Widget',
        slug: productSlug,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '19.99',
        trackInventory: true,
        allowBackorder: false,
        categoryIds: [categoryId],
        shortDescription: 'A fine widget',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/inventory/adjust`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        productId: product.body.data.id,
        quantity: 10,
        type: 'ADJUSTMENT',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Draft Item',
        slug: draftProductSlug,
        status: 'DRAFT',
        productType: 'PHYSICAL',
        basePrice: '5.00',
        trackInventory: false,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${otherStoreId}/products`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({
        name: 'Foreign Widget',
        slug: productSlug,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '99.00',
        trackInventory: false,
      })
      .expect(201);

    void otherCat;
  });

  afterAll(async () => {
    const emails = [manager.email, managerB.email];
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const storeIds = [storeId, otherStoreId].filter(Boolean);

    if (storeIds.length > 0) {
      await prisma.inventoryMovement.deleteMany({
        where: { storeId: { in: storeIds } },
      });
      await prisma.inventoryItem.deleteMany({
        where: { storeId: { in: storeIds } },
      });
      await prisma.productCategory.deleteMany({
        where: { product: { storeId: { in: storeIds } } },
      });
      await prisma.productVariant.deleteMany({
        where: { storeId: { in: storeIds } },
      });
      await prisma.product.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.category.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.auditLog.deleteMany({ where: { storeId: { in: storeIds } } });
      await prisma.storeUser.deleteMany({
        where: { storeId: { in: storeIds } },
      });
      await prisma.store.deleteMany({ where: { id: { in: storeIds } } });
    }
    if (tenantId) {
      await prisma.tenantUser.deleteMany({ where: { tenantId } });
      const tenants = await prisma.tenant.findMany({
        where: { slug: { contains: suffix } },
        select: { id: true },
      });
      await prisma.tenantUser.deleteMany({
        where: { tenantId: { in: tenants.map((t) => t.id) } },
      });
      // Sign-up payments and the plan they started belong to the tenant.
      await prisma.billingPayment.deleteMany({ where: { tenantId: { in: tenants.map((t) => t.id) } } });
      await prisma.subscription.deleteMany({ where: { tenantId: { in: tenants.map((t) => t.id) } } });
      await prisma.tenant.deleteMany({
        where: { id: { in: tenants.map((t) => t.id) } },
      });
    }
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('returns public store profile for ACTIVE store', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}`)
      .expect(200);
    expect(res.body.data.slug).toBe(storeSlug);
    expect(res.body.data.currency).toBeDefined();
    expect(res.body.data).not.toHaveProperty('tenantId');
    expect(res.body.data).not.toHaveProperty('orderSequence');
  });

  it('hides inactive stores', async () => {
    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.DRAFT },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}`)
      .expect(404);
    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });
  });

  it('lists only ACTIVE products and supports search/category', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/products`)
      .expect(200);
    const slugs = list.body.data.items.map((p: { slug: string }) => p.slug);
    expect(slugs).toContain(productSlug);
    expect(slugs).not.toContain(draftProductSlug);
    expect(list.body.data.items[0]).not.toHaveProperty('costPrice');
    expect(list.body.data.items[0]).not.toHaveProperty('inventoryItems');

    const search = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/products?search=Widget`)
      .expect(200);
    expect(search.body.data.items.length).toBeGreaterThan(0);

    const byCat = await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${storeSlug}/products?categorySlug=${categorySlug}`,
      )
      .expect(200);
    expect(byCat.body.data.items.some((p: { slug: string }) => p.slug === productSlug)).toBe(
      true,
    );
  });

  it('returns product detail and hides draft/archived/wrong-store', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/products/${productSlug}`)
      .expect(200);
    expect(detail.body.data.name).toBe('Widget');
    expect(detail.body.data.available).toBe(true);
    expect(detail.body.data).not.toHaveProperty('costPrice');
    expect(detail.body.data).not.toHaveProperty('inventoryItems');

    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/products/${draftProductSlug}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/products/does-not-exist`)
      .expect(404);

    // Same product slug on other store — must not leak into this storefront.
    const foreign = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/products/${productSlug}`)
      .expect(200);
    expect(foreign.body.data.price).toBe('19.99');
  });

  it('lists categories and blocks cross-store category usage', async () => {
    const cats = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/categories?tree=true`)
      .expect(200);
    expect(cats.body.data.items.some((c: { slug: string }) => c.slug === categorySlug)).toBe(
      true,
    );

    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${otherStoreSlug}/categories/${categorySlug}`)
      .expect(200);

    // Product filter with category that exists on both stores stays store-scoped.
    const products = await request(app.getHttpServer())
      .get(
        `/api/v1/public/stores/${otherStoreSlug}/products?categorySlug=${categorySlug}`,
      )
      .expect(200);
    expect(
      products.body.data.items.every(
        (p: { slug: string; price: string }) =>
          p.slug !== productSlug || p.price === '99.00',
      ),
    ).toBe(true);
  });

  it('returns 404 for unknown store slug', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/public/stores/no-such-store-xyz')
      .expect(404);
  });

  it('archives product removes it from public API', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Temp',
        slug: `temp-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '1.00',
        trackInventory: false,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/products/temp-${suffix}`)
      .expect(200);

    await prisma.product.update({
      where: { id: created.body.data.id },
      data: { status: ProductStatus.ARCHIVED },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}/products/temp-${suffix}`)
      .expect(404);
  });
});
