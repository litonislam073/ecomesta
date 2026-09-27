import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  DomainStatus,
  DomainType,
  Prisma,
  StoreStatus,
  TenantStatus,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { isReservedStoreSlug } from '../src/modules/domains/domain-normalize';

/**
 * Store slugs are the `{slug}.{PLATFORM_ROOT_DOMAIN}` label, so they must be
 * unique across tenants for platform subdomain routing to be unambiguous.
 */
describe('Store slug uniqueness and platform subdomain routing (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const platformRoot = process.env.PLATFORM_ROOT_DOMAIN ?? 'ecomesta.local';

  const merchantA = {
    email: `slug.a.${suffix}@example.com`,
    token: '',
  };
  const merchantB = {
    email: `slug.b.${suffix}@example.com`,
    token: '',
  };
  const merchantC = {
    email: `slug.c.${suffix}@example.com`,
    token: '',
  };

  const slugA = `shop-a-${suffix}`;
  const slugB = `shop-b-${suffix}`;
  const tenantSlugA = `slug-tenant-a-${suffix}`;
  const tenantSlugB = `slug-tenant-b-${suffix}`;
  const customHost = `slug-shop-${suffix}.example.com`;

  let storeAId = '';
  let storeBId = '';
  let tenantBId = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const resolve = (host: string) =>
    request(app.getHttpServer()).get(
      `/api/v1/public/domain/resolve?host=${encodeURIComponent(host)}`,
    );

  const clearDomainCache = async () => {
    const keys = await redis.getClient().keys('storefront:domain:*');
    if (keys.length > 0) {
      await redis.getClient().del(...keys);
    }
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

    for (const pattern of ['auth:rl:*', 'rl:*', 'storefront:domain:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) {
        await redis.getClient().del(...keys);
      }
    }

    for (const merchant of [merchantA, merchantB, merchantC]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: merchant.email,
          password: 'SecurePass1',
          firstName: 'Slug',
          lastName: 'Audit',
        })
        .expect(201);
      merchant.token = registered.body.data.accessToken;
    }

    const onboardA = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set(auth(merchantA.token))
      .send({
        businessName: 'Slug Tenant A',
        tenantSlug: tenantSlugA,
        storeName: 'Shop A',
        storeSlug: slugA,
      })
      .expect(201);
    storeAId = onboardA.body.data.store.id;

    const onboardB = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set(auth(merchantB.token))
      .send({
        businessName: 'Slug Tenant B',
        tenantSlug: tenantSlugB,
        storeName: 'Shop B',
        storeSlug: slugB,
      })
      .expect(201);
    storeBId = onboardB.body.data.store.id;
    tenantBId = onboardB.body.data.tenant.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.domain.deleteMany({
        where: { storeId: { in: [storeAId, storeBId].filter(Boolean) } },
      });
    }
    await app?.close();
    await redis?.onModuleDestroy();
  });

  beforeEach(clearDomainCache);

  it('A: platform subdomain resolves to tenant A store', async () => {
    const res = await resolve(`${slugA}.${platformRoot}`).expect(200);
    expect(res.body.data.store.id).toBe(storeAId);
    expect(res.body.data.store.slug).toBe(slugA);
    expect(res.body.data.domainType).toBe(DomainType.SUBDOMAIN);
  });

  it('B: platform subdomain resolves to tenant B store', async () => {
    const res = await resolve(`${slugB}.${platformRoot}`).expect(200);
    expect(res.body.data.store.id).toBe(storeBId);
    expect(res.body.data.store.slug).toBe(slugB);
  });

  describe('C: a second tenant cannot claim an existing store slug', () => {
    it('onboarding returns 409 and writes no tenant', async () => {
      const tenantSlug = `slug-tenant-c-${suffix}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/onboarding/store')
        .set(auth(merchantC.token))
        .send({
          businessName: 'Slug Tenant C',
          tenantSlug,
          storeName: 'Copycat',
          storeSlug: slugA.toUpperCase(),
        })
        .expect(409);
      expect(res.body.error.message).toBe('Store slug is already taken');
      expect(JSON.stringify(res.body)).not.toContain(storeAId);
      expect(
        await prisma.tenant.findUnique({ where: { slug: tenantSlug } }),
      ).toBeNull();
    });

    it('creating a store in another tenant returns 409', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantBId}/stores`)
        .set(auth(merchantB.token))
        .send({ name: 'Copycat', slug: slugA })
        .expect(409);
    });

    it('the database rejects a cross-tenant duplicate slug', async () => {
      await expect(
        prisma.store.create({
          data: { tenantId: tenantBId, name: 'Copycat', slug: slugA },
        }),
      ).rejects.toMatchObject({
        constructor: Prisma.PrismaClientKnownRequestError,
        code: 'P2002',
      });
    });

    it('the platform subdomain still resolves to the original owner', async () => {
      const res = await resolve(`${slugA}.${platformRoot}`).expect(200);
      expect(res.body.data.store.id).toBe(storeAId);
    });

    it('platform control labels cannot become store slugs', async () => {
      for (const slug of ['www', 'api', 'admin', 'merchant']) {
        expect(isReservedStoreSlug(slug)).toBe(true);
        await request(app.getHttpServer())
          .post(`/api/v1/tenants/${tenantBId}/stores`)
          .set(auth(merchantB.token))
          .send({ name: 'Reserved', slug })
          .expect(409);
      }
    });

    it('slugs longer than one DNS label are rejected', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tenants/${tenantBId}/stores`)
        .set(auth(merchantB.token))
        .send({ name: 'Too Long', slug: 'a'.repeat(64) })
        .expect(400);
    });
  });

  it('D: unknown platform subdomain is not found', async () => {
    await resolve(`no-such-store-${suffix}.${platformRoot}`).expect(404);
  });

  it('E: inactive store is not found', async () => {
    await prisma.store.update({
      where: { id: storeBId },
      data: { status: StoreStatus.INACTIVE },
    });
    try {
      await resolve(`${slugB}.${platformRoot}`).expect(404);
    } finally {
      await prisma.store.update({
        where: { id: storeBId },
        data: { status: StoreStatus.ACTIVE },
      });
    }
  });

  it('F: store of an inactive tenant is reported as unavailable', async () => {
    await prisma.tenant.update({
      where: { id: tenantBId },
      data: { status: TenantStatus.SUSPENDED },
    });
    try {
      const res = await resolve(`${slugB}.${platformRoot}`).expect(403);
      expect(res.body.error.code).toBe('STORE_UNAVAILABLE');
    } finally {
      await prisma.tenant.update({
        where: { id: tenantBId },
        data: { status: TenantStatus.ACTIVE },
      });
    }
  });

  it('G: custom domain resolves to its configured store', async () => {
    await prisma.domain.create({
      data: {
        storeId: storeAId,
        hostname: customHost,
        type: DomainType.CUSTOM_DOMAIN,
        status: DomainStatus.ACTIVE,
        verifiedAt: new Date(),
      },
    });
    const res = await resolve(customHost).expect(200);
    expect(res.body.data.store.id).toBe(storeAId);
    expect(res.body.data.domainType).toBe(DomainType.CUSTOM_DOMAIN);

    const byPlatform = await resolve(`${slugB}.${platformRoot}`).expect(200);
    expect(byPlatform.body.data.store.id).toBe(storeBId);
  });

  it('public storefront lookup by slug returns each tenant its own store', async () => {
    const a = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${slugA}`)
      .expect(200);
    const b = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${slugB}`)
      .expect(200);
    expect(a.body.data.name).toBe('Shop A');
    expect(b.body.data.name).toBe('Shop B');
  });
});
