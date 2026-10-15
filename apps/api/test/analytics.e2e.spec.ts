import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { addDays, daysBetween, startOfDayUtc, todayIn } from '../src/modules/analytics/analytics-dates';
import { cleanPath, deviceOf, normalizeSource } from '../src/modules/analytics/analytics-ingest.service';
import { AnalyticsRetentionScheduler } from '../src/modules/analytics/analytics-retention.scheduler';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { activateOnboarded, withPayment } from './support/onboarding';

const PHONE_UA = 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

/**
 * Store analytics: storefront events are recorded without cookies, and the
 * merchant sees sales and visitors per day. Starter gets a 30-day sales
 * overview; Growth and Business see everything.
 */
describe('Store analytics (e2e)', () => {
  jest.setTimeout(120_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const growth = { token: '', storeId: '', slug: `an-growth-${suffix}`, productId: '', methodId: '' };
  const dhaka = { divisionId: '', districtId: '' };
  const starter = { token: '', storeId: '', slug: `an-starter-${suffix}` };
  let seq = 0;

  const http = () => request(app.getHttpServer());
  const auth = (s: { token: string }) => ({ Authorization: `Bearer ${s.token}` });
  const event = (body: Record<string, unknown>, ua = PHONE_UA, slug = growth.slug) =>
    http().post(`/api/v1/public/stores/${slug}/analytics/events`).set('User-Agent', ua).send(body);
  const order = () =>
    http()
      .post(`/api/v1/public/stores/${growth.slug}/checkout`)
      .set('Idempotency-Key', `an-${suffix}-${(seq += 1)}`)
      .send({
        items: [{ productId: growth.productId, quantity: 2 }],
        customer: { name: 'Shopper', phone: '01711000000' },
        shippingAddress: { name: 'Shopper', phone: '01711000000', addressLine1: 'House 1', city: 'Dhaka', country: 'BD', ...dhaka },
        billingSameAsShipping: true,
        shippingMethodId: growth.methodId,
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
      })
      .expect((res) => {
        if (res.status !== 201) throw new Error(`checkout ${res.status}: ${JSON.stringify(res.body)}`);
      });

  async function merchant(email: string, plan: string, slug: string) {
    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'SecurePass1', firstName: 'A', lastName: 'N' })
      .expect(201);
    const token = reg.body.data.accessToken as string;
    const res = await http()
      .post('/api/v1/onboarding/store')
      .set({ Authorization: `Bearer ${token}` })
      .send(withPayment({ planSlug: plan, businessName: `Shop ${slug}`, tenantSlug: `${slug}-t`, storeName: 'Shop', storeSlug: slug }))
      .expect(201)
      .then(activateOnboarded(app));
    return { token, storeId: res.body.data.store.id as string };
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
    const redis = app.get(RedisService);
    for (const pattern of ['auth:rl:*', 'rl:*']) {
      const keys = await redis.getClient().keys(pattern);
      if (keys.length > 0) await redis.getClient().del(...keys);
    }
    Object.assign(growth, await merchant(`an.growth.${suffix}@example.com`, 'growth', growth.slug));
    Object.assign(starter, await merchant(`an.starter.${suffix}@example.com`, 'starter', starter.slug));
    growth.productId = (
      await http()
        .post(`/api/v1/stores/${growth.storeId}/products`)
        .set(auth(growth))
        .send({ name: 'Jamdani Saree', slug: `saree-${suffix}`, status: 'ACTIVE', basePrice: '1500.00', trackInventory: false })
        .expect(201)
    ).body.data.id;
    // Growth has delivery zones: ship to Dhaka with the Dhaka City method.
    const district = await prisma.bdDistrict.findFirstOrThrow({ where: { code: 'DHAKA_DHAKA' } });
    Object.assign(dhaka, { divisionId: district.divisionId, districtId: district.id });
    growth.methodId = (
      await prisma.shippingMethod.findFirstOrThrow({ where: { storeId: growth.storeId, zone: { name: 'Dhaka City' } } })
    ).id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('works out days in the store’s time zone', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(daysBetween('2026-10-01', '2026-10-30')).toBe(30);
    // Midnight in Dhaka (UTC+6) is 18:00 the day before in UTC.
    expect(startOfDayUtc('2026-10-15', 'Asia/Dhaka').toISOString()).toBe('2026-10-14T18:00:00.000Z');
    expect(todayIn('Asia/Dhaka', new Date('2026-10-14T19:00:00Z'))).toBe('2026-10-15');
  });

  it('names traffic sources and devices, and keeps paths short', () => {
    expect(normalizeSource('https://l.facebook.com/l.php?u=x')).toBe('Facebook');
    expect(normalizeSource('fb')).toBe('Facebook');
    expect(normalizeSource('facebook')).toBe('Facebook');
    expect(normalizeSource('YouTube')).toBe('YouTube');
    expect(normalizeSource('www.google.com.bd')).toBe('Google');
    expect(normalizeSource('blog.example.com')).toBe('blog.example.com');
    expect(normalizeSource('')).toBe('Direct');
    expect(deviceOf(PHONE_UA)).toBe('MOBILE');
    expect(deviceOf(DESKTOP_UA)).toBe('DESKTOP');
    expect(cleanPath('/products/x?utm_source=fb#top')).toBe('/products/x');
  });

  it('records storefront events without personal data, and ignores bots and unknown stores', async () => {
    await event({ type: 'PAGE_VIEW', path: '/', source: 'https://m.facebook.com/' }).expect(204);
    await event({ type: 'PRODUCT_VIEW', path: `/products/saree-${suffix}?ref=1`, productId: growth.productId, source: 'facebook.com' }).expect(204);
    await event({ type: 'ADD_TO_CART', path: `/products/saree-${suffix}`, productId: growth.productId }).expect(204);
    await event({ type: 'CHECKOUT_START', path: '/checkout' }).expect(204);
    await event({ type: 'PAGE_VIEW', path: '/' }, DESKTOP_UA).expect(204);
    await event({ type: 'PAGE_VIEW', path: '/categories/sarees' }, DESKTOP_UA).expect(204);
    await event({ type: 'PAGE_VIEW', path: '/' }, BOT_UA).expect(204);
    await event({ type: 'PAGE_VIEW', path: '/' }, PHONE_UA, `no-such-store-${suffix}`).expect(204);
    await event({ type: 'SOMETHING', path: '/' }).expect(400);

    const rows = await prisma.storeAnalyticsEvent.findMany({ where: { storeId: growth.storeId }, orderBy: { id: 'asc' } });
    expect(rows).toHaveLength(6);
    expect(rows[1]).toMatchObject({ type: 'PRODUCT_VIEW', path: `/products/saree-${suffix}`, source: 'Facebook', device: 'MOBILE' });
    expect(rows[0]!.visitorHash).toHaveLength(16);
    expect(new Set(rows.map((r) => r.visitorHash)).size).toBe(2);
    expect(JSON.stringify(rows.map(({ id: _id, ...row }) => row))).not.toContain('127.0.0.1');
  });

  it('reports sales, visitors, products, traffic and the funnel on Growth', async () => {
    await order();
    await order();
    const res = await http().get(`/api/v1/stores/${growth.storeId}/analytics`).set(auth(growth)).expect(200);
    const data = res.body.data;
    expect(data.full).toBe(true);
    expect(data.range.days).toBe(30);
    expect(data.series).toHaveLength(30);
    expect(data.totals).toMatchObject({ orders: 2, itemsSold: 4, visitors: 2, pageViews: 3, conversionRate: 100 });
    expect(data.totals.revenue).toBeGreaterThanOrEqual(6000);
    expect(data.totals.averageOrder).toBe(data.totals.revenue / 2);
    const today = data.series.at(-1);
    expect(today).toMatchObject({ orders: 2, visitors: 2 });
    expect(data.topProducts[0]).toMatchObject({ productId: growth.productId, name: 'Jamdani Saree', quantity: 4, revenue: 6000 });
    expect(data.sources).toEqual(expect.arrayContaining([{ source: 'Facebook', visitors: 1 }, { source: 'Direct', visitors: 2 }]));
    expect(data.pages[0]).toEqual({ path: '/', views: 2 });
    expect(data.devices).toEqual(expect.arrayContaining([{ device: 'MOBILE', visitors: 1 }, { device: 'DESKTOP', visitors: 1 }]));
    expect(data.funnel).toEqual({ visitors: 2, productViews: 1, addToCart: 1, checkout: 1, orders: 2 });
    expect(data.paymentMethods[0]).toMatchObject({ provider: 'COD', orders: 2 });
    expect(data.customers).toEqual({ new: 1, returning: 0 });
    expect(data.orderStatuses.reduce((sum: number, s: { orders: number }) => sum + s.orders, 0)).toBe(2);
    expect(data.previous.orders).toBe(0);
  });

  it('leaves cancelled orders out of sales', async () => {
    await order();
    const latest = await prisma.order.findFirstOrThrow({ where: { storeId: growth.storeId }, orderBy: { createdAt: 'desc' } });
    await prisma.order.update({ where: { id: latest.id }, data: { status: 'CANCELLED' } });
    const data = (await http().get(`/api/v1/stores/${growth.storeId}/analytics`).set(auth(growth)).expect(200)).body.data;
    expect(data.totals.orders).toBe(2);
    expect(data.orderStatuses).toEqual(expect.arrayContaining([{ status: 'CANCELLED', orders: 1 }]));
  });

  it('takes any range up to a year and checks the dates', async () => {
    const today = todayIn('Asia/Dhaka');
    const from = addDays(today, -89);
    const data = (await http().get(`/api/v1/stores/${growth.storeId}/analytics?from=${from}&to=${today}`).set(auth(growth)).expect(200)).body.data;
    expect(data.range).toEqual({ from, to: today, days: 90 });
    expect(data.previousRange).toEqual({ from: addDays(from, -90), to: addDays(from, -1) });
    await http().get(`/api/v1/stores/${growth.storeId}/analytics?from=${today}&to=${from}`).set(auth(growth)).expect(400);
    await http().get(`/api/v1/stores/${growth.storeId}/analytics?from=2024-01-01&to=${today}`).set(auth(growth)).expect(400);
    await http().get(`/api/v1/stores/${growth.storeId}/analytics?from=2026-02-30`).set(auth(growth)).expect(400);
  });

  it('exports daily numbers as CSV', async () => {
    const res = await http().get(`/api/v1/stores/${growth.storeId}/analytics/export`).set(auth(growth)).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(new RegExp(`${growth.slug}-analytics-`));
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('Date,Orders,Sales (BDT),Visitors,Page views');
    expect(lines).toHaveLength(31);
    expect(lines.at(-1)).toMatch(/,2,\d+\.\d{2},2,3$/);
  });

  it('gives Starter a 30-day sales overview only', async () => {
    await event({ type: 'PAGE_VIEW', path: '/' }, PHONE_UA, starter.slug).expect(204);
    const data = (await http().get(`/api/v1/stores/${starter.storeId}/analytics`).set(auth(starter)).expect(200)).body.data;
    expect(data.full).toBe(false);
    expect(data.totals).toMatchObject({ orders: 0, visitors: null, pageViews: null, conversionRate: null });
    expect(data.series[0].visitors).toBeNull();
    expect(data.topProducts).toBeNull();
    expect(data.funnel).toBeNull();
    const today = todayIn('Asia/Dhaka');
    await http().get(`/api/v1/stores/${starter.storeId}/analytics?from=${addDays(today, -6)}`).set(auth(starter)).expect(200);
    const old = await http().get(`/api/v1/stores/${starter.storeId}/analytics?from=${addDays(today, -60)}`).set(auth(starter)).expect(403);
    expect(old.body.error.code).toBe('PLAN_UPGRADE_REQUIRED');
    await http().get(`/api/v1/stores/${starter.storeId}/analytics/export`).set(auth(starter)).expect(403);
  });

  it('only shows a store’s analytics to its team', async () => {
    await http().get(`/api/v1/stores/${growth.storeId}/analytics`).set(auth(starter)).expect(403);
    await http().get(`/api/v1/stores/${growth.storeId}/analytics`).expect(401);
  });

  it('deletes events older than the retention period', async () => {
    const old = await prisma.storeAnalyticsEvent.create({
      data: { storeId: growth.storeId, type: 'PAGE_VIEW', visitorHash: '0123456789abcdef', path: '/', source: 'Direct', device: 'DESKTOP', createdAt: new Date(Date.now() - 500 * 86_400_000) },
    });
    await app.get(AnalyticsRetentionScheduler).runOnce();
    expect(await prisma.storeAnalyticsEvent.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.storeAnalyticsEvent.count({ where: { storeId: growth.storeId } })).toBe(6);
  });
});
