// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Next's data cache only stores 200 responses, so a cached product would
 * outlive its archiving forever. Product and category pages must look their
 * record up uncached and 404 as soon as the API does.
 */

const publicGet = vi.fn();
vi.mock('@/lib/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/public-api')>('@/lib/public-api');
  return { ...actual, publicGet: (...args: unknown[]) => publicGet(...args) };
});
vi.mock('@/lib/store-resolver', () => ({
  requirePublicStore: async () => ({ store: { slug: 'alpha', name: 'Alpha' }, storeSlug: 'alpha', canonicalHostname: null }),
  storeCanonicalUrl: () => undefined,
  storeMetadataBase: () => undefined,
}));
vi.mock('@/lib/theme', () => ({ fetchPublicTheme: async () => ({ configuration: {} }) }));

const { PublicApiError } = await vi.importActual<typeof import('@/lib/public-api')>('@/lib/public-api');

async function digestOf(run: () => Promise<unknown>) {
  try {
    await run();
    return 'rendered';
  } catch (err) {
    return (err as { digest?: string }).digest ?? String(err);
  }
}

describe('storefront detail pages use uncached lookups', () => {
  beforeEach(() => {
    publicGet.mockReset();
    publicGet.mockRejectedValue(new PublicApiError(404, 'NOT_FOUND', 'Product not found'));
  });

  it('product page: uncached lookup, 404 once the product is gone', async () => {
    const { default: ProductDetailPage } = await import('@/app/(store)/products/[productSlug]/page');
    const digest = await digestOf(() => ProductDetailPage({ params: { productSlug: 'old-shirt' }, searchParams: {} }));
    expect(digest).toBe('NEXT_NOT_FOUND');
    expect(publicGet).toHaveBeenCalledWith('/public/stores/alpha/products/old-shirt', { fresh: true });
  });

  it('category page: uncached lookup, 404 once the category is gone', async () => {
    const { default: CategoryPage } = await import('@/app/(store)/categories/[categorySlug]/page');
    const digest = await digestOf(() => CategoryPage({ params: { categorySlug: 'old-shirts' }, searchParams: {} }));
    expect(digest).toBe('NEXT_NOT_FOUND');
    expect(publicGet).toHaveBeenCalledWith('/public/stores/alpha/categories/old-shirts', { fresh: true });
  });
});
