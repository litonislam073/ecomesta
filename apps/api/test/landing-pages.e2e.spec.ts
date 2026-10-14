import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';

/**
 * Landing pages: plan access and limits, templates with demo content, closed
 * content validation, publish / preview / public page, and orders placed from
 * a page remembering it.
 */
describe('Landing pages (e2e)', () => {
  jest.setTimeout(180_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  interface Merchant { email: string; token: string; storeId: string; slug: string; tenantId: string }
  const merchant = (key: string): Merchant => ({ email: `lp.${key}.${suffix}@example.com`, token: '', storeId: '', slug: `lp-${key}-${suffix}`, tenantId: '' });
  const starter = merchant('starter');
  const growth = merchant('growth');
  const biz = merchant('biz');
  const other = merchant('other');

  const server = () => app.getHttpServer();
  const auth = (m: Merchant) => ({ Authorization: `Bearer ${m.token}` });
  const pages = (m: Merchant) => `/api/v1/stores/${m.storeId}/landing-pages`;

  async function setUp(m: Merchant, planSlug: string) {
    const reg = await request(server()).post('/api/v1/auth/register').send({ email: m.email, password: 'SecurePass1', firstName: 'Landing', lastName: 'Test' }).expect(201);
    m.token = reg.body.data.accessToken;
    const res = await request(server())
      .post('/api/v1/onboarding/store')
      .set(auth(m))
      .send(withPayment({ planSlug, businessName: `Landing ${m.slug}`, tenantSlug: m.slug, storeName: 'Landing Store', storeSlug: m.slug }))
      .expect(201)
      .then(activateOnboarded(app));
    m.storeId = res.body.data.store.id;
    m.tenantId = res.body.data.tenant.id;
    await prisma.store.update({ where: { id: m.storeId }, data: { status: StoreStatus.ACTIVE } });
  }

  async function product(m: Merchant, name: string, status = 'ACTIVE') {
    const res = await request(server())
      .post(`/api/v1/stores/${m.storeId}/products`)
      .set(auth(m))
      .send({ name, slug: `${name.toLowerCase().replace(/\W+/g, '-')}-${suffix}`, status, productType: 'PHYSICAL', basePrice: '500.00', compareAtPrice: '650.00', trackInventory: false })
      .expect(201);
    return res.body.data.id as string;
  }

  let honeyId = '';
  let draftProductId = '';
  let otherProductId = '';
  let shippingId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    const redis = app.get(RedisService);
    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }
    await setUp(starter, 'starter');
    await setUp(growth, 'growth');
    await setUp(biz, 'business');
    await setUp(other, 'business');
    honeyId = await product(biz, 'Honey Jar');
    draftProductId = await product(biz, 'Draft Thing', 'DRAFT');
    otherProductId = await product(other, 'Other Shop Item');
    const ship = await request(server())
      .post(`/api/v1/stores/${biz.storeId}/shipping-methods`)
      .set(auth(biz))
      .send({ name: 'Home delivery', type: 'FLAT', price: '60', active: true })
      .expect(201);
    shippingId = ship.body.data.id;
  });

  afterAll(async () => {
    if (prisma) {
      // This run's accounts (LP_CLEANUP_ALL also removes ones an interrupted run left behind).
      const users = await prisma.user.findMany({
        where: process.env.LP_CLEANUP_ALL ? { email: { startsWith: 'lp.', endsWith: '@example.com' } } : { email: { endsWith: `.${suffix}@example.com` } },
        select: { id: true },
      });
      const memberships = await prisma.tenantUser.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { tenantId: true } });
      const tenantIds = memberships.map((m) => m.tenantId);
      const storeIds = (await prisma.store.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true } })).map((s) => s.id);
      await prisma.$transaction(async (tx) => {
        const orders = await tx.order.findMany({ where: { storeId: { in: storeIds } }, select: { id: true } });
        const orderIds = orders.map((o) => o.id);
        await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.orderAddress.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: orderIds } } });
        await tx.customer.deleteMany({ where: { storeId: { in: storeIds } } });
        await tx.landingPage.deleteMany({ where: { storeId: { in: storeIds } } });
        await tx.inventoryMovement.deleteMany({ where: { storeId: { in: storeIds } } });
        await tx.inventoryItem.deleteMany({ where: { storeId: { in: storeIds } } });
        await tx.product.deleteMany({ where: { storeId: { in: storeIds } } });
        await tx.shippingMethod.deleteMany({ where: { storeId: { in: storeIds } } });
        await tx.shippingZone.deleteMany({ where: { storeId: { in: storeIds } } });
        await tx.billingPayment.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.emailDelivery.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
        await tx.storeTheme.deleteMany({ where: { storeId: { in: storeIds } } });
        await tx.store.deleteMany({ where: { id: { in: storeIds } } });
        await tx.tenant.deleteMany({ where: { id: { in: tenantIds } } });
        await tx.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
      });
    }
    await app?.close();
  });

  it('Starter: landing pages are a Growth/Business feature', async () => {
    const list = await request(server()).get(pages(starter)).set(auth(starter)).expect(200);
    expect(list.body.data.usage).toEqual({ allowed: false, max: 0, used: 0 });
    const res = await request(server()).post(pages(starter)).set(auth(starter)).send({ title: 'My offer', template: 'single_product' }).expect(403);
    expect(res.body.error.code).toBe('PLAN_UPGRADE_REQUIRED');
  });

  it('Growth: up to 5 pages, then an upgrade is needed', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await request(server()).post(pages(growth)).set(auth(growth)).send({ title: `Offer ${i}`, template: 'campaign' }).expect(201);
    }
    const list = await request(server()).get(pages(growth)).set(auth(growth)).expect(200);
    expect(list.body.data.usage).toEqual({ allowed: true, max: 5, used: 5 });
    const sixth = await request(server()).post(pages(growth)).set(auth(growth)).send({ title: 'Offer 6', template: 'campaign' }).expect(403);
    expect(sixth.body.error.code).toBe('PLAN_UPGRADE_REQUIRED');
    expect(sixth.body.error.message).toMatch(/up to 5 landing pages/);
  });

  let pageId = '';
  let pageSlug = '';

  it('creates a page with the template demo content and a free address', async () => {
    const res = await request(server()).post(pages(biz)).set(auth(biz)).send({ title: 'Honey Offer!', template: 'food' }).expect(201);
    pageId = res.body.data.id;
    pageSlug = res.body.data.slug;
    expect(pageSlug).toBe('honey-offer');
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.content.productIds).toEqual([]);
    expect(res.body.data.content.sections.map((s: { type: string }) => s.type)).toEqual([
      'hero', 'problem', 'benefits', 'source', 'purity_proof', 'packages', 'usage', 'reviews', 'guarantee', 'faq', 'order', 'footer',
    ]);
    expect(res.body.data.content.sections[0].settings.titleHighlight).toBe('খাঁটি মধু');
    const again = await request(server()).post(pages(biz)).set(auth(biz)).send({ title: 'Honey offer', template: 'story' }).expect(201);
    expect(again.body.data.slug).toBe('honey-offer-2');
    const bangla = await request(server()).post(pages(biz)).set(auth(biz)).send({ title: 'ঈদ অফার', template: 'single_product' }).expect(201);
    expect(bangla.body.data.slug).toBe('page');
    await request(server()).post(pages(biz)).set(auth(biz)).send({ title: 'Bad', template: 'nope' }).expect(400);
  });

  it('validates content against the template and keeps only this store’s products', async () => {
    const detail = (await request(server()).get(`${pages(biz)}/${pageId}`).set(auth(biz)).expect(200)).body.data;
    const content = detail.content;
    content.productIds = [honeyId, otherProductId, 'not-a-uuid'];
    content.colors = { primary: '#123ABC', accent: 'red' };
    content.sections = [
      { type: 'order', enabled: false, settings: { title: 'Order now', buttonLabel: 'Buy', evil: '<script>' } },
      { type: 'hero', enabled: true, settings: { title: 'x'.repeat(500), imageUrl: 'javascript:alert(1)', badge: 'Pure' } },
      { type: 'unknown', enabled: true, settings: {} },
      { type: 'hero', enabled: false, settings: {} },
    ];
    const res = await request(server()).patch(`${pages(biz)}/${pageId}`).set(auth(biz)).send({ content, title: 'Honey offer page' }).expect(200);
    const saved = res.body.data;
    expect(saved.title).toBe('Honey offer page');
    expect(saved.content.productIds).toEqual([honeyId]);
    expect(saved.content.colors).toEqual({ primary: '#123abc', accent: null });
    const types = saved.content.sections.map((s: { type: string }) => s.type);
    expect(types.slice(0, 2)).toEqual(['order', 'hero']);
    expect(types).toHaveLength(12);
    const order = saved.content.sections[0];
    expect(order.enabled).toBe(true);
    expect(order.settings.evil).toBeUndefined();
    expect(order.settings.buttonLabel).toBe('Buy');
    const hero = saved.content.sections[1];
    expect(hero.settings.title).toHaveLength(80);
    expect(hero.settings.imageUrl).toBe('');
    // Sections missing from the save come back hidden with their demo content.
    expect(saved.content.sections.find((s: { type: string }) => s.type === 'faq').enabled).toBe(false);

    await request(server()).patch(`${pages(biz)}/${pageId}`).set(auth(biz)).send({ slug: 'Bad Slug' }).expect(400);
    const taken = await request(server()).patch(`${pages(biz)}/${pageId}`).set(auth(biz)).send({ slug: 'honey-offer-2' }).expect(409);
    expect(taken.body.error.code).toBe('LANDING_PAGE_SLUG_TAKEN');
  });

  it('only the store’s team sees and edits its pages', async () => {
    await request(server()).get(`${pages(other)}/${pageId}`).set(auth(other)).expect(404);
    await request(server()).get(`${pages(biz)}/${pageId}`).set(auth(other)).expect(403);
    await request(server()).patch(`${pages(biz)}/${pageId}`).set(auth(other)).send({ title: 'Mine now' }).expect(403);
  });

  it('a draft is not public; the editor preview shows unsaved content', async () => {
    await request(server()).get(`/api/v1/public/stores/${biz.slug}/landing-pages/${pageSlug}`).expect(404);
    const detail = (await request(server()).get(`${pages(biz)}/${pageId}`).set(auth(biz)).expect(200)).body.data;
    const draft = { ...detail.content, sections: detail.content.sections.map((s: { type: string; settings: Record<string, unknown> }) => (s.type === 'hero' ? { ...s, settings: { ...s.settings, title: 'Unsaved headline' } } : s)) };
    const preview = await request(server()).post(`${pages(biz)}/${pageId}/preview`).set(auth(biz)).send({ content: draft }).expect(201);
    const token = preview.body.data.token;
    const shown = await request(server()).get(`/api/v1/public/stores/${biz.slug}/landing-pages/${pageSlug}?previewToken=${token}`).expect(200);
    expect(shown.body.data.preview).toBe(true);
    expect(shown.body.data.content.sections.find((s: { type: string }) => s.type === 'hero').settings.title).toBe('Unsaved headline');
    expect(shown.body.data.products.map((p: { id: string }) => p.id)).toEqual([honeyId]);
    // The same token keeps its URL; another store's token shows nothing.
    const again = await request(server()).post(`${pages(biz)}/${pageId}/preview`).set(auth(biz)).send({ content: draft, token }).expect(201);
    expect(again.body.data.token).toBe(token);
    await request(server()).get(`/api/v1/public/stores/${other.slug}/landing-pages/${pageSlug}?previewToken=${token}`).expect(404);
  });

  it('publishing needs an active product, then the page is public', async () => {
    const empty = await request(server()).post(pages(biz)).set(auth(biz)).send({ title: 'Empty', template: 'campaign' }).expect(201);
    const refused = await request(server()).post(`${pages(biz)}/${empty.body.data.id}/publish`).set(auth(biz)).expect(422);
    expect(refused.body.error.code).toBe('LANDING_PAGE_NO_PRODUCTS');
    // A draft product does not count.
    const content = { ...empty.body.data.content, productIds: [draftProductId] };
    await request(server()).patch(`${pages(biz)}/${empty.body.data.id}`).set(auth(biz)).send({ content }).expect(200);
    await request(server()).post(`${pages(biz)}/${empty.body.data.id}/publish`).set(auth(biz)).expect(422);

    const res = await request(server()).post(`${pages(biz)}/${pageId}/publish`).set(auth(biz)).expect(201);
    expect(res.body.data.status).toBe('PUBLISHED');
    expect(res.body.data.hasUnpublishedChanges).toBe(false);
    const pub = await request(server()).get(`/api/v1/public/stores/${biz.slug}/landing-pages/${pageSlug}`).expect(200);
    expect(pub.body.data).toMatchObject({ id: pageId, template: 'food', preview: false, currency: expect.any(String) });
    expect(pub.body.data.products[0]).toMatchObject({ id: honeyId, name: 'Honey Jar', price: '500.00', compareAtPrice: '650.00' });

    // Draft edits stay off the live page until published again.
    const detail = (await request(server()).get(`${pages(biz)}/${pageId}`).set(auth(biz)).expect(200)).body.data;
    const changed = { ...detail.content, seo: { ...detail.content.seo, title: 'New SEO title' } };
    const saved = await request(server()).patch(`${pages(biz)}/${pageId}`).set(auth(biz)).send({ content: changed }).expect(200);
    expect(saved.body.data.hasUnpublishedChanges).toBe(true);
    const still = await request(server()).get(`/api/v1/public/stores/${biz.slug}/landing-pages/${pageSlug}`).expect(200);
    expect(still.body.data.content.seo.title).toBeNull();
  });

  it('orders placed from the page remember it (only its own published pages count)', async () => {
    const body = (landingPageId: string) => ({
      items: [{ productId: honeyId, quantity: 2 }],
      customer: { name: 'Landing Buyer', phone: '01711000333' },
      shippingAddress: { name: 'Landing Buyer', phone: '01711000333', addressLine1: 'House 1, Road 2', city: 'Dhaka', country: 'BD' },
      billingSameAsShipping: true,
      shippingMethodId: shippingId,
      paymentProvider: 'COD',
      paymentMethod: 'CASH',
      landingPageId,
    });
    const placed = await request(server()).post(`/api/v1/public/stores/${biz.slug}/checkout`).set('Idempotency-Key', `lp-a-${suffix}`).send(body(pageId)).expect(201);
    const order = await prisma.order.findFirstOrThrow({ where: { publicReference: placed.body.data.publicReference } });
    expect(order.landingPageId).toBe(pageId);

    const otherPage = await request(server()).post(pages(other)).set(auth(other)).send({ title: 'Theirs', template: 'single_product' }).expect(201);
    const foreign = await request(server()).post(`/api/v1/public/stores/${biz.slug}/checkout`).set('Idempotency-Key', `lp-b-${suffix}`).send(body(otherPage.body.data.id)).expect(201);
    const foreignOrder = await prisma.order.findFirstOrThrow({ where: { publicReference: foreign.body.data.publicReference } });
    expect(foreignOrder.landingPageId).toBeNull();

    const list = await request(server()).get(pages(biz)).set(auth(biz)).expect(200);
    expect(list.body.data.items.find((p: { id: string }) => p.id === pageId).orderCount).toBe(1);
  });

  it('a plan without landing pages takes published pages offline', async () => {
    const business = await prisma.subscription.findFirstOrThrow({ where: { tenantId: biz.tenantId } });
    const starterPlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { slug: 'starter' } });
    await prisma.subscription.update({ where: { id: business.id }, data: { planId: starterPlan.id } });
    try {
      await request(server()).get(`/api/v1/public/stores/${biz.slug}/landing-pages/${pageSlug}`).expect(404);
      const refused = await request(server()).post(`${pages(biz)}/${pageId}/publish`).set(auth(biz)).expect(403);
      expect(refused.body.error.code).toBe('PLAN_UPGRADE_REQUIRED');
    } finally {
      await prisma.subscription.update({ where: { id: business.id }, data: { planId: business.planId } });
    }
    await request(server()).get(`/api/v1/public/stores/${biz.slug}/landing-pages/${pageSlug}`).expect(200);
  });

  it('unpublish takes the link offline; delete keeps the orders', async () => {
    await request(server()).post(`${pages(biz)}/${pageId}/unpublish`).set(auth(biz)).expect(201);
    await request(server()).get(`/api/v1/public/stores/${biz.slug}/landing-pages/${pageSlug}`).expect(404);
    await request(server()).delete(`${pages(biz)}/${pageId}`).set(auth(biz)).expect(200);
    await request(server()).get(`${pages(biz)}/${pageId}`).set(auth(biz)).expect(404);
    const orders = await prisma.order.findMany({ where: { storeId: biz.storeId } });
    expect(orders.length).toBeGreaterThanOrEqual(2);
    expect(orders.every((o) => o.landingPageId === null)).toBe(true);
  });
});
