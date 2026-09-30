// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * SF-05: the request hostname decides the store in production. `?store=` only
 * selects a store on local/preview hosts, and a request without a store gets
 * a real 404 instead of a 200 "Store not found" page.
 *
 * Each case runs the real middleware, then resolves the store the way the
 * storefront pages do, using exactly the request headers/cookies the
 * middleware forwards.
 */

const headerBag = new Map<string, string>();
const cookieBag = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: () => ({ get: (name: string) => headerBag.get(name.toLowerCase()) ?? null }),
  cookies: () => ({
    get: (name: string) => (cookieBag.has(name) ? { name, value: cookieBag.get(name)! } : undefined),
  }),
}));

const publicGet = vi.fn();
vi.mock('@/lib/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/public-api')>('@/lib/public-api');
  return { ...actual, publicGet: (...args: unknown[]) => publicGet(...args) };
});

/** What `GET /public/domain/resolve?host=` answers for each hostname. */
const DOMAINS: Record<string, { slug: string; canonical: string } | 'suspended'> = {
  'store-a.ecomesta.com': { slug: 'store-a', canonical: 'store-a.ecomesta.com' },
  'store-b.ecomesta.com': { slug: 'store-b', canonical: 'store-b.ecomesta.com' },
  'shop.store-a.example': { slug: 'store-a', canonical: 'shop.store-a.example' },
  'paused.ecomesta.com': 'suspended',
};

const realFetch = globalThis.fetch;
let middleware: typeof import('@/middleware').middleware;
let resolver: typeof import('@/lib/store-resolver');
let clearHostResolutionCache: () => void;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN = 'ecomesta.com';
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const host = new URL(String(input)).searchParams.get('host') ?? '';
    const hit = DOMAINS[host];
    if (hit === 'suspended') {
      return new Response(JSON.stringify({ success: false, error: { code: 'STORE_UNAVAILABLE' } }), { status: 403 });
    }
    if (!hit) {
      return new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }), { status: 404 });
    }
    return new Response(
      JSON.stringify({ success: true, data: { hostname: host, canonicalHostname: hit.canonical, store: { slug: hit.slug } } }),
      { status: 200 },
    );
  }) as typeof fetch;
  ({ middleware } = await import('@/middleware'));
  resolver = await import('@/lib/store-resolver');
  ({ clearHostResolutionCache } = await import('@/lib/domain-routing'));
});

afterAll(() => {
  globalThis.fetch = realFetch;
  delete process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN;
});

type Outcome =
  | { kind: 'store'; slug: string; canonical: string | null }
  | { kind: 'no-store' }
  | { kind: 'not-found' }
  | { kind: 'suspended' }
  | { kind: 'redirect'; location: string };

/**
 * Runs one request through middleware + page-level resolution. `no-store`
 * means the storefront layout/page has no store: `/` shows the marketing site
 * and every store route answers 404.
 */
async function visit(
  url: string,
  init: { headers?: Record<string, string>; cookies?: Record<string, string> } = {},
): Promise<Outcome> {
  const target = new URL(url);
  const headers = new Headers({ host: target.host, ...init.headers });
  if (init.cookies) {
    headers.set('cookie', Object.entries(init.cookies).map(([k, v]) => `${k}=${v}`).join('; '));
  }
  const response = await middleware(new NextRequest(url, { headers }));

  const location = response.headers.get('location');
  if (location) return { kind: 'redirect', location };

  const rewrite = response.headers.get('x-middleware-rewrite');
  if (rewrite) {
    const path = new URL(rewrite).pathname;
    if (path === '/store-not-found' || path === '/__marketing-unavailable') return { kind: 'not-found' };
    if (path === '/store-unavailable') return { kind: 'suspended' };
  }

  // The request headers the page will see: overrides replace the originals.
  headerBag.clear();
  const overridden = response.headers.get('x-middleware-override-headers');
  if (overridden) {
    for (const name of overridden.split(',')) {
      const value = response.headers.get(`x-middleware-request-${name}`);
      if (value !== null) headerBag.set(name, value);
    }
  } else {
    headers.forEach((value, name) => headerBag.set(name, value));
  }
  cookieBag.clear();
  for (const [name, value] of Object.entries(init.cookies ?? {})) cookieBag.set(name, value);

  const searchParams = Object.fromEntries(target.searchParams.entries());
  const slug = await resolver.resolveStoreSlug(searchParams);
  if (!slug) return { kind: 'no-store' };
  return { kind: 'store', slug, canonical: resolver.resolveCanonicalHostname(slug) };
}

