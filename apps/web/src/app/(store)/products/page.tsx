import type { Metadata } from 'next';
import Link from 'next/link';
import type { OffsetPageMeta, PublicCategory, PublicProductCard } from '@ecomesta/types';
import { ProductCard } from '@/components/product-card';
import { publicGet } from '@/lib/public-api';
import { requirePublicStore, storeCanonicalUrl } from '@/lib/store-resolver';
import { NOINDEX, storePageRobots } from '@/lib/store-seo';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  try {
    const { store, storeSlug } = await requirePublicStore(searchParams);
    // Search, filter, sort and page variants are the same listing; only the base is indexable.
    const filtered = Object.keys(searchParams).some((key) => key !== 'store');
    const url = filtered ? undefined : storeCanonicalUrl('/products', storeSlug);
    return {
      title: `Products · ${store.name}`,
      description: `Browse products from ${store.name}`,
      alternates: url ? { canonical: url } : undefined,
      robots: filtered ? { index: false, follow: true } : storePageRobots(store, url),
    };
  } catch {
    return { title: 'Products', robots: NOINDEX };
  }
}

function param(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const raw = searchParams[key];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { store, storeSlug } = await requirePublicStore(searchParams);
  const search = param(searchParams, 'q');
  const categorySlug = param(searchParams, 'category');
  const sort = param(searchParams, 'sort') || 'createdAt:desc';
  const page = param(searchParams, 'page') || '1';
  const [sortBy, sortOrder] = sort.split(':');

  const qs = new URLSearchParams({
    page,
    limit: '12',
    sortBy: sortBy || 'createdAt',
    sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
  });
  if (search) qs.set('search', search);
  if (categorySlug) qs.set('categorySlug', categorySlug);

  const [productsRes, categoriesRes] = await Promise.all([
    publicGet<{
      success: true;
      data: { items: PublicProductCard[]; meta: OffsetPageMeta };
    }>(`/public/stores/${store.slug}/products?${qs}`),
    publicGet<{
      success: true;
      data: { items: PublicCategory[] };
    }>(`/public/stores/${store.slug}/categories`),
  ]);

  const { items, meta } = productsRes.data;
  const categories = categoriesRes.data.items;

  function hrefFor(next: Record<string, string>) {
    const p = new URLSearchParams();
    p.set('store', storeSlug);
    const merged = {
      q: search,
      category: categorySlug,
      sort,
      page,
      ...next,
    };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) p.set(k === 'q' ? 'q' : k, v);
    });
    return `/products?${p.toString()}`;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
          Products
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Browse the {store.name} catalog.
        </p>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input type="hidden" name="store" value={storeSlug} />
        <label className="sr-only" htmlFor="product-search">
          Search products
        </label>
        <input
          id="product-search"
          name="q"
          defaultValue={search}
          placeholder="Search products"
          className="min-w-[12rem] flex-1 rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
        <label className="sr-only" htmlFor="category-filter">
          Category
        </label>
        <select
          id="category-filter"
          name="category"
          defaultValue={categorySlug}
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="sort">
          Sort
        </label>
        <select
          id="sort"
          name="sort"
          defaultValue={sort}
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="createdAt:desc">Newest</option>
          <option value="name:asc">Name A–Z</option>
          <option value="basePrice:asc">Price ↑</option>
          <option value="basePrice:desc">Price ↓</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Apply
        </button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center text-[var(--color-muted)]">
          No products match your filters.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} storeSlug={storeSlug} />
          ))}
        </div>
      )}

      {meta.totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-3" aria-label="Pagination">
          {meta.page > 1 ? (
            <Link
              href={hrefFor({ page: String(meta.page - 1) })}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-sm text-[var(--color-muted)]">
            Page {meta.page} of {meta.totalPages}
          </span>
          {meta.page < meta.totalPages ? (
            <Link
              href={hrefFor({ page: String(meta.page + 1) })}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
