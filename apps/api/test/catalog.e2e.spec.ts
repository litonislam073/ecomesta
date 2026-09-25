import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { MembershipStatus, StoreRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Catalog (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const managerA = {
    email: `phase5.a.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const managerB = {
    email: `phase5.b.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staffA = {
    email: `phase5.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let tenantAId = '';
  let storeAId = '';
  let tenantBId = '';
  let storeBId = '';

  let categoryAId = '';
  let categoryBId = '';
  let productAId = '';
  let productBId = '';
  let variantAId = '';
  let inventoryAId = '';
  let inventoryBId = '';

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

    // Clear auth rate-limit counters so e2e runs are not blocked by prior suites.
    const keys = await redis.getClient().keys('auth:rl:*');
    if (keys.length > 0) {
      await redis.getClient().del(...keys);
    }

    for (const user of [managerA, managerB, staffA]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Five',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboardA = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        businessName: 'Catalog Tenant A',
        tenantSlug: `cat-tenant-a-${suffix}`,
        storeName: 'Catalog Store A',
        storeSlug: `cat-store-a-${suffix}`,
      })
      .expect(201);
    tenantAId = onboardA.body.data.tenant.id;
    storeAId = onboardA.body.data.store.id;

    const onboardB = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({
        businessName: 'Catalog Tenant B',
        tenantSlug: `cat-tenant-b-${suffix}`,
        storeName: 'Catalog Store B',
        storeSlug: `cat-store-b-${suffix}`,
      })
      .expect(201);
    tenantBId = onboardB.body.data.tenant.id;
    storeBId = onboardB.body.data.store.id;

    await prisma.storeUser.create({
      data: {
        storeId: storeAId,
        userId: staffA.id,
        role: StoreRole.STORE_STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });

    const loginStaff = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: staffA.email, password: staffA.password })
      .expect(200);
    staffA.token = loginStaff.body.data.accessToken;
  });

  afterAll(async () => {
    const emails = [managerA.email, managerB.email, staffA.email];
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const storeIds = [storeAId, storeBId].filter(Boolean);
    const tenantIds = [tenantAId, tenantBId].filter(Boolean);

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
      await prisma.auditLog.deleteMany({
        where: { storeId: { in: storeIds } },
      });
      await prisma.storeUser.deleteMany({
        where: { storeId: { in: storeIds } },
      });
      await prisma.store.deleteMany({ where: { id: { in: storeIds } } });
    }

    if (tenantIds.length > 0) {
      await prisma.tenantUser.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }

    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------

  it('creates categories in store A and B', async () => {
    const a = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/categories`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic products',
        parentId: null,
      })
      .expect(201);
    categoryAId = a.body.data.id;
    expect(a.body.data.slug).toBe('electronics');
    expect(a.body.data.storeId).toBe(storeAId);

    const child = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/categories`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Mobile',
        slug: 'mobile',
        parentId: categoryAId,
      })
      .expect(201);
    expect(child.body.data.parentId).toBe(categoryAId);

    const b = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeBId}/categories`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ name: 'Electronics B', slug: 'electronics' })
      .expect(201);
    categoryBId = b.body.data.id;
  });

  it('rejects duplicate category slug in same store', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/categories`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ name: 'Dup', slug: 'electronics' })
      .expect(409);
  });

  it('rejects invalid slug and UUID', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/categories`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ name: 'Bad', slug: 'Bad Slug!' })
      .expect(400);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/categories/not-a-uuid`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(400);
  });

  it('blocks STORE_STAFF from creating categories', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/categories`)
      .set('Authorization', `Bearer ${staffA.token}`)
      .send({ name: 'Staff Cat', slug: 'staff-cat' })
      .expect(403);
  });

  it('allows STORE_STAFF to read categories', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/categories`)
      .set('Authorization', `Bearer ${staffA.token}`)
      .expect(200);
  });

  it('prevents circular category parent', async () => {
    const mobile = await prisma.category.findFirst({
      where: { storeId: storeAId, slug: 'mobile' },
    });
    expect(mobile).toBeTruthy();

    const android = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/categories`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Android',
        slug: 'android',
        parentId: mobile!.id,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeAId}/categories/${categoryAId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ parentId: android.body.data.id })
      .expect(422);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeAId}/categories/${categoryAId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ parentId: categoryAId })
      .expect(422);
  });

  it('rejects deleting category with children', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeAId}/categories/${categoryAId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(409);
  });

  it('blocks cross-store category access (IDOR)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeBId}/categories/${categoryBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeBId}/categories/${categoryBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ name: 'Hacked' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeBId}/categories/${categoryBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(403);

    // Same storeId path but foreign category id → 404
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/categories/${categoryBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(404);
  });

  // -------------------------------------------------------------------------
  // Products + variants
  // -------------------------------------------------------------------------

  it('creates products in each store', async () => {
    const a = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/products`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Premium T-Shirt',
        slug: 'premium-t-shirt',
        description: 'Soft cotton tee',
        shortDescription: 'Tee',
        status: 'DRAFT',
        productType: 'PHYSICAL',
        sku: 'TSHIRT-001',
        basePrice: '1200.00',
        compareAtPrice: '1500.00',
        costPrice: '700.00',
        trackInventory: true,
        allowBackorder: false,
        categoryIds: [categoryAId],
      })
      .expect(201);
    productAId = a.body.data.id;
    expect(a.body.data.basePrice).toBe('1200.00');
    expect(a.body.data.categoryIds).toEqual([categoryAId]);

    const b = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeBId}/products`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({
        name: 'Store B Product',
        slug: 'premium-t-shirt',
        sku: 'TSHIRT-001',
        basePrice: 99,
        categoryIds: [categoryBId],
      })
      .expect(201);
    productBId = b.body.data.id;
  });

  it('rejects assigning a category from another store', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/products`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Bad Cat Product',
        slug: 'bad-cat-product',
        basePrice: '10.00',
        categoryIds: [categoryBId],
      })
      .expect(400);
  });

  it('rejects duplicate product slug and SKU', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/products`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Dup slug',
        slug: 'premium-t-shirt',
        basePrice: '10.00',
      })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/products`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Dup sku',
        slug: 'dup-sku-product',
        sku: 'TSHIRT-001',
        basePrice: '10.00',
      })
      .expect(409);
  });

  it('rejects invalid price, status, and product type', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/products`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Bad price',
        slug: 'bad-price',
        basePrice: -5,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/products`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Bad status',
        slug: 'bad-status',
        basePrice: '10.00',
        status: 'ARCHIVED',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/products`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Bad type',
        slug: 'bad-type',
        basePrice: '10.00',
        productType: 'VIRTUAL',
      })
      .expect(400);
  });

  it('creates and lists variants', async () => {
    const variant = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/products/${productAId}/variants`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Large / Blue',
        sku: 'TSHIRT-001-L-BLUE',
        price: '1250.00',
        compareAtPrice: '1550.00',
        weight: '0.250',
      })
      .expect(201);
    variantAId = variant.body.data.id;
    expect(variant.body.data.price).toBe('1250.00');

    const list = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/products/${productAId}/variants`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);
    expect(list.body.data).toHaveLength(1);
  });

  it('rejects variant from another product path', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/stores/${storeAId}/products/${productAId}/variants/${variantAId}`,
      )
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);

    // Foreign product id with store A access → 404
    await request(app.getHttpServer())
      .get(
        `/api/v1/stores/${storeAId}/products/${productBId}/variants/${variantAId}`,
      )
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(404);
  });

  it('blocks cross-store product access (IDOR)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeBId}/products/${productBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/${storeBId}/products/${productBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ name: 'Hacked' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeBId}/products/${productBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/products/${productBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(404);
  });

  it('archives product instead of hard delete', async () => {
    const temp = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/products`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        name: 'Temp Archive',
        slug: 'temp-archive',
        basePrice: '5.00',
        trackInventory: false,
      })
      .expect(201);

    const archived = await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeAId}/products/${temp.body.data.id}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);
    expect(archived.body.data.status).toBe('ARCHIVED');

    const stillThere = await prisma.product.findUnique({
      where: { id: temp.body.data.id },
    });
    expect(stillThere?.status).toBe('ARCHIVED');
  });

  it('rejects deleting category with assigned products', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/stores/${storeAId}/categories/${categoryAId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(409);
  });

  // -------------------------------------------------------------------------
  // Inventory
  // -------------------------------------------------------------------------

  it('adjusts inventory and lists movements', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/inventory`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .query({ productId: productAId })
      .expect(200);

    expect(list.body.data.items.length).toBeGreaterThanOrEqual(1);
    const item = list.body.data.items.find(
      (row: { variantId: string | null }) => row.variantId === variantAId,
    );
    expect(item).toBeTruthy();
    inventoryAId = item.id;

    const adjusted = await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/inventory/adjust`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        productId: productAId,
        variantId: variantAId,
        quantity: 10,
        type: 'ADJUSTMENT',
        note: 'Initial stock',
      })
      .expect(201);

    expect(adjusted.body.data.inventoryItem.quantity).toBe(10);
    expect(adjusted.body.data.movement.quantity).toBe(10);

    const movements = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/inventory/${inventoryAId}/movements`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);
    expect(movements.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects negative inventory without backorder', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/inventory/adjust`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        productId: productAId,
        variantId: variantAId,
        quantity: -100,
        type: 'ADJUSTMENT',
      })
      .expect(422);
  });

  it('applies sequential adjustments without lost updates', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/inventory/adjust`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        productId: productAId,
        variantId: variantAId,
        quantity: 5,
        type: 'ADJUSTMENT',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/inventory/adjust`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        productId: productAId,
        variantId: variantAId,
        quantity: 3,
        type: 'ADJUSTMENT',
      })
      .expect(201);

    const item = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeAId}/inventory/${inventoryAId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(200);
    expect(item.body.data.quantity).toBe(18);
  });

  it('blocks STORE_STAFF from adjusting inventory', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/inventory/adjust`)
      .set('Authorization', `Bearer ${staffA.token}`)
      .send({
        productId: productAId,
        variantId: variantAId,
        quantity: 1,
        type: 'ADJUSTMENT',
      })
      .expect(403);
  });

  it('blocks cross-store inventory access and adjustment (IDOR)', async () => {
    const listB = await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeBId}/inventory`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .expect(200);
    inventoryBId = listB.body.data.items[0]?.id;
    expect(inventoryBId).toBeTruthy();

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${storeBId}/inventory/${inventoryBId}`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeBId}/inventory/adjust`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        productId: productBId,
        quantity: 5,
        type: 'ADJUSTMENT',
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeAId}/inventory/adjust`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({
        productId: productBId,
        quantity: 5,
        type: 'ADJUSTMENT',
      })
      .expect(404);
  });

  it('writes catalog audit events', async () => {
    const actions = await prisma.auditLog.findMany({
      where: {
        storeId: storeAId,
        action: {
          in: [
            'CATEGORY_CREATED',
            'PRODUCT_CREATED',
            'VARIANT_CREATED',
            'INVENTORY_ADJUSTED',
            'PRODUCT_ARCHIVED',
          ],
        },
      },
      select: { action: true },
    });
    const set = new Set(actions.map((a) => a.action));
    expect(set.has('CATEGORY_CREATED')).toBe(true);
    expect(set.has('PRODUCT_CREATED')).toBe(true);
    expect(set.has('VARIANT_CREATED')).toBe(true);
    expect(set.has('INVENTORY_ADJUSTED')).toBe(true);
    expect(set.has('PRODUCT_ARCHIVED')).toBe(true);
  });
});
