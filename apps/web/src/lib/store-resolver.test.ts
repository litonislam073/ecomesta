// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const headerBag = new Map<string, string>();
const cookieBag = new Map<string, string>();

vi.mock('next/headers', () => ({
  headers: () => ({ get: (name: string) => headerBag.get(name) ?? null }),
  cookies: () => ({
    get: (name: string) =>
      cookieBag.has(name) ? { name, value: cookieBag.get(name)! } : undefined,
  }),
}));

const publicGet = vi.fn();
vi.mock('@/lib/public-api', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/public-api')>('@/lib/public-api');
  return { ...actual, publicGet: (...args: unknown[]) => publicGet(...args) };
});

const {
  readHostResolution,
  resolveCanonicalHostname,
  resolveStoreSlug,
  requirePublicStore,
  storeCanonicalUrl,
  storeMetadataBase,
} = await import('@/lib/store-resolver');

function onHost(storeSlug: string, canonicalHostname: string) {
  headerBag.set('x-ecomesta-store-slug', storeSlug);
  headerBag.set('x-ecomesta-canonical-host', canonicalHostname);
}

describe('store resolution from the request host', () => {
  beforeEach(() => {
    headerBag.clear();
    cookieBag.clear();
    publicGet.mockReset();
    delete process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG;
  });

  it('reads the middleware request headers first', () => {
    onHost('alpha', 'shop.example.com');
    cookieBag.set('ecomesta.storeSlug', 'stale');
    cookieBag.set('ecomesta.canonicalHost', 'stale.example.com');

    expect(readHostResolution()).toEqual({
      storeSlug: 'alpha',
      canonicalHostname: 'shop.example.com',
    });
  });

  it('does not read store cookies itself (the middleware decides, SF-05)', () => {
    cookieBag.set('ecomesta.storeSlug', 'Alpha');
    cookieBag.set('ecomesta.canonicalHost', 'Shop.Example.com');

    expect(readHostResolution()).toBeNull();
  });

  it('ignores a store cookie with no canonical host (a ?store= override)', () => {
    cookieBag.set('ecomesta.storeSlug', 'alpha');
    expect(readHostResolution()).toBeNull();
  });

  it('prefers hostname resolution over the env default', async () => {
    process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG = 'demo';
    onHost('alpha', 'shop.example.com');

    await expect(resolveStoreSlug()).resolves.toBe('alpha');
  });

  it('prefers hostname resolution over ?store= when a canonical host is set', async () => {
    onHost('alpha', 'shop.example.com');
    await expect(resolveStoreSlug({ store: 'Beta' })).resolves.toBe('alpha');
  });

  it('uses a local ?store= selection the middleware forwarded (no canonical host)', async () => {
    headerBag.set('x-ecomesta-store-slug', 'Beta');
    await expect(resolveStoreSlug()).resolves.toBe('beta');
    expect(readHostResolution()).toBeNull();
  });

  it('ignores ?store=, the env default and cookies without a forwarded store (SF-05)', async () => {
    process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG = 'Demo';
    cookieBag.set('ecomesta.storeSlug', 'gamma');
    await expect(resolveStoreSlug({ store: 'Beta' })).resolves.toBeNull();
  });

  it('returns null when nothing identifies a store', async () => {
    await expect(resolveStoreSlug({})).resolves.toBeNull();
  });
});

describe('canonical metadata helpers', () => {
  beforeEach(() => {
    headerBag.clear();
    cookieBag.clear();
    publicGet.mockReset();
    delete process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG;
  });

  it('derives the canonical origin and URLs from the resolved host', () => {
    onHost('alpha', 'shop.example.com');

    expect(resolveCanonicalHostname('alpha')).toBe('shop.example.com');
    expect(storeMetadataBase('alpha')?.toString()).toBe(
      'https://shop.example.com/',
    );
    expect(storeCanonicalUrl('/products/mug', 'alpha')).toBe(
      'https://shop.example.com/products/mug',
    );
  });

  it('emits nothing while previewing another store with ?store=', () => {
    onHost('alpha', 'shop.example.com');

    expect(resolveCanonicalHostname('beta')).toBeNull();
    expect(storeMetadataBase('beta')).toBeUndefined();
    expect(storeCanonicalUrl('/', 'beta')).toBeUndefined();
  });

  it('emits nothing on localhost where no host was resolved', () => {
    expect(resolveCanonicalHostname('alpha')).toBeNull();
    expect(storeCanonicalUrl('/', 'alpha')).toBeUndefined();
  });

  it('returns the canonical hostname alongside the store', async () => {
    onHost('alpha', 'shop.example.com');
    publicGet.mockResolvedValue({
      success: true,
      data: { id: 's1', slug: 'alpha', name: 'Alpha' },
    });

    const result = await requirePublicStore();
    expect(result.storeSlug).toBe('alpha');
    expect(result.canonicalHostname).toBe('shop.example.com');
    expect(publicGet).toHaveBeenCalledWith('/public/stores/alpha', { fresh: true });
  });

  it('answers 404 (notFound) when no store can be resolved', async () => {
    await expect(requirePublicStore({})).rejects.toMatchObject({ digest: 'NEXT_NOT_FOUND' });
  });
});
