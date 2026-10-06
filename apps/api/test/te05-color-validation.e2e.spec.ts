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
 * TE-05 / TE-06 API defense: direct writes with an invalid theme color or a
 * font outside the whitelist are rejected with 400 (never silently dropped or
 * replaced) and change neither the draft nor the published theme.
 * Colors: #rgb or #rrggbb, trimmed, stored lowercase.
 * Fonts: exactly one of THEME_FONT_FAMILIES (@ecomesta/utils).
 */
describe('TE-05 / TE-06 theme color and font validation (e2e)', () => {
  jest.setTimeout(180_000);

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const store = { token: '', id: '', slug: `te05-${suffix}` };
  const storeB = { token: '', id: '', slug: `te06-b-${suffix}` };

  const COLOR_FIELDS: Array<[string, string]> = [
    ['branding', 'primaryColor'],
    ['branding', 'secondaryColor'],
    ['branding', 'accentColor'],
    ['branding', 'backgroundColor'],
    ['branding', 'surfaceColor'],
    ['branding', 'textColor'],
    ['branding', 'mutedTextColor'],
    ['announcement', 'backgroundColor'],
    ['announcement', 'textColor'],
  ];
  const INVALID = [
    'a1b2c3',
    '#12zz99',
    '#12',
    '#1234567',
    '#11223344',
    '',
    '   ',
    '#12 34 56',
    'rgb(1, 2, 3)',
    'url(https://evil.example.com/x)',
    'var(--color)',
    '<b>#fff</b>',
    '<script>alert(1)</script>',
    '#fff;background:red',
    `#${'a'.repeat(200)}`,
    123456,
    true,
  ];

  type Store = typeof store;
  const http = () => request(app.getHttpServer());
  const auth = (s: Store = store) => ({ Authorization: `Bearer ${s.token}` });
  const patch = (configuration: Record<string, unknown>, s: Store = store, as: Store = s) =>
    http().patch(`/api/v1/stores/${s.id}/theme`).set(auth(as)).send({ configuration });
  const draft = async (s: Store = store) =>
    (await http().get(`/api/v1/stores/${s.id}/theme`).set(auth(s)).expect(200)).body.data.configuration;
  const publish = (s: Store = store) =>
    http().post(`/api/v1/stores/${s.id}/theme/publish`).set(auth(s)).expect(200);
  const publicTheme = async (s: Store = store) =>
    (await http().get(`/api/v1/public/stores/${s.slug}/theme`).expect(200)).body.data;
  const liveRow = (s: Store = store) =>
    prisma.storeTheme.findFirst({
      where: { storeId: s.id, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true, publishedConfiguration: true },
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

    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email: `te05.${suffix}@example.com`, password: 'SecurePass1', firstName: 'T', lastName: 'E' })
      .expect(201);
    store.token = reg.body.data.accessToken;
    store.id = (
      await http()
        .post('/api/v1/onboarding/store')
        .set(auth())
        .send(withPayment({ businessName: 'TE05', tenantSlug: `${store.slug}-t`, storeName: 'TE05', storeSlug: store.slug }))
        .expect(201).then(activateOnboarded(app))
    ).body.data.store.id;
    await prisma.store.update({ where: { id: store.id }, data: { status: StoreStatus.ACTIVE } });

    const colors = Object.fromEntries(COLOR_FIELDS.map(([, key], i) => [key, `#1${i}2${i}3${i}`]));
    await patch({
      branding: Object.fromEntries(COLOR_FIELDS.filter(([s]) => s === 'branding').map(([, k]) => [k, colors[k]])),
      announcement: { enabled: true, text: 'Hi', backgroundColor: '#101010', textColor: '#efefef' },
    }).expect(200);
    await http().post(`/api/v1/stores/${store.id}/theme/publish`).set(auth()).expect(200);

    const regB = await http()
      .post('/api/v1/auth/register')
      .send({ email: `te06.b.${suffix}@example.com`, password: 'SecurePass1', firstName: 'T', lastName: 'B' })
      .expect(201);
    storeB.token = regB.body.data.accessToken;
    storeB.id = (
      await http()
        .post('/api/v1/onboarding/store')
        .set(auth(storeB))
        .send(withPayment({ businessName: 'TE06 B', tenantSlug: `${storeB.slug}-t`, storeName: 'TE06 B', storeSlug: storeB.slug }))
        .expect(201).then(activateOnboarded(app))
    ).body.data.store.id;
    await prisma.store.update({ where: { id: storeB.id }, data: { status: StoreStatus.ACTIVE } });
    await patch({ typography: { headingFont: 'Georgia', bodyFont: 'Georgia' } }, storeB).expect(200);
    await publish(storeB);
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  it.each(COLOR_FIELDS)('%s.%s: every invalid value → 400, draft and published theme unchanged', async (section, key) => {
    const draftBefore = await draft();
    const liveBefore = await liveRow();
    for (const value of INVALID) {
      const res = await patch({ [section]: { [key]: value } });
      expect({ value, status: res.status }).toEqual({ value, status: 400 });
    }
    expect(await draft()).toEqual(draftBefore);
    expect(await liveRow()).toEqual(liveBefore);
  });

  it.each(COLOR_FIELDS)('%s.%s: valid hex saves (upper → lower, 3-digit, trimmed)', async (section, key) => {
    for (const [value, stored] of [
      ['#A1B2C3', '#a1b2c3'],
      ['#abc', '#abc'],
      ['  #0F0F0F  ', '#0f0f0f'],
    ] as const) {
      await patch({ [section]: { [key]: value } }).expect(200);
      expect((await draft())[section][key]).toBe(stored);
    }
  });

  it('a rejected color in a multi-field request leaves the whole request unapplied', async () => {
    const before = await draft();
    await patch({ hero: { headline: 'Should not land' }, branding: { primaryColor: 'nope' } }).expect(400);
    expect(await draft()).toEqual(before);
  });

  it('null is ignored (no silent removal), consistent with the existing contract', async () => {
    const before = (await draft()).branding.primaryColor;
    await patch({ branding: { primaryColor: null } }).expect(200);
    expect((await draft()).branding.primaryColor).toBe(before);
  });

  // ---------------------------------------------------------------- TE-06 fonts
  const FONT_FIELDS = ['headingFont', 'bodyFont'] as const;
  const FONTS = ['Inter', 'Work Sans', 'IBM Plex Sans', 'Source Sans 3', 'Georgia', 'Fraunces', 'System'];
  const BAD_FONTS: unknown[] = [
    'qwertyuiop',
    '',
    '   ',
    ' Inter ',
    'inter',
    `Inter${'x'.repeat(300)}`,
    '<b>Inter</b>',
    '<script>alert(1)</script>',
    "Inter'; } body { display:none } x{",
    'url(https://evil.example.com/f.woff)',
    'var(--font)',
    'expression(alert(1))',
    "'Inter', system-ui, sans-serif",
    'Roboto',
    'Helvetica Neue',
    'Inter, Georgia',
    42,
    ['Inter'],
  ];

  it.each(FONT_FIELDS)('TE-06 %s: every whitelisted font saves exactly as sent', async (field) => {
    for (const font of FONTS) {
      await patch({ typography: { [field]: font } }).expect(200);
      expect((await draft()).typography[field]).toBe(font);
    }
  });

  it.each(FONT_FIELDS)('TE-06 %s: every unsupported value → 400; draft and published theme unchanged', async (field) => {
    await patch({ typography: { headingFont: 'Fraunces', bodyFont: 'Source Sans 3' } }).expect(200);
    const draftBefore = await draft();
    const liveBefore = await liveRow();
    for (const value of BAD_FONTS) {
      const res = await patch({ typography: { [field]: value } });
      expect({ value, status: res.status }).toEqual({ value, status: 400 });
      expect(res.body.error.message).toMatch(new RegExp(`typography\\.${field} must be one of: Inter, Work Sans`));
    }
    expect(await draft()).toEqual(draftBefore);
    expect(await liveRow()).toEqual(liveBefore);
  });

  it('TE-06: valid changes plus one bad font are rejected as a whole', async () => {
    const before = await draft();
    await patch({
      hero: { headline: 'Must not land' },
      branding: { primaryColor: '#abcdef' },
      typography: { headingFont: 'Georgia', bodyFont: 'Comic Sans MS' },
    }).expect(400);
    expect(await draft()).toEqual(before);
  });

  it('TE-06: a valid font is draft-only until publish, then served publicly', async () => {
    await publish();
    const pubBefore = await publicTheme();
    await patch({ typography: { headingFont: 'Work Sans', bodyFont: 'IBM Plex Sans' } }).expect(200);
    await redis.getClient().del(`storefront:theme:published:${store.id}`);
    expect(await publicTheme()).toEqual(pubBefore);

    await publish();
    const pub = await publicTheme();
    expect(pub.configuration.typography).toMatchObject({ headingFont: 'Work Sans', bodyFont: 'IBM Plex Sans' });
  });

  it('TE-06: stores are isolated — A changes A only; invalid writes and cross-store writes change nothing', async () => {
    const bDraft = await draft(storeB);
    const bLive = await liveRow(storeB);
    await patch({ typography: { headingFont: 'System' } }).expect(200);
    await patch({ typography: { headingFont: 'Not A Font' } }).expect(400);
    await patch({ typography: { headingFont: 'Not A Font' } }, storeB).expect(400);
    // A's manager cannot write B's theme, even with a valid font.
    await patch({ typography: { headingFont: 'Inter' } }, storeB, store).expect(403);
    expect((await draft()).typography.headingFont).toBe('System');
    expect(await draft(storeB)).toEqual(bDraft);
    expect(await liveRow(storeB)).toEqual(bLive);
    expect((await publicTheme(storeB)).configuration.typography).toMatchObject({ headingFont: 'Georgia', bodyFont: 'Georgia' });
  });

  it('TE-06: a font stored before enforcement does not lock the store out; saves and publishes still work', async () => {
    const row = await prisma.storeTheme.findFirstOrThrow({ where: { storeId: storeB.id, isActive: true } });
    const config = row.configuration as Record<string, Record<string, unknown>>;
    await prisma.storeTheme.update({
      where: { id: row.id },
      data: { configuration: { ...config, typography: { ...config.typography, headingFont: 'Legacy Font' } } },
    });
    expect((await draft(storeB)).typography.headingFont).toBe('Legacy Font');
    await patch({ hero: { headline: 'Still editable' } }, storeB).expect(200);
    await publish(storeB);
    // Replacing it goes through the whitelist like any other request.
    await patch({ typography: { headingFont: 'Another Legacy' } }, storeB).expect(400);
    await patch({ typography: { headingFont: 'Inter' } }, storeB).expect(200);
    expect((await draft(storeB)).typography.headingFont).toBe('Inter');
  });
});
