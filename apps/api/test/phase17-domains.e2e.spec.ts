import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  DomainStatus,
  DomainType,
  MembershipStatus,
  StoreRole,
  StoreStatus,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  DOMAIN_DNS_PROVIDER,
  DomainDnsProvider,
} from '../src/modules/domains/domain-dns.provider';
import {
  InvalidHostnameError,
  isReservedHostname,
  normalizeHostname,
  platformSubdomainHostname,
  platformSubdomainSlug,
} from '../src/modules/domains/domain-normalize';
import { activateOnboarded, withPayment } from './support/onboarding';

describe('Phase 17 custom domains (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const platformRoot = process.env.PLATFORM_ROOT_DOMAIN ?? 'ecomesta.local';

  /** Mutable DNS zone backing the injected DomainDnsProvider stub. */
  const txtZone = new Map<string, string[]>();
  const dnsStub: DomainDnsProvider = {
    lookupTxt: async (hostname: string) => txtZone.get(hostname) ?? [],
  };

  const manager = {
    email: `phase17.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const staff = {
    email: `phase17.staff.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };
  const otherManager = {
    email: `phase17.other.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  };

  let storeId = '';
  let otherStoreId = '';
  const storeSlug = `p17-store-${suffix}`;
  const otherStoreSlug = `p17-other-${suffix}`;
  const platformHost = `${storeSlug}.${platformRoot}`;

  const customHost = `shop-${suffix}.example.com`;
  const secondHost = `store-${suffix}.example.net`;
  let platformDomainId = '';
  let customDomainId = '';
  let secondDomainId = '';

  const authManager = () => ({ Authorization: `Bearer ${manager.token}` });
  const authStaff = () => ({ Authorization: `Bearer ${staff.token}` });
  const authOther = () => ({ Authorization: `Bearer ${otherManager.token}` });

  const domainsUrl = (id = storeId) => `/api/v1/stores/${id}/domains`;
  const resolveUrl = (host: string) =>
    `/api/v1/public/domain/resolve?host=${encodeURIComponent(host)}`;

  const clearDomainCache = async () => {
    const keys = await redis.getClient().keys('storefront:domain:*');
    if (keys.length > 0) {
      await redis.getClient().del(...keys);
    }
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DOMAIN_DNS_PROVIDER)
      .useValue(dnsStub)
      .compile();

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

    for (const user of [manager, staff, otherManager]) {
      const registered = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Phase',
          lastName: 'Seventeen',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set(authManager())
      .send(withPayment({
        businessName: 'P17 Tenant',
        tenantSlug: `p17-tenant-${suffix}`,
        storeName: 'P17 Store',
        storeSlug,
      }))
      .expect(201).then(activateOnboarded(app));
    storeId = onboard.body.data.store.id;

    const otherOnboard = await request(app.getHttpServer())
      .post('/api/v1/onboarding/store')
      .set(authOther())
      .send(withPayment({
        businessName: 'P17 Other Tenant',
        tenantSlug: `p17-tenant-b-${suffix}`,
        storeName: 'P17 Other Store',
        storeSlug: otherStoreSlug,
      }))
      .expect(201).then(activateOnboarded(app));
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
    if (prisma) {
      await prisma.domain.deleteMany({
        where: { storeId: { in: [storeId, otherStoreId].filter(Boolean) } },
      });
    }
    await app?.close();
    await redis?.onModuleDestroy();
  });

  describe('normalizeHostname', () => {
    it('strips protocol, path, port, case and trailing dots', () => {
      expect(normalizeHostname('HTTPS://Shop.Example.COM/checkout?a=1#x')).toBe(
        'shop.example.com',
      );
      expect(normalizeHostname('  www.Example.com.  ')).toBe('www.example.com');
      expect(normalizeHostname('example.com:8443')).toBe('example.com');
    });

    it('rejects wildcards, spaces, IPs, credentials and malformed hosts', () => {
      const invalid = [
        '*.example.com',
        'shop .example.com',
        '203.0.113.10',
        '[::1]',
        'user@example.com',
        'no-tld',
        '-lead.example.com',
        'trail-.example.com',
        'exämple.com',
        'example.123',
        `${'a'.repeat(64)}.example.com`,
        '',
        'https://',
      ];
      for (const host of invalid) {
        expect(() => normalizeHostname(host)).toThrow(InvalidHostnameError);
      }
    });

    it('allows loopback hosts only when explicitly permitted', () => {
      expect(() => normalizeHostname('localhost')).toThrow();
      expect(normalizeHostname('localhost:3000', { allowLocal: true })).toBe(
        'localhost',
      );
    });

    it('knows the reserved platform namespace', () => {
      for (const host of [
        'ecomesta.com',
        'www.ecomesta.com',
        'api.ecomesta.com',
        'admin.ecomesta.com',
        'merchant.ecomesta.com',
        'localhost',
        platformRoot,
        `api.${platformRoot}`,
        `anything.${platformRoot}`,
      ]) {
        expect(isReservedHostname(host, platformRoot)).toBe(true);
      }
      expect(isReservedHostname('shop.example.com', platformRoot)).toBe(false);

      expect(platformSubdomainHostname('Acme-Store', platformRoot)).toBe(
        `acme-store.${platformRoot}`,
      );
      expect(platformSubdomainSlug(`acme.${platformRoot}`, platformRoot)).toBe(
        'acme',
      );
      expect(
        platformSubdomainSlug(`deep.acme.${platformRoot}`, platformRoot),
      ).toBeNull();
      expect(platformSubdomainSlug('shop.example.com', platformRoot)).toBeNull();
    });
  });

  it('provisions the platform subdomain idempotently on first list', async () => {
    const first = await request(app.getHttpServer())
      .get(domainsUrl())
      .set(authManager())
      .expect(200);

    expect(first.body.data.items).toHaveLength(1);
    const platform = first.body.data.items[0];
    platformDomainId = platform.id;

    expect(platform.hostname).toBe(platformHost);
    expect(platform.type).toBe(DomainType.SUBDOMAIN);
    expect(platform.status).toBe(DomainStatus.ACTIVE);
    expect(platform.isPrimary).toBe(true);
    expect(platform.verification).toBeNull();
    expect(first.body.data.meta.platformRootDomain).toBe(platformRoot);
    expect(first.body.data.meta.canonicalHostname).toBe(platformHost);

    await request(app.getHttpServer())
      .get(domainsUrl())
      .set(authManager())
      .expect(200);

    const rows = await prisma.domain.findMany({
      where: { storeId, type: DomainType.SUBDOMAIN },
    });
    expect(rows).toHaveLength(1);
  });

  it('rejects reserved and malformed hostnames', async () => {
    for (const hostname of [
      'ecomesta.com',
      'api.ecomesta.com',
      'merchant.ecomesta.com',
      `takeover.${platformRoot}`,
      'localhost',
    ]) {
      const res = await request(app.getHttpServer())
        .post(domainsUrl())
        .set(authManager())
        .send({ hostname })
        .expect(400);
      expect(res.body.success).toBe(false);
    }

    for (const hostname of ['*.example.com', 'not a host', '198.51.100.7']) {
      await request(app.getHttpServer())
        .post(domainsUrl())
        .set(authManager())
        .send({ hostname })
        .expect(400);
    }

    await request(app.getHttpServer())
      .post(domainsUrl())
      .set(authManager())
      .send({})
      .expect(400);
  });

  it('creates a PENDING custom domain with normalised host and DNS challenge', async () => {
    const res = await request(app.getHttpServer())
      .post(domainsUrl())
      .set(authManager())
      .send({ hostname: `HTTPS://${customHost.toUpperCase()}/checkout?x=1` })
      .expect(201);

    const domain = res.body.data;
    customDomainId = domain.id;

    expect(domain.hostname).toBe(customHost);
    expect(domain.type).toBe(DomainType.CUSTOM_DOMAIN);
    expect(domain.status).toBe(DomainStatus.PENDING);
    expect(domain.isPrimary).toBe(false);
    expect(domain.verifiedAt).toBeNull();
    expect(domain.verification.recordType).toBe('TXT');
    expect(domain.verification.recordName).toBe(
      `_ecomesta-verification.${customHost}`,
    );
    expect(domain.verification.recordValue).toMatch(/^eco_[A-Za-z0-9_-]{20,}$/);
    expect(domain.verification.verificationConfigured).toBe(true);
    expect(domain.verificationConfigured).toBe(true);

    const rowAfterCreate = await prisma.domain.findUniqueOrThrow({
      where: { id: customDomainId },
    });
    expect(rowAfterCreate.verificationToken).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(rowAfterCreate.verificationToken).not.toBe(
      domain.verification.recordValue,
    );

    // List never re-exposes the raw secret.
    const listed = await request(app.getHttpServer())
      .get(domainsUrl())
      .set(authManager())
      .expect(200);
    const listedCustom = listed.body.data.items.find(
      (d: { id: string }) => d.id === customDomainId,
    );
    expect(listedCustom.verification.recordValue).toBeNull();
    expect(listedCustom.verificationConfigured).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { storeId, action: 'DOMAIN_CREATED' },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects a hostname already taken by any store', async () => {
    await request(app.getHttpServer())
      .post(domainsUrl())
      .set(authManager())
      .send({ hostname: customHost })
      .expect(409);

    await request(app.getHttpServer())
      .post(domainsUrl(otherStoreId))
      .set(authOther())
      .send({ hostname: customHost })
      .expect(409);
  });

  it('refuses activation before the domain is verified', async () => {
    await request(app.getHttpServer())
      .post(`${domainsUrl()}/${customDomainId}/activate`)
      .set(authManager())
      .expect(422);

    await request(app.getHttpServer())
      .post(`${domainsUrl()}/${customDomainId}/set-primary`)
      .set(authManager())
      .expect(422);
  });

  it('fails verification when the TXT record is missing or wrong', async () => {
    const missing = await request(app.getHttpServer())
      .post(`${domainsUrl()}/${customDomainId}/verify`)
      .set(authManager())
      .expect(422);
    expect(missing.body.error.message).toMatch(/_ecomesta-verification/);

    let row = await prisma.domain.findUniqueOrThrow({
      where: { id: customDomainId },
    });
    expect(row.status).toBe(DomainStatus.FAILED);

    txtZone.set(`_ecomesta-verification.${customHost}`, ['eco_wrong-token']);
    await request(app.getHttpServer())
      .post(`${domainsUrl()}/${customDomainId}/verify`)
      .set(authManager())
      .expect(422);

    row = await prisma.domain.findUniqueOrThrow({ where: { id: customDomainId } });
    expect(row.status).toBe(DomainStatus.FAILED);
    // A failed check keeps the challenge so the merchant can retry.
    expect(row.verificationToken).toBeTruthy();
  });

  it('verifies the domain once the TXT record matches, and is idempotent', async () => {
    const createRaw = await request(app.getHttpServer())
      .post(`${domainsUrl()}/${customDomainId}/regenerate-verification`)
      .set(authManager())
      .expect(200);
    const rawToken = createRaw.body.data.verification.recordValue as string;
    expect(rawToken).toMatch(/^eco_/);

    const row = await prisma.domain.findUniqueOrThrow({
      where: { id: customDomainId },
    });
    expect(row.verificationToken).toMatch(/^sha256:/);
    txtZone.set(`_ecomesta-verification.${customHost}`, [
      'unrelated-record',
      `"${rawToken}"`,
    ]);

    const verified = await request(app.getHttpServer())
      .post(`${domainsUrl()}/${customDomainId}/verify`)
      .set(authManager())
      .expect(200);
    expect(verified.body.data.status).toBe(DomainStatus.VERIFIED);
    expect(verified.body.data.verifiedAt).toBeTruthy();
    expect(verified.body.data.verificationConfigured).toBe(false);

    const cleared = await prisma.domain.findUniqueOrThrow({
      where: { id: customDomainId },
    });
    expect(cleared.verificationToken).toBeNull();

    const again = await request(app.getHttpServer())
      .post(`${domainsUrl()}/${customDomainId}/verify`)
      .set(authManager())
      .expect(200);
    expect(again.body.data.status).toBe(DomainStatus.VERIFIED);

    const audit = await prisma.auditLog.findFirst({
      where: { storeId, action: 'DOMAIN_VERIFIED' },
    });
    expect(audit).not.toBeNull();
  });

  it('activates the domain and clears the challenge token', async () => {
    const activated = await request(app.getHttpServer())
      .post(`${domainsUrl()}/${customDomainId}/activate`)
      .set(authManager())
      .expect(200);

    expect(activated.body.data.status).toBe(DomainStatus.ACTIVE);
    expect(activated.body.data.isPrimary).toBe(false);
    expect(activated.body.data.verification).toBeNull();

    const row = await prisma.domain.findUniqueOrThrow({
      where: { id: customDomainId },
    });
    expect(row.verificationToken).toBeNull();

    // Activation is idempotent.
    await request(app.getHttpServer())
      .post(`${domainsUrl()}/${customDomainId}/activate`)
      .set(authManager())
      .expect(200);

    const audit = await prisma.auditLog.findFirst({
      where: { storeId, action: 'DOMAIN_ACTIVATED' },
    });
    expect(audit).not.toBeNull();
  });

  it('resolves the active custom domain and the platform subdomain publicly', async () => {
    const custom = await request(app.getHttpServer())
      .get(resolveUrl(`HTTPS://${customHost.toUpperCase()}:443/products`))
      .expect(200);

    expect(custom.body.data.hostname).toBe(customHost);
    expect(custom.body.data.domainType).toBe(DomainType.CUSTOM_DOMAIN);
    expect(custom.body.data.isPrimary).toBe(false);
    expect(custom.body.data.store.slug).toBe(storeSlug);
    expect(custom.body.data.store.id).toBe(storeId);
    // Primary is still the platform subdomain, so that is the canonical host.
    expect(custom.body.data.canonicalHostname).toBe(platformHost);

    const platform = await request(app.getHttpServer())
      .get(resolveUrl(platformHost))
      .expect(200);
    expect(platform.body.data.domainType).toBe(DomainType.SUBDOMAIN);
    expect(platform.body.data.isPrimary).toBe(true);
    expect(platform.body.data.store.slug).toBe(storeSlug);

    // The other store's subdomain is provisioned on demand by the resolver.
    const lazy = await request(app.getHttpServer())
      .get(resolveUrl(`${otherStoreSlug}.${platformRoot}`))
      .expect(200);
    expect(lazy.body.data.store.slug).toBe(otherStoreSlug);
    const lazyRows = await prisma.domain.findMany({
      where: { storeId: otherStoreId },
    });
    expect(lazyRows).toHaveLength(1);
    expect(lazyRows[0]?.type).toBe(DomainType.SUBDOMAIN);
  });

  it('reads the Host header when no host query is supplied', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/domain/resolve')
      .set('Host', customHost)
      .expect(200);
    expect(res.body.data.store.slug).toBe(storeSlug);
  });

  it('404s for unknown, reserved and malformed hosts', async () => {
    for (const host of [
      `missing-${suffix}.example.org`,
      'ecomesta.com',
      `api.${platformRoot}`,
      `admin.${platformRoot}`,
      'admin.ecomesta.com',
      'merchant.ecomesta.com',
      `nostore-${suffix}.${platformRoot}`,
      '*.example.com',
    ]) {
      await request(app.getHttpServer()).get(resolveUrl(host)).expect(404);
    }
  });

  it('switches the primary host and updates the canonical hostname', async () => {
    const primary = await request(app.getHttpServer())
      .post(`${domainsUrl()}/${customDomainId}/set-primary`)
      .set(authManager())
      .expect(200);
    expect(primary.body.data.isPrimary).toBe(true);

    const primaries = await prisma.domain.findMany({
      where: { storeId, isPrimary: true },
    });
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.id).toBe(customDomainId);

    const platform = await request(app.getHttpServer())
      .get(resolveUrl(platformHost))
      .expect(200);
    expect(platform.body.data.canonicalHostname).toBe(customHost);

    const list = await request(app.getHttpServer())
      .get(domainsUrl())
      .set(authManager())
      .expect(200);
    expect(list.body.data.meta.canonicalHostname).toBe(customHost);

    const audit = await prisma.auditLog.findFirst({
      where: { storeId, action: 'DOMAIN_PRIMARY_CHANGED' },
    });
    expect(audit).not.toBeNull();
  });

  it('disables a primary custom domain and hands primary back to the subdomain', async () => {
    const created = await request(app.getHttpServer())
      .post(domainsUrl())
      .set(authManager())
      .send({ hostname: secondHost })
      .expect(201);
    secondDomainId = created.body.data.id;

    txtZone.set(`_ecomesta-verification.${secondHost}`, [
      created.body.data.verification.recordValue,
    ]);
    await request(app.getHttpServer())
      .post(`${domainsUrl()}/${secondDomainId}/verify`)
      .set(authManager())
      .expect(200);
    await request(app.getHttpServer())
      .post(`${domainsUrl()}/${secondDomainId}/activate`)
      .set(authManager())
      .expect(200);
    await request(app.getHttpServer())
      .post(`${domainsUrl()}/${secondDomainId}/set-primary`)
      .set(authManager())
      .expect(200);

    const disabled = await request(app.getHttpServer())
      .post(`${domainsUrl()}/${secondDomainId}/disable`)
      .set(authManager())
      .expect(200);
    expect(disabled.body.data.status).toBe(DomainStatus.DISABLED);
    expect(disabled.body.data.isPrimary).toBe(false);

    const platform = await prisma.domain.findUniqueOrThrow({
      where: { id: platformDomainId },
    });
    expect(platform.isPrimary).toBe(true);

    await request(app.getHttpServer()).get(resolveUrl(secondHost)).expect(404);

    // Disabling is idempotent, and disabled hosts cannot be re-verified.
    await request(app.getHttpServer())
      .post(`${domainsUrl()}/${secondDomainId}/disable`)
      .set(authManager())
      .expect(200);
    await request(app.getHttpServer())
      .post(`${domainsUrl()}/${secondDomainId}/verify`)
      .set(authManager())
      .expect(422);

    const audit = await prisma.auditLog.findFirst({
      where: { storeId, action: 'DOMAIN_DISABLED' },
    });
    expect(audit).not.toBeNull();
  });

  it('protects the platform subdomain from disable and delete', async () => {
    await request(app.getHttpServer())
      .post(`${domainsUrl()}/${platformDomainId}/disable`)
      .set(authManager())
      .expect(422);
    await request(app.getHttpServer())
      .delete(`${domainsUrl()}/${platformDomainId}`)
      .set(authManager())
      .expect(422);
  });

  it('deletes a disabled domain and a primary domain with fallback', async () => {
    await request(app.getHttpServer())
      .delete(`${domainsUrl()}/${secondDomainId}`)
      .set(authManager())
      .expect(200);
    expect(
      await prisma.domain.findUnique({ where: { id: secondDomainId } }),
    ).toBeNull();

    // Make the remaining custom domain primary again, then delete it.
    await request(app.getHttpServer())
      .post(`${domainsUrl()}/${customDomainId}/set-primary`)
      .set(authManager())
      .expect(200);

    const removed = await request(app.getHttpServer())
      .delete(`${domainsUrl()}/${customDomainId}`)
      .set(authManager())
      .expect(200);
    expect(removed.body.data.hostname).toBe(customHost);

    const remaining = await prisma.domain.findMany({ where: { storeId } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(platformDomainId);
    expect(remaining[0]?.isPrimary).toBe(true);

    await request(app.getHttpServer()).get(resolveUrl(customHost)).expect(404);
    const platform = await request(app.getHttpServer())
      .get(resolveUrl(platformHost))
      .expect(200);
    expect(platform.body.data.canonicalHostname).toBe(platformHost);

    const audit = await prisma.auditLog.findFirst({
      where: { storeId, action: 'DOMAIN_DELETED' },
    });
    expect(audit).not.toBeNull();
  });

  it('lets staff read but never write domains', async () => {
    await request(app.getHttpServer())
      .get(domainsUrl())
      .set(authStaff())
      .expect(200);
    await request(app.getHttpServer())
      .get(`${domainsUrl()}/${platformDomainId}`)
      .set(authStaff())
      .expect(200);

    await request(app.getHttpServer())
      .post(domainsUrl())
      .set(authStaff())
      .send({ hostname: `staff-${suffix}.example.com` })
      .expect(403);
    for (const action of ['verify', 'activate', 'set-primary', 'disable']) {
      await request(app.getHttpServer())
        .post(`${domainsUrl()}/${platformDomainId}/${action}`)
        .set(authStaff())
        .expect(403);
    }
    await request(app.getHttpServer())
      .delete(`${domainsUrl()}/${platformDomainId}`)
      .set(authStaff())
      .expect(403);

    await request(app.getHttpServer()).get(domainsUrl()).expect(401);
  });

  it('isolates domains across stores and tenants', async () => {
    await request(app.getHttpServer())
      .get(domainsUrl())
      .set(authOther())
      .expect(403);
    await request(app.getHttpServer())
      .get(domainsUrl(otherStoreId))
      .set(authManager())
      .expect(403);
    await request(app.getHttpServer())
      .get(domainsUrl('11111111-1111-4111-8111-111111111111'))
      .set(authManager())
      .expect(404);

    const otherDomain = await prisma.domain.findFirstOrThrow({
      where: { storeId: otherStoreId },
    });
    await request(app.getHttpServer())
      .get(`${domainsUrl()}/${otherDomain.id}`)
      .set(authManager())
      .expect(404);
    await request(app.getHttpServer())
      .post(`${domainsUrl()}/${otherDomain.id}/activate`)
      .set(authManager())
      .expect(404);
  });

  it('stops resolving hosts for a suspended store', async () => {
    await prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.SUSPENDED },
    });
    await clearDomainCache();

    try {
      const resolved = await request(app.getHttpServer()).get(resolveUrl(platformHost)).expect(403);
      expect(resolved.body.error.code).toBe('STORE_UNAVAILABLE');
      await request(app.getHttpServer())
        .get(domainsUrl())
        .set(authManager())
        .expect(403);
    } finally {
      await prisma.store.update({
        where: { id: storeId },
        data: { status: StoreStatus.ACTIVE },
      });
      await clearDomainCache();
    }

    await request(app.getHttpServer()).get(resolveUrl(platformHost)).expect(200);
  });

  it('keeps the slug-based public storefront route working', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/public/stores/${storeSlug}`)
      .expect(200);
    expect(res.body.data.slug).toBe(storeSlug);

    await request(app.getHttpServer())
      .get(`/api/v1/public/stores/missing-${suffix}`)
      .expect(404);
  });
});
