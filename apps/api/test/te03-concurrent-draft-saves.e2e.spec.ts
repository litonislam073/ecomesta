import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { MembershipStatus, StoreRole, StoreStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { publishedThemeCacheKey } from '../src/modules/themes/theme-cache';
import { ThemesService } from '../src/modules/themes/themes.service';
import { activateOnboarded, withPayment } from './support/onboarding';

/**
 * TE-03: concurrent draft saves must not lose each other's edits. Requests are
 * issued truly concurrently (Promise.all over HTTP); the first test also holds
 * one save inside its locked transaction until a second save is provably
 * waiting on the same lock.
 */
describe('TE-03 concurrent theme draft saves (e2e)', () => {
  jest.setTimeout(240_000);
  const ROUNDS = 20;

  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let themes: ThemesService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  type Store = { token: string; id: string; slug: string; themes: Record<string, string> };
  const A: Store = { token: '', id: '', slug: `te03-a-${suffix}`, themes: {} };
  const B: Store = { token: '', id: '', slug: `te03-b-${suffix}`, themes: {} };
  let staffToken = '';

  type Config = Record<string, Record<string, unknown> | undefined>;
  type Edit = (round: number) => Config;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const patch = (body: Record<string, unknown>, s: Store = A, token = s.token) =>
    http().patch(`/api/v1/stores/${s.id}/theme`).set(auth(token)).send(body);
  const save = (configuration: Config, s: Store = A, token = s.token) => patch({ configuration }, s, token);
  const publish = (s: Store = A) => http().post(`/api/v1/stores/${s.id}/theme/publish`).set(auth(s.token));
  const draft = async (s: Store = A): Promise<Config> =>
    (await http().get(`/api/v1/stores/${s.id}/theme`).set(auth(s.token)).expect(200)).body.data.configuration;
  const liveRow = (s: Store = A) =>
    prisma.storeTheme.findFirst({
      where: { storeId: s.id, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, publishedAt: true, publishedConfiguration: true },
    });
  const publicTheme = async (s: Store = A) =>
    (await http().get(`/api/v1/public/stores/${s.slug}/theme`).expect(200)).body.data;
  const cache = (s: Store = A) => redis.getClient().get(publishedThemeCacheKey(s.id));

  /** Runs `edits` concurrently for ROUNDS rounds; returns how many rounds kept every edit. */
  async function race(base: Config, edits: Edit[], kept: (d: Config, round: number) => boolean, s: Store = A) {
    let ok = 0;
    for (let round = 0; round < ROUNDS; round += 1) {
      await save(base, s).expect(200);
      const responses = await Promise.all(edits.map((edit) => save(edit(round), s)));
      expect(responses.map((r) => r.status)).toEqual(edits.map(() => 200));
      if (kept(await draft(s), round)) ok += 1;
    }
    return ok;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Several hundred requests from one client: the global per-IP limit is
      // not what this suite exercises.
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
    themes = app.get(ThemesService);

    const keys = await redis.getClient().keys('auth:rl:*');
    if (keys.length > 0) await redis.getClient().del(...keys);

    for (const [key, s] of [['a', A], ['b', B]] as const) {
      const reg = await http()
        .post('/api/v1/auth/register')
        .send({ email: `te03.${key}.${suffix}@example.com`, password: 'SecurePass1', firstName: 'T', lastName: 'E' })
        .expect(201);
      s.token = reg.body.data.accessToken;
      s.id = (
        await http()
          .post('/api/v1/onboarding/store')
          .set(auth(s.token))
          .send(withPayment({ businessName: `TE03 ${key}`, tenantSlug: `${s.slug}-t`, storeName: `TE03 ${key}`, storeSlug: s.slug }))
          .expect(201).then(activateOnboarded(app))
      ).body.data.store.id;
      await prisma.store.update({ where: { id: s.id }, data: { status: StoreStatus.ACTIVE } });
      const list = await http().get(`/api/v1/stores/${s.id}/themes`).set(auth(s.token)).expect(200);
      for (const item of list.body.data.items as Array<{ id: string; slug: string }>) s.themes[item.slug] = item.id;
      // Theme A (default) is live for both stores.
      await patch({ themeId: s.themes.default }, s).expect(200);
      await publish(s).expect(200);
    }

    const staffEmail = `te03.staff.${suffix}@example.com`;
    const staff = await http()
      .post('/api/v1/auth/register')
      .send({ email: staffEmail, password: 'SecurePass1', firstName: 'S', lastName: 'T' })
      .expect(201);
    await prisma.storeUser.create({
      data: { storeId: A.id, userId: staff.body.data.user.id, role: StoreRole.STORE_STAFF, status: MembershipStatus.ACTIVE },
    });
    staffToken = (await http().post('/api/v1/auth/login').send({ email: staffEmail, password: 'SecurePass1' }).expect(200))
      .body.data.accessToken;
  });

  afterAll(async () => {
    await app?.close();
    await redis?.onModuleDestroy();
  });

  afterEach(() => jest.restoreAllMocks());

  it('serialises overlapping saves: the second waits on the lock until the first commits', async () => {
    await save({ hero: { headline: 'Welcome', subheadline: 'Shop online' }, announcement: { text: 'Sale' } }).expect(200);

    const target = themes as unknown as { lockStoreThemes: (...args: unknown[]) => Promise<void> };
    const lock = target.lockStoreThemes.bind(themes);
    const events: string[] = [];
    let calls = 0;
    let releaseFirst!: () => void;
    const secondIsWaiting = new Promise<void>((resolve) => (releaseFirst = resolve));
    jest.spyOn(target, 'lockStoreThemes').mockImplementation(async (...args: unknown[]) => {
      const n = (calls += 1);
      events.push(`lock-requested-${n}`);
      // Give the second lock query time to reach Postgres and block there.
      if (n === 2) setTimeout(releaseFirst, 200);
      await lock(...args);
      events.push(`lock-acquired-${n}`);
      if (n === 1) {
        // Save #1 holds the lock (before reading the draft) until save #2 is waiting.
        await secondIsWaiting;
        events.push('first-released');
      }
    });

    const first = save({ hero: { headline: 'New headline' } });
    const firstDone = first.then((r) => r);
    await new Promise((r) => setTimeout(r, 50));
    const second = save({ announcement: { text: 'Big Sale' } });
    const [r1, r2] = await Promise.all([firstDone, second]);

    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(events).toEqual([
      'lock-requested-1',
      'lock-acquired-1',
      'lock-requested-2',
      'first-released',
      'lock-acquired-2',
    ]);
    const d = await draft();
    expect(d.hero).toMatchObject({ headline: 'New headline', subheadline: 'Shop online' });
    expect(d.announcement).toMatchObject({ text: 'Big Sale' });
    // The second response already reflects the first save.
    expect(r2.body.data.configuration.hero.headline).toBe('New headline');
  });

  it(`Test 1 — hero.headline ‖ announcement.text: ${ROUNDS}/${ROUNDS} keep both`, async () => {
    const ok = await race(
      { hero: { headline: 'base', subheadline: 'keep' }, announcement: { text: 'base' } },
      [(r) => ({ hero: { headline: `H${r}` } }), (r) => ({ announcement: { text: `A${r}` } })],
      (d, r) => d.hero?.headline === `H${r}` && d.hero?.subheadline === 'keep' && d.announcement?.text === `A${r}`,
    );
    expect(ok).toBe(ROUNDS);
  });

  it(`Test 2 — branding.primaryColor ‖ branding.secondaryColor (same section): ${ROUNDS}/${ROUNDS}`, async () => {
    const hex = (r: number, base: number) => `#${(base + r).toString(16).padStart(6, '0')}`;
    const ok = await race(
      { branding: { primaryColor: '#000000', secondaryColor: '#000000', brandName: 'Keep' } },
      [(r) => ({ branding: { primaryColor: hex(r, 0x100000) } }), (r) => ({ branding: { secondaryColor: hex(r, 0x200000) } })],
      (d, r) =>
        d.branding?.primaryColor === hex(r, 0x100000) &&
        d.branding?.secondaryColor === hex(r, 0x200000) &&
        d.branding?.brandName === 'Keep',
    );
    expect(ok).toBe(ROUNDS);
  });

  it(`Test 3 — clear optional URL (TE-02) ‖ unrelated edit: ${ROUNDS}/${ROUNDS}`, async () => {
    const ok = await race(
      { branding: { logoUrl: '/logo.png', faviconUrl: '/fav.ico' }, hero: { headline: 'base', imageUrl: '/hero.jpg' } },
      [() => ({ branding: { logoUrl: '' } }), (r) => ({ hero: { headline: `H${r}` } })],
      (d, r) =>
        d.branding !== undefined &&
        !('logoUrl' in d.branding) &&
        d.branding.faviconUrl === '/fav.ico' &&
        d.hero?.headline === `H${r}` &&
        d.hero?.imageUrl === '/hero.jpg',
    );
    expect(ok).toBe(ROUNDS);
  });

  it(`Test 3b — hero.imageUrl = '' ‖ hero.headline (same section): ${ROUNDS}/${ROUNDS}`, async () => {
    const ok = await race(
      { hero: { headline: 'base', imageUrl: '/hero.jpg', ctaHref: '/keep' } },
      [() => ({ hero: { imageUrl: '' } }), (r) => ({ hero: { headline: `H${r}` } })],
      (d, r) => d.hero !== undefined && !('imageUrl' in d.hero) && d.hero.headline === `H${r}` && d.hero.ctaHref === '/keep',
    );
    expect(ok).toBe(ROUNDS);
  });

  it(`Test 4 — three concurrent saves (hero, announcement, footer): ${ROUNDS}/${ROUNDS}`, async () => {
    const ok = await race(
      { hero: { headline: 'base' }, announcement: { text: 'base' }, footer: { tagline: 'base', copyright: 'keep' } },
      [
        (r) => ({ hero: { headline: `H${r}` } }),
        (r) => ({ announcement: { text: `A${r}` } }),
        (r) => ({ footer: { tagline: `F${r}` } }),
      ],
      (d, r) =>
        d.hero?.headline === `H${r}` &&
        d.announcement?.text === `A${r}` &&
        d.footer?.tagline === `F${r}` &&
        d.footer?.copyright === 'keep',
    );
    expect(ok).toBe(ROUNDS);
  });

  it(`Test 4b — footer.tagline ‖ footer.copyright (same section): ${ROUNDS}/${ROUNDS}`, async () => {
    const ok = await race(
      { footer: { tagline: 'base', copyright: 'base', showPaymentIcons: true } },
      [(r) => ({ footer: { tagline: `T${r}` } }), (r) => ({ footer: { copyright: `C${r}` } })],
      (d, r) => d.footer?.tagline === `T${r}` && d.footer?.copyright === `C${r}` && d.footer?.showPaymentIcons === true,
    );
    expect(ok).toBe(ROUNDS);
  });

  it(`Test 5 — same field: last committed save wins, nothing else changes (${ROUNDS} rounds)`, async () => {
    let lastCommittedWins = 0;
    for (let round = 0; round < ROUNDS; round += 1) {
      await save({ hero: { headline: 'base', subheadline: 'keep' }, announcement: { text: 'keep' } }).expect(200);
      const [ra, rb] = await Promise.all([
        save({ hero: { headline: `Version A ${round}` } }),
        save({ hero: { headline: `Version B ${round}` } }),
      ]);
      expect([ra.status, rb.status]).toEqual([200, 200]);
      const d = await draft();
      expect([`Version A ${round}`, `Version B ${round}`]).toContain(d.hero?.headline);
      expect(d.hero?.subheadline).toBe('keep');
      expect(d.announcement?.text).toBe('keep');
      // The save that committed last saw the other's value and returned the final draft.
      const finals = [ra, rb].filter((r) => r.body.data.configuration.hero.headline === d.hero?.headline);
      if (finals.length === 1) lastCommittedWins += 1;
    }
    expect(lastCommittedWins).toBe(ROUNDS);
  });

  it(`multi-store: concurrent saves on two stores only touch their own store (${ROUNDS} rounds)`, async () => {
    const aLive = await liveRow(A);
    const bLive = await liveRow(B);
    await publicTheme(A);
    await publicTheme(B);
    const [aCache, bCache] = [await cache(A), await cache(B)];
    for (let round = 0; round < ROUNDS; round += 1) {
      const [ra, rb] = await Promise.all([
        save({ hero: { headline: `Store A ${round}` } }, A),
        save({ announcement: { text: `Store B ${round}` } }, B),
      ]);
      expect([ra.status, rb.status]).toEqual([200, 200]);
      const [da, db] = [await draft(A), await draft(B)];
      expect(da.hero?.headline).toBe(`Store A ${round}`);
      expect(db.announcement?.text).toBe(`Store B ${round}`);
      expect(JSON.stringify(da)).not.toContain('Store B');
      expect(JSON.stringify(db)).not.toContain('Store A');
    }
    expect(await liveRow(A)).toEqual(aLive);
    expect(await liveRow(B)).toEqual(bLive);
    expect(await cache(A)).toBe(aCache);
    expect(await cache(B)).toBe(bCache);
  });

  it('draft saves never touch the live theme, its cache or the public API', async () => {
    await publicTheme();
    const live = await liveRow();
    const cached = await cache();
    const pub = await publicTheme();
    await race(
      { hero: { headline: 'base' }, announcement: { text: 'base' } },
      [(r) => ({ hero: { headline: `H${r}` } }), (r) => ({ announcement: { text: `A${r}` } })],
      () => true,
    );
    expect(await liveRow()).toEqual(live);
    expect(await cache()).toBe(cached);
    expect(await publicTheme()).toEqual(pub);
  });

  it('failed concurrent requests (400 / 401 / 403 / expired token) do not corrupt or drop the valid save', async () => {
    const live = await liveRow();
    for (let round = 0; round < 5; round += 1) {
      await save({ hero: { headline: 'base', subheadline: 'keep' }, branding: { primaryColor: '#111111' } }).expect(200);
      const responses = await Promise.all([
        save({ hero: { headline: `Valid ${round}` } }),
        save({ branding: { primaryColor: 'not-a-color' } }),
        save({ hero: { headline: 'no token' } }, A, ''),
        save({ hero: { headline: 'expired' } }, A, 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad'),
        save({ hero: { headline: 'staff' } }, A, staffToken),
        save({ hero: { headline: 'other store' } }, A, B.token),
      ]);
      expect(responses.map((r) => r.status)).toEqual([200, 400, 401, 401, 403, 403]);
      const d = await draft();
      expect(d.hero).toMatchObject({ headline: `Valid ${round}`, subheadline: 'keep' });
      expect(d.branding?.primaryColor).toBe('#111111');
    }
    expect(await liveRow()).toEqual(live);
  });

  it('a save that fails inside the transaction rolls back and releases the lock for the other save', async () => {
    await save({ hero: { headline: 'base', subheadline: 'keep' }, announcement: { text: 'base' } }).expect(200);
    const before = await prisma.storeTheme.findFirst({ where: { storeId: A.id, isActive: true } });

    const target = themes as unknown as { draftOf: (...args: unknown[]) => unknown };
    const original = target.draftOf.bind(themes);
    let failed = false;
    jest.spyOn(target, 'draftOf').mockImplementation((...args: unknown[]) => {
      if (!failed) {
        failed = true;
        throw new Error('simulated database failure while merging');
      }
      return original(...args);
    });

    const [bad, good] = await Promise.all([
      save({ hero: { headline: 'Should roll back' } }),
      new Promise<request.Response>((resolve) =>
        setTimeout(() => resolve(save({ announcement: { text: 'Survives' } })), 30),
      ),
    ]);
    expect(bad.status).toBe(500);
    expect(good.status).toBe(200);
    const d = await draft();
    expect(d.hero).toMatchObject({ headline: 'base', subheadline: 'keep' });
    expect(d.announcement?.text).toBe('Survives');
    const after = await prisma.storeTheme.findFirst({ where: { storeId: A.id, isActive: true } });
    expect(after?.publishedAt).toEqual(before?.publishedAt);
  });

  it(`publish racing a save never drops the save (${ROUNDS} rounds)`, async () => {
    let kept = 0;
    for (let round = 0; round < ROUNDS; round += 1) {
      await save({ hero: { headline: 'base' }, announcement: { text: 'base' } }).expect(200);
      const [s, p] = await Promise.all([save({ announcement: { text: `Saved ${round}` } }), publish()]);
      expect([s.status, p.status]).toEqual([200, 200]);
      if ((await draft()).announcement?.text === `Saved ${round}`) kept += 1;
    }
    expect(kept).toBe(ROUNDS);
  });

  it('ST-002: Theme A live, Theme B selected + concurrent edits stay draft until publish', async () => {
    await patch({ themeId: A.themes.default }).expect(200);
    await save({ hero: { headline: 'Theme A live' } }).expect(200);
    await publish().expect(200);
    await patch({ themeId: A.themes.minimal }).expect(200);

    const results = await Promise.all([
      save({ hero: { headline: 'B headline' } }),
      save({ announcement: { text: 'B announcement', enabled: true } }),
      save({ footer: { tagline: 'B footer' } }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);

    await redis.getClient().del(publishedThemeCacheKey(A.id));
    const before = await publicTheme();
    expect(before.theme.slug).toBe('default');
    expect(before.configuration.hero.headline).toBe('Theme A live');

    const preview = await http().post(`/api/v1/stores/${A.id}/theme/preview`).set(auth(A.token)).expect(200);
    expect(preview.body.data.theme.slug).toBe('minimal');
    expect(preview.body.data.configuration).toMatchObject({
      hero: { headline: 'B headline' },
      announcement: { text: 'B announcement' },
      footer: { tagline: 'B footer' },
    });

    await publish().expect(200);
    const after = await publicTheme();
    expect(after.theme.slug).toBe('minimal');
    expect(after.configuration).toMatchObject({
      hero: { headline: 'B headline' },
      announcement: { text: 'B announcement' },
      footer: { tagline: 'B footer' },
    });
  });

  it('latency: single save vs concurrent pairs (report only, generous bound)', async () => {
    const time = async (fn: () => Promise<unknown>) => {
      const start = process.hrtime.bigint();
      await fn();
      return Number(process.hrtime.bigint() - start) / 1e6;
    };
    const single: number[] = [];
    const pairs: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      single.push(await time(() => save({ hero: { headline: `S${i}` } }).expect(200)));
      pairs.push(await time(() => Promise.all([save({ hero: { headline: `P${i}` } }), save({ announcement: { text: `P${i}` } })])));
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
    // eslint-disable-next-line no-console
    console.log(`TE-03 latency: single save median ${median(single).toFixed(1)} ms, concurrent pair median ${median(pairs).toFixed(1)} ms`);
    expect(median(single)).toBeLessThan(1000);
    expect(median(pairs)).toBeLessThan(2000);
  });
});
