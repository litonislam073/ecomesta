import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  MembershipStatus,
  PaymentStatus,
  StoreRole,
  StoreStatus,
  TenantStatus,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Merchant store settings (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const makeUser = (tag: string) => ({
    email: `settings.${tag}.${suffix}@example.com`,
    password: 'SecurePass1',
    token: '',
    id: '',
  });
  const owner = makeUser('owner');
  const manager = makeUser('manager');
  const staff = makeUser('staff');
  const otherOwner = makeUser('other');

  let storeId = '';
  let tenantId = '';
  let otherStoreId = '';
  const storeSlug = `settings-store-${suffix}`;
  const otherStoreSlug = `settings-other-${suffix}`;
  let productId = '';
  let shippingMethodId = '';

  const stripeSecret = `sk_test_settings_${suffix}`;
  const stripeWebhookSecret = `whsec_settings_${suffix}`;

  const auth = (user: { token: string }) => ({ Authorization: `Bearer ${user.token}` });
  const settingsUrl = (id = storeId) => `/api/v1/stores/${id}/settings`;
  const http = () => request(app.getHttpServer());

  const clearRateLimits = async () => {
    for (const pattern of ['auth:rl:*', 'rl:*', 'storefront:domain:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }
  };

  const latestSettings = async () =>
    (await http().get(settingsUrl()).set(auth(owner)).expect(200)).body.data;

  const placeOrder = async (
    tag: string,
    email: string,
    extra: Record<string, unknown> = {},
    phone: string | null = '+8801711000000',
  ) =>
    http()
      .post(`/api/v1/public/stores/${storeSlug}/checkout`)
      .set('Idempotency-Key', `settings-${tag}-${suffix}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customer: { name: 'Settings Guest', email, ...(phone ? { phone } : {}) },
        shippingAddress: {
          name: 'Settings Guest',
          ...(phone ? { phone } : {}),
          addressLine1: '1 Settings Road',
          city: 'Dhaka',
          country: 'BD',
        },
        billingSameAsShipping: true,
        shippingMethodId,
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
        ...extra,
      });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await clearRateLimits();

    for (const user of [owner, manager, staff, otherOwner]) {
      const registered = await http()
        .post('/api/v1/auth/register')
        .send({
          email: user.email,
          password: user.password,
          firstName: 'Settings',
          lastName: 'Tester',
        })
        .expect(201);
      user.token = registered.body.data.accessToken;
      user.id = registered.body.data.user.id;
    }

    const onboard = await http()
      .post('/api/v1/onboarding/store')
      .set(auth(owner))
      .send({
        businessName: 'Settings Tenant',
        tenantSlug: `settings-tenant-${suffix}`,
        storeName: 'Settings Store',
        storeSlug,
      })
      .expect(201);
    storeId = onboard.body.data.store.id;
    tenantId = onboard.body.data.store.tenantId ?? onboard.body.data.tenant?.id;

    const otherOnboard = await http()
      .post('/api/v1/onboarding/store')
      .set(auth(otherOwner))
      .send({
        businessName: 'Settings Other Tenant',
        tenantSlug: `settings-tenant-b-${suffix}`,
        storeName: 'Settings Other Store',
        storeSlug: otherStoreSlug,
      })
      .expect(201);
    otherStoreId = otherOnboard.body.data.store.id;

    for (const id of [storeId, otherStoreId]) {
      await prisma.store.update({ where: { id }, data: { status: StoreStatus.ACTIVE } });
    }
    if (!tenantId) {
      tenantId = (await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).tenantId;
    }

    for (const [user, role] of [
      [manager, StoreRole.STORE_MANAGER],
      [staff, StoreRole.STORE_STAFF],
    ] as const) {
      await prisma.storeUser.create({
        data: { storeId, userId: user.id, role, status: MembershipStatus.ACTIVE },
      });
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);
      user.token = login.body.data.accessToken;
    }

    const product = await http()
      .post(`/api/v1/stores/${storeId}/products`)
      .set(auth(owner))
      .send({
        name: 'Settings Widget',
        slug: `settings-widget-${suffix}`,
        status: 'ACTIVE',
        productType: 'PHYSICAL',
        basePrice: '500.00',
        trackInventory: true,
        allowBackorder: false,
        sku: `SET-${suffix}`,
      })
      .expect(201);
    productId = product.body.data.id;

    await http()
      .post(`/api/v1/stores/${storeId}/inventory/adjust`)
      .set(auth(owner))
      .send({ productId, quantity: 50, type: 'ADJUSTMENT', note: 'Settings stock' })
      .expect(201);

    const shipping = await http()
      .post(`/api/v1/stores/${storeId}/shipping-methods`)
      .set(auth(owner))
      .send({ name: 'Free Dhaka', type: 'FREE', provider: 'MANUAL', price: '0', active: true })
      .expect(201);
    shippingMethodId = shipping.body.data.id;
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  describe('GET /stores/:storeId/settings', () => {
    it('returns Bangladesh defaults for a new store', async () => {
      const res = await http().get(settingsUrl()).set(auth(owner)).expect(200);
      const data = res.body.data;
      expect(data).toMatchObject({
        storeId,
        name: 'Settings Store',
        slug: storeSlug,
        status: 'ACTIVE',
        currency: 'BDT',
        timezone: 'Asia/Dhaka',
        locale: 'en-BD',
        defaultLanguage: 'en',
        checkoutRequirePhone: false,
        checkoutAllowOrderNotes: true,
        allowCustomerCancellation: false,
        seoIndexingEnabled: true,
        seoKeywords: [],
        permissions: { canEdit: true },
      });
      expect(data.fixed).toMatchObject({
        guestCheckout: true,
        requireEmail: false,
        currencyEditable: false,
        slugEditable: false,
      });
      expect(data).not.toHaveProperty('tenantId');
      expect(data).not.toHaveProperty('ownerId');
    });

    it('rejects unauthenticated access', async () => {
      await http().get(settingsUrl()).expect(401);
      await http().patch(settingsUrl()).send({ name: 'Nope' }).expect(401);
    });

    it('lets staff read but marks settings read-only', async () => {
      const res = await http().get(settingsUrl()).set(auth(staff)).expect(200);
      expect(res.body.data.permissions.canEdit).toBe(false);
    });

    it('blocks cross-tenant reads (IDOR)', async () => {
      await http().get(settingsUrl(otherStoreId)).set(auth(owner)).expect(403);
      await http().get(settingsUrl()).set(auth(otherOwner)).expect(403);
      await http().get(`${settingsUrl(otherStoreId)}/summary`).set(auth(owner)).expect(403);
    });

    it('rejects malformed store ids', async () => {
      await http().get('/api/v1/stores/not-a-uuid/settings').set(auth(owner)).expect(400);
    });
  });

  describe('PATCH /stores/:storeId/settings', () => {
    it('updates general, contact, checkout, order and SEO settings and persists them', async () => {
      const res = await http()
        .patch(settingsUrl())
        .set(auth(owner))
        .send({
          name: 'Settings Store BD',
          description: 'Handmade goods from Dhaka',
          email: 'support@settings.example.com',
          phone: '+880 1711-000000',
          address: 'House 1, Road 2, Dhanmondi, Dhaka',
          defaultLanguage: 'bn',
          checkoutRequirePhone: true,
          checkoutAllowOrderNotes: false,
          allowCustomerCancellation: true,
          seoTitle: 'Handmade goods in Dhaka',
          seoDescription: 'Shop handmade goods from Dhaka with cash on delivery across Bangladesh.',
          seoKeywords: ['handmade', 'dhaka', 'handmade'],
          ogTitle: 'Settings Store BD',
          ogDescription: 'Handmade goods',
          ogImageUrl: 'https://cdn.example.com/og.png',
          seoIndexingEnabled: false,
        })
        .expect(200);

      expect(res.body.data).toMatchObject({
        name: 'Settings Store BD',
        email: 'support@settings.example.com',
        defaultLanguage: 'bn',
        locale: 'bn-BD',
        checkoutRequirePhone: true,
        checkoutAllowOrderNotes: false,
        allowCustomerCancellation: true,
        seoKeywords: ['handmade', 'dhaka'],
        seoIndexingEnabled: false,
        currency: 'BDT',
      });

      const row = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(row.name).toBe('Settings Store BD');
      expect(row.locale).toBe('bn-BD');
      expect(row.phone).toBe('+880 1711-000000');
      expect(row.seoIndexingEnabled).toBe(false);
      expect(row.currency).toBe('BDT');

      const reread = await latestSettings();
      expect(reread.seoTitle).toBe('Handmade goods in Dhaka');
      expect(reread.address).toBe('House 1, Road 2, Dhanmondi, Dhaka');
    });

    it('writes a STORE_SETTINGS_UPDATED audit entry with changed fields only', async () => {
      const log = await prisma.auditLog.findFirstOrThrow({
        where: { storeId, action: 'STORE_SETTINGS_UPDATED' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log.userId).toBe(owner.id);
      expect(log.tenantId).toBe(tenantId);
      const metadata = log.metadata as {
        changedFields: string[];
        groups: string[];
      };
      expect(metadata.changedFields).toEqual(
        expect.arrayContaining(['name', 'email', 'checkoutRequirePhone', 'seoTitle']),
      );
      expect(metadata.groups).toEqual(
        expect.arrayContaining(['general', 'checkout', 'orders', 'seo']),
      );
    });

    it('lets a store manager update settings', async () => {
      const res = await http()
        .patch(settingsUrl())
        .set(auth(manager))
        .send({ description: 'Updated by the manager' })
        .expect(200);
      expect(res.body.data.description).toBe('Updated by the manager');
    });

    it('clears optional fields with empty strings', async () => {
      const res = await http()
        .patch(settingsUrl())
        .set(auth(owner))
        .send({ address: '', ogTitle: '   ' })
        .expect(200);
      expect(res.body.data.address).toBeNull();
      expect(res.body.data.ogTitle).toBeNull();
    });

    it('forbids staff from updating settings', async () => {
      await http()
        .patch(settingsUrl())
        .set(auth(staff))
        .send({ description: 'Staff edit' })
        .expect(403);
      const row = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(row.description).not.toBe('Staff edit');
    });

    it('blocks cross-tenant updates (IDOR)', async () => {
      await http()
        .patch(settingsUrl(otherStoreId))
        .set(auth(owner))
        .send({ name: 'Hijacked' })
        .expect(403);
      const other = await prisma.store.findUniqueOrThrow({ where: { id: otherStoreId } });
      expect(other.name).toBe('Settings Other Store');
    });

    it.each([
      ['tenantId', '00000000-0000-0000-0000-000000000000'],
      ['storeId', '00000000-0000-0000-0000-000000000000'],
      ['ownerId', '00000000-0000-0000-0000-000000000000'],
      ['status', 'SUSPENDED'],
      ['subscriptionId', 'sub_123'],
      ['slug', 'new-slug'],
      ['currency', 'USD'],
      ['timezone', 'UTC'],
      ['createdAt', '2020-01-01T00:00:00.000Z'],
      ['updatedAt', '2020-01-01T00:00:00.000Z'],
      ['passwordHash', 'x'],
      ['unknownField', 'x'],
    ])('rejects the protected/unknown field %s', async (field, value) => {
      await http()
        .patch(settingsUrl())
        .set(auth(owner))
        .send({ description: 'Mass assignment attempt', [field]: value })
        .expect(400);
      const row = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(row.status).toBe(StoreStatus.ACTIVE);
      expect(row.slug).toBe(storeSlug);
      expect(row.currency).toBe('BDT');
      expect(row.description).not.toBe('Mass assignment attempt');
    });

    it.each([
      ['invalid email', { email: 'not-an-email' }],
      ['invalid phone', { phone: 'call me' }],
      ['unsupported language', { defaultLanguage: 'fr' }],
      ['empty store name', { name: '' }],
      ['null store name', { name: null }],
      ['markup in store name', { name: '<script>x</script>' }],
      ['markup in SEO title', { seoTitle: 'Great <b>deals</b>' }],
      ['javascript OG image', { ogImageUrl: 'javascript:alert(1)' }],
      ['relative OG image', { ogImageUrl: '/og.png' }],
      ['overlong SEO title', { seoTitle: 'x'.repeat(121) }],
      ['too many keywords', { seoKeywords: Array.from({ length: 21 }, (_, i) => `k${i}`) }],
      ['non-boolean toggle', { checkoutRequirePhone: 'yes' }],
      ['null toggle', { seoIndexingEnabled: null }],
    ])('rejects %s', async (_label, body) => {
      await http().patch(settingsUrl()).set(auth(owner)).send(body).expect(400);
    });

    it('rejects stale writes with 409 (optimistic concurrency)', async () => {
      await http()
        .patch(settingsUrl())
        .set(auth(owner))
        .send({ description: 'Stale write', expectedUpdatedAt: '2020-01-01T00:00:00.000Z' })
        .expect(409);

      const current = await latestSettings();
      await http()
        .patch(settingsUrl())
        .set(auth(owner))
        .send({ description: 'Fresh write', expectedUpdatedAt: current.updatedAt })
        .expect(200);
    });

    it('denies access to suspended stores and tenants', async () => {
      await prisma.store.update({ where: { id: storeId }, data: { status: StoreStatus.SUSPENDED } });
      await http().get(settingsUrl()).set(auth(owner)).expect(403);
      await http().patch(settingsUrl()).set(auth(owner)).send({ description: 'x' }).expect(403);
      await prisma.store.update({ where: { id: storeId }, data: { status: StoreStatus.ACTIVE } });

      await prisma.tenant.update({ where: { id: tenantId }, data: { status: TenantStatus.SUSPENDED } });
      await http().get(settingsUrl()).set(auth(owner)).expect(403);
      await http().patch(settingsUrl()).set(auth(manager)).send({ description: 'x' }).expect(403);
      await prisma.tenant.update({ where: { id: tenantId }, data: { status: TenantStatus.ACTIVE } });

      await http().get(settingsUrl()).set(auth(owner)).expect(200);
    });
  });

  describe('summary and secrets', () => {
    it('never returns payment provider secrets', async () => {
      await http()
        .post(`/api/v1/stores/${storeId}/payment-providers`)
        .set(auth(owner))
        .send({
          provider: 'STRIPE',
          enabled: true,
          mode: 'test',
          publicConfig: { label: 'Stripe Checkout' },
          secrets: { secretKey: stripeSecret, webhookSecret: stripeWebhookSecret },
        })
        .expect(201);

      const summary = await http()
        .get(`${settingsUrl()}/summary`)
        .set(auth(staff))
        .expect(200);
      expect(summary.body.data.payments.offlineMethods).toEqual(
        expect.arrayContaining(['COD']),
      );
      expect(summary.body.data.payments.onlineProviders).toEqual(
        expect.arrayContaining([{ provider: 'STRIPE', mode: 'test' }]),
      );
      expect(summary.body.data.shipping.activeMethodCount).toBeGreaterThanOrEqual(1);

      const settings = await http().get(settingsUrl()).set(auth(owner)).expect(200);
      const publicStore = await http().get(`/api/v1/public/stores/${storeSlug}`).expect(200);

      for (const body of [summary.body, settings.body, publicStore.body]) {
        const json = JSON.stringify(body);
        expect(json).not.toContain(stripeSecret);
        expect(json).not.toContain(stripeWebhookSecret);
        expect(json).not.toMatch(/secretKey|webhookSecret|storePassword|encrypted|verificationToken/i);
      }

      const audit = await prisma.auditLog.findMany({ where: { storeId } });
      const auditJson = JSON.stringify(audit.map((a) => a.metadata));
      expect(auditJson).not.toContain(stripeSecret);
      expect(auditJson).not.toContain(stripeWebhookSecret);
    });
  });

  describe('public cache invalidation', () => {
    const platformRoot = process.env.PLATFORM_ROOT_DOMAIN ?? 'ecomesta.local';
    const platformHost = () => `${storeSlug}.${platformRoot}`;
    const cacheKey = () => `storefront:domain:${platformHost()}`;
    const resolve = () =>
      http()
        .get(`/api/v1/public/domain/resolve?host=${encodeURIComponent(platformHost())}`)
        .expect(200);

    beforeAll(async () => {
      await clearRateLimits();
    });

    it('drops cached host resolutions on non-name settings changes', async () => {
      await resolve();
      expect(await redis.getClient().exists(cacheKey())).toBe(1);

      await http()
        .patch(settingsUrl())
        .set(auth(owner))
        .send({ seoTitle: 'Fresh cache SEO title' })
        .expect(200);

      expect(await redis.getClient().exists(cacheKey())).toBe(0);
      const publicStore = await http().get(`/api/v1/public/stores/${storeSlug}`).expect(200);
      expect(publicStore.body.data.seo.title).toBe('Fresh cache SEO title');
    });

    it('serves updated description and language on the next resolve', async () => {
      await resolve();
      await http()
        .patch(settingsUrl())
        .set(auth(owner))
        .send({ description: 'Cache refreshed description', defaultLanguage: 'en' })
        .expect(200);

      const resolved = await resolve();
      expect(resolved.body.data.store.description).toBe('Cache refreshed description');
      expect(resolved.body.data.store.locale).toBe('en-BD');
    });

    it('leaves the cache untouched when a save changes nothing', async () => {
      await resolve();
      const current = await latestSettings();
      await http()
        .patch(settingsUrl())
        .set(auth(owner))
        .send({ seoTitle: current.seoTitle })
        .expect(200);
      expect(await redis.getClient().exists(cacheKey())).toBe(1);

      await http()
        .patch(settingsUrl())
        .set(auth(owner))
        .send({ defaultLanguage: 'bn', seoTitle: 'Handmade goods in Dhaka' })
        .expect(200);
    });
  });

  describe('public storefront effects', () => {
    beforeAll(async () => {
      await clearRateLimits();
    });

    it('exposes contact, language, checkout rules and SEO on the public store', async () => {
      const res = await http().get(`/api/v1/public/stores/${storeSlug}`).expect(200);
      const store = res.body.data;
      expect(store.language).toBe('bn');
      expect(store.contact.email).toBe('support@settings.example.com');
      expect(store.checkout).toEqual({
        requireEmail: false,
        requirePhone: true,
        allowOrderNotes: false,
      });
      expect(store.allowCustomerCancellation).toBe(true);
      expect(store.seo).toMatchObject({
        title: 'Handmade goods in Dhaka',
        indexingEnabled: false,
        ogImageUrl: 'https://cdn.example.com/og.png',
      });
      expect(store).not.toHaveProperty('tenantId');
    });

    it('requires a phone number at checkout when the store demands it', async () => {
      const res = await placeOrder('no-phone', `nophone.${suffix}@example.com`, {}, null);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/phone number is required/i);
    });

    it('drops the order note when notes are disabled', async () => {
      const email = `nonote.${suffix}@example.com`;
      const res = await placeOrder('no-note', email, { customerNote: 'Leave at the door' });
      expect(res.status).toBe(201);
      const order = await prisma.order.findFirstOrThrow({
        where: { storeId, publicReference: res.body.data.publicReference },
      });
      expect(order.customerNote).toBeNull();
    });

    it('lets a guest cancel an eligible order with contact proof', async () => {
      const email = `cancel.${suffix}@example.com`;
      const placed = await placeOrder('cancel', email);
      expect(placed.status).toBe(201);
      const ref = placed.body.data.publicReference as string;

      const tracked = await http()
        .get(`/api/v1/public/stores/${storeSlug}/orders/${ref}?email=${encodeURIComponent(email)}`)
        .expect(200);
      expect(tracked.body.data.canCancel).toBe(true);

      await http()
        .post(`/api/v1/public/stores/${storeSlug}/orders/${ref}/cancel`)
        .send({ email: 'wrong@example.com' })
        .expect(404);
      await http()
        .post(`/api/v1/public/stores/${otherStoreSlug}/orders/${ref}/cancel`)
        .send({ email })
        .expect(404);
      await http()
        .post(`/api/v1/public/stores/${storeSlug}/orders/${ref}/cancel`)
        .send({ email, status: 'CANCELLED' })
        .expect(400);

      const before = await prisma.inventoryItem.findFirst({ where: { productId } });
      const cancelled = await http()
        .post(`/api/v1/public/stores/${storeSlug}/orders/${ref}/cancel`)
        .send({ email, reason: 'Ordered by mistake' })
        .expect(200);
      expect(cancelled.body.data.status).toBe('CANCELLED');
      expect(cancelled.body.data.canCancel).toBe(false);
      expect(cancelled.body.data.cancelReason).toBe('Cancelled by customer: Ordered by mistake');

      const after = await prisma.inventoryItem.findFirst({ where: { productId } });
      if (before && after) {
        expect(after.quantity).toBe(before.quantity + 1);
      }

      const order = await prisma.order.findFirstOrThrow({ where: { storeId, publicReference: ref } });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { storeId, action: 'ORDER_CANCELLED', entityId: order.id },
      });
      expect(audit.userId).toBeNull();
      expect((audit.metadata as { source: string }).source).toBe('customer');

      await http()
        .post(`/api/v1/public/stores/${storeSlug}/orders/${ref}/cancel`)
        .send({ email })
        .expect(422);
    });

    it('refuses cancellation for paid orders and when the setting is off', async () => {
      const email = `paid.${suffix}@example.com`;
      const placed = await placeOrder('paid', email);
      const ref = placed.body.data.publicReference as string;
      await prisma.order.updateMany({
        where: { storeId, publicReference: ref },
        data: { paymentStatus: PaymentStatus.PAID },
      });
      await http()
        .post(`/api/v1/public/stores/${storeSlug}/orders/${ref}/cancel`)
        .send({ email })
        .expect(422);

      const email2 = `off.${suffix}@example.com`;
      const placed2 = await placeOrder('off', email2);
      const ref2 = placed2.body.data.publicReference as string;
      await http()
        .patch(settingsUrl())
        .set(auth(owner))
        .send({ allowCustomerCancellation: false })
        .expect(200);
      const tracked = await http()
        .get(`/api/v1/public/stores/${storeSlug}/orders/${ref2}?email=${encodeURIComponent(email2)}`)
        .expect(200);
      expect(tracked.body.data.canCancel).toBe(false);
      await http()
        .post(`/api/v1/public/stores/${storeSlug}/orders/${ref2}/cancel`)
        .send({ email: email2 })
        .expect(422);
    });

    it('places an order with a phone number and no email, then tracks it by phone', async () => {
      const res = await http()
        .post(`/api/v1/public/stores/${storeSlug}/checkout`)
        .set('Idempotency-Key', `settings-phone-only-${suffix}`)
        .send({
          items: [{ productId, quantity: 1 }],
          customer: { name: 'Phone Only', phone: '01811-222333' },
          shippingAddress: {
            name: 'Phone Only',
            addressLine1: '2 Settings Road',
            city: 'Dhaka',
            country: 'BD',
          },
          billingSameAsShipping: true,
          shippingMethodId,
          paymentProvider: 'COD',
          paymentMethod: 'CASH',
        })
        .expect(201);
      const ref = res.body.data.publicReference as string;
      const order = await prisma.order.findFirstOrThrow({
        where: { storeId, publicReference: ref },
        include: { addresses: true },
      });
      expect(order.addresses.every((a) => a.email === null)).toBe(true);
      expect(order.addresses[0]!.phone).toBe('01811-222333');

      const tracked = await http()
        .get(`/api/v1/public/stores/${storeSlug}/orders/${ref}?phone=${encodeURIComponent('01811222333')}`)
        .expect(200);
      expect(tracked.body.data.publicReference).toBe(ref);
    });

    it('still requires the phone after the old phone toggle is turned off, and allows notes again', async () => {
      await http()
        .patch(settingsUrl())
        .set(auth(owner))
        .send({ checkoutRequirePhone: false, checkoutAllowOrderNotes: true })
        .expect(200);
      const email = `revert.${suffix}@example.com`;
      const noPhone = await placeOrder('revert-nophone', email, {}, null);
      expect(noPhone.status).toBe(400);
      expect(JSON.stringify(noPhone.body)).toMatch(/phone number is required/i);

      const res = await placeOrder('revert', email, { customerNote: 'Ring twice' });
      expect(res.status).toBe(201);
      const order = await prisma.order.findFirstOrThrow({
        where: { storeId, publicReference: res.body.data.publicReference },
      });
      expect(order.customerNote).toBe('Ring twice');
    });
  });
});