const store = (slug: string, canonical: string | null = null): Outcome => ({ kind: 'store', slug, canonical });

describe('SF-05 production hostnames are authoritative', () => {
  beforeEach(() => clearHostResolutionCache());

  it.each([
    ['https://ecomesta.com/'],
    ['https://ecomesta.com/?store=store-a'],
    ['https://ecomesta.com/?store=no-such-store'],
    ['https://ecomesta.com/products/panjabi?store=store-a'],
    ['https://ecomesta.com/categories/saree?store=store-a'],
    ['https://ecomesta.com/checkout?store=store-a'],
    ['https://ecomesta.com/track-order?store=store-a'],
  ])('apex %s never renders a merchant store', async (url) => {
    expect(await visit(url)).toEqual({ kind: 'no-store' });
  });

  it('www redirects to the apex without resolving a store', async () => {
    expect(await visit('https://www.ecomesta.com/products/panjabi?store=store-a')).toEqual({
      kind: 'redirect',
      location: 'https://ecomesta.com/products/panjabi?store=store-a',
    });
  });

  it('a platform subdomain serves its own store', async () => {
    expect(await visit('https://store-a.ecomesta.com/products/panjabi')).toEqual(store('store-a', 'store-a.ecomesta.com'));
    expect(await visit('https://store-a.ecomesta.com/?store=store-a')).toEqual(store('store-a', 'store-a.ecomesta.com'));
  });

  it('a conflicting ?store= on a store host is stripped, never obeyed', async () => {
    expect(await visit('https://store-a.ecomesta.com/products/panjabi?store=store-b')).toEqual({
      kind: 'redirect',
      location: 'https://store-a.ecomesta.com/products/panjabi',
    });
    expect(await visit('https://shop.store-a.example/categories/saree?store=store-b')).toEqual({
      kind: 'redirect',
      location: 'https://shop.store-a.example/categories/saree',
    });
  });

  it('a verified custom domain serves its store with its own canonical host', async () => {
    expect(await visit('https://shop.store-a.example/products/panjabi')).toEqual(store('store-a', 'shop.store-a.example'));
  });

  it.each([
    ['unknown platform subdomain', 'https://nosuch.ecomesta.com/?store=store-a'],
    ['unknown/unverified custom domain', 'https://pending.example/products/panjabi?store=store-a'],
  ])('%s is a 404 and ignores ?store=', async (_label, url) => {
    expect(await visit(url)).toEqual({ kind: 'not-found' });
  });

  it('a suspended store host shows the unavailable page', async () => {
    expect(await visit('https://paused.ecomesta.com/?store=store-a')).toEqual({ kind: 'suspended' });
  });

  it('client-supplied store headers are discarded on production hosts', async () => {
    const spoof = { 'x-ecomesta-store-slug': 'store-b', 'x-ecomesta-canonical-host': 'store-b.ecomesta.com' };
    expect(await visit('https://ecomesta.com/products/panjabi', { headers: spoof })).toEqual({ kind: 'no-store' });
    expect(await visit('https://store-a.ecomesta.com/products/panjabi', { headers: spoof })).toEqual(
      store('store-a', 'store-a.ecomesta.com'),
    );
  });

  it('a store cookie from another visit cannot select a store on the apex', async () => {
    const cookies = { 'ecomesta.storeSlug': 'store-a', 'ecomesta.canonicalHost': 'store-a.ecomesta.com' };
    expect(await visit('https://ecomesta.com/products/panjabi', { cookies })).toEqual({ kind: 'no-store' });
  });

  it('NEXT_PUBLIC_DEFAULT_STORE_SLUG never applies to a production host', async () => {
    process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG = 'store-a';
    try {
      expect(await visit('https://ecomesta.com/products/panjabi')).toEqual({ kind: 'no-store' });
    } finally {
      delete process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG;
    }
  });
});

