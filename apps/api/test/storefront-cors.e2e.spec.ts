import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DomainStatus, DomainType, StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { configureCors, platformCorsOrigins } from '../src/common/cors/cors.config';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { StoreDomainResolver } from '../src/modules/domains/store-domain.resolver';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

/**
 * QA-001: storefront browsers on `{slug}.{root}` and ACTIVE custom domains
 * must reach their own public store routes; nothing else may gain access.
 */
describe('Storefront CORS (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let resolver: StoreDomainResolver;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const manager = { email: `cors.${suffix}@example.com`, password: 'SecurePass1', token: '', id: '' };
  const storeSlug = `cors-shop-${suffix}`;
  const otherSlug = `cors-other-${suffix}`;
  const suspendedSlug = `cors-susp-${suffix}`;
  const activeCustomHost = `shop-${suffix}.example.org`;
  const pendingCustomHost = `pending-${suffix}.example.org`;
  const storeIds: string[] = [];
  const tenantIds: string[] = [];

  let storeOrigin = '';
  let platformOrigin = '';

  const http = () => request(app.getHttpServer());

  function preflight(path: string, origin: string, method = 'POST') {
    return http()
      .options(path)
      .set('Origin', origin)
      .set('Access-Control-Request-Method', method)
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key');
  }

  async function onboard(slug: string, label: string) {
    const res = await http()
      .post('/api/v1/onboarding/store')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        businessName: `CORS ${label}`,
        tenantSlug: `cors-${label}-${suffix}`,
        storeName: `CORS ${label}`,
        storeSlug: slug,
      })
      .expect(201);
    storeIds.push(res.body.data.store.id);
    tenantIds.push(res.body.data.tenant.id);
    await prisma.store.update({
      where: { id: res.body.data.store.id },
      data: { status: StoreStatus.ACTIVE },
    });
    return res.body.data.store.id as string;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    configureCors(app);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    resolver = app.get(StoreDomainResolver);

    for (const pattern of ['auth:rl:*', 'rl:*', 'storefront:domain:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }

    const registered = await http()
      .post('/api/v1/auth/register')
      .send({ email: manager.email, password: manager.password, firstName: 'Cors', lastName: 'Test' })
      .expect(201);
    manager.token = registered.body.data.accessToken;
    manager.id = registered.body.data.user.id;

    const storeId = await onboard(storeSlug, 'shop');
    await onboard(otherSlug, 'other');
    const suspendedId = await onboard(suspendedSlug, 'susp');
    await prisma.store.update({ where: { id: suspendedId }, data: { status: StoreStatus.SUSPENDED } });

    await prisma.domain.create({
      data: {
        storeId,
        hostname: activeCustomHost,
        type: DomainType.CUSTOM_DOMAIN,
        status: DomainStatus.ACTIVE,
        isPrimary: false,
        verifiedAt: new Date(),
      },
    });
    await prisma.domain.create({
      data: {
        storeId,
        hostname: pendingCustomHost,
        type: DomainType.CUSTOM_DOMAIN,
        status: DomainStatus.PENDING,
        isPrimary: false,
      },
    });

    storeOrigin = `http://${resolver.platformHostnameFor(storeSlug)}:3000`;
    platformOrigin = platformCorsOrigins(app.get(ConfigService))[0] ?? '';
  });

  afterAll(async () => {
    try {
      if (storeIds.length > 0) {
        await prisma.domain.deleteMany({ where: { storeId: { in: storeIds } } });
        await prisma.auditLog.deleteMany({ where: { storeId: { in: storeIds } } });
        await prisma.emailDelivery.deleteMany({ where: { storeId: { in: storeIds } } });
        await prisma.storeUser.deleteMany({ where: { storeId: { in: storeIds } } });
        await prisma.store.deleteMany({ where: { id: { in: storeIds } } });
      }
      if (tenantIds.length > 0) {
        await prisma.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await prisma.auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await prisma.emailDelivery.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await prisma.tenantUser.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      }
      if (manager.id) {
        await prisma.emailDelivery.deleteMany({ where: { userId: manager.id } });
        await prisma.authToken.deleteMany({ where: { userId: manager.id } });
        await prisma.authSession.deleteMany({ where: { userId: manager.id } });
        await prisma.auditLog.deleteMany({ where: { userId: manager.id } });
        await prisma.user.deleteMany({ where: { id: manager.id } });
      }
    } finally {
      await app.close();
    }
  });

  const checkoutPath = () => `/api/v1/public/stores/${storeSlug}/checkout`;

  it('answers a storefront preflight for its own store', async () => {
    const res = await preflight(checkoutPath(), storeOrigin).expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(storeOrigin);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(res.headers['access-control-allow-methods']).toBe('GET,HEAD,POST');
    expect(res.headers['access-control-allow-headers']).toBe('Accept,Content-Type,Idempotency-Key');
    expect(res.headers.vary).toMatch(/Origin/);
  });

  it('adds the CORS header to the actual GET and POST responses', async () => {
    const get = await http()
      .get(`/api/v1/public/stores/${storeSlug}`)
      .set('Origin', storeOrigin)
      .expect(200);
    expect(get.headers['access-control-allow-origin']).toBe(storeOrigin);
    expect(get.headers.vary).toMatch(/Origin/);

    // Validation failure still reaches the browser with CORS headers.
    const post = await http()
      .post(checkoutPath())
      .set('Origin', storeOrigin)
      .set('Idempotency-Key', `cors-${suffix}`)
      .send({})
      .expect(400);
    expect(post.headers['access-control-allow-origin']).toBe(storeOrigin);
  });

  it('allows an ACTIVE custom domain and rejects a PENDING one', async () => {
    const active = await preflight(checkoutPath(), `https://${activeCustomHost}`).expect(204);
    expect(active.headers['access-control-allow-origin']).toBe(`https://${activeCustomHost}`);

    const pending = await preflight(checkoutPath(), `https://${pendingCustomHost}`);
    expect(pending.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not let a store origin call another store', async () => {
    const res = await preflight(`/api/v1/public/stores/${otherSlug}/checkout`, storeOrigin);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects unknown subdomains, suspended stores and unrelated origins', async () => {
    for (const origin of [
      `http://${resolver.platformHostnameFor(`no-such-store-${suffix}`)}:3000`,
      `http://${resolver.platformHostnameFor(suspendedSlug)}:3000`,
      'https://evil.example.com',
      'null',
    ]) {
      const res = await preflight(checkoutPath(), origin);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
    const suspended = await preflight(
      `/api/v1/public/stores/${suspendedSlug}/checkout`,
      `http://${resolver.platformHostnameFor(suspendedSlug)}:3000`,
    );
    expect(suspended.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('never extends storefront origins to authenticated or non-store routes', async () => {
    for (const path of ['/api/v1/stores', '/api/v1/auth/refresh', '/api/v1/admin/stats', '/api/v1/public/plans']) {
      const res = await preflight(path, storeOrigin);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
    const me = await http().get('/api/v1/auth/me').set('Origin', storeOrigin).expect(401);
    expect(me.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('keeps credentialed CORS for platform app origins (regression)', async () => {
    expect(platformOrigin).not.toBe('');
    for (const path of ['/api/v1/auth/refresh', checkoutPath(), '/api/v1/stores']) {
      const res = await preflight(path, platformOrigin).expect(204);
      expect(res.headers['access-control-allow-origin']).toBe(platformOrigin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    }
  });
});