describe('SF-05 local development keeps ?store=', () => {
  beforeEach(() => clearHostResolutionCache());

  it('localhost root is the marketing site', async () => {
    expect(await visit('http://localhost:3000/')).toEqual({ kind: 'no-store' });
  });

  it('localhost ?store= selects a store (preview: no canonical host)', async () => {
    expect(await visit('http://localhost:3000/?store=Store-A')).toEqual(store('store-a'));
    expect(await visit('http://localhost:3000/products/panjabi?store=store-b')).toEqual(store('store-b'));
  });

  it('localhost ?store= for a store that does not exist still yields that slug (the layout 404s it)', async () => {
    expect(await visit('http://localhost:3000/products/x?store=no-such-store')).toEqual(store('no-such-store'));
  });

  it('localhost store routes keep the store picked earlier via the cookie; the root stays marketing', async () => {
    const cookies = { 'ecomesta.storeSlug': 'store-a' };
    expect(await visit('http://localhost:3000/products/panjabi', { cookies })).toEqual(store('store-a'));
    expect(await visit('http://localhost:3000/', { cookies })).toEqual({ kind: 'no-store' });
  });

  it('localhost falls back to NEXT_PUBLIC_DEFAULT_STORE_SLUG on store routes only', async () => {
    process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG = 'store-b';
    try {
      expect(await visit('http://localhost:3000/products/panjabi')).toEqual(store('store-b'));
      expect(await visit('http://localhost:3000/')).toEqual({ kind: 'no-store' });
    } finally {
      delete process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG;
    }
  });

  it('*.ecomesta.local preview hosts keep the ?store= override', async () => {
    expect(await visit('http://store-a.ecomesta.local/?store=store-b')).toEqual(store('store-b'));
  });
});

describe('SF-05 missing stores are real 404s', () => {
  beforeEach(() => {
    headerBag.clear();
    cookieBag.clear();
    publicGet.mockReset();
  });

  async function thrownDigest(run: () => Promise<unknown>) {
    try {
      await run();
    } catch (err) {
      return (err as { digest?: string }).digest ?? String(err);
    }
    return 'no error';
  }

  it('requirePublicStore raises notFound() when no store was resolved', async () => {
    expect(await thrownDigest(() => resolver.requirePublicStore({ store: 'store-a' }))).toBe('NEXT_NOT_FOUND');
  });

  it('requirePublicStore raises notFound() when the store does not exist', async () => {
    headerBag.set('x-ecomesta-store-slug', 'no-such-store');
    const { PublicApiError } = await import('@/lib/public-api');
    publicGet.mockRejectedValue(new PublicApiError(404, 'NOT_FOUND', 'Store not found'));
    expect(await thrownDigest(() => resolver.requirePublicStore())).toBe('NEXT_NOT_FOUND');
  });

  it('the storefront layout raises notFound() instead of rendering a 200 "Store not found"', async () => {
    const { default: StoreLayout } = await import('@/app/(store)/layout');
    expect(await thrownDigest(() => StoreLayout({ children: null }))).toBe('NEXT_NOT_FOUND');

    headerBag.set('x-ecomesta-store-slug', 'no-such-store');
    const { PublicApiError } = await import('@/lib/public-api');
    publicGet.mockRejectedValue(new PublicApiError(404, 'NOT_FOUND', 'Store not found'));
    expect(await thrownDigest(() => StoreLayout({ children: null }))).toBe('NEXT_NOT_FOUND');
  });
});
