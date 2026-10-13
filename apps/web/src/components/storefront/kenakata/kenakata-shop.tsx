import Link from 'next/link';
import type { OffsetPageMeta, PublicCategory, PublicProductCard } from '@ecomesta/types';
import { KenakataProductCard } from './kenakata-product-card';
import { KenakataSortSelect } from './kenakata-sort-select';

export interface KenakataShopFilters {
  q: string;
  category: string;
  sort: string;
  minPrice: string;
  maxPrice: string;
  page: string;
}

export const KENAKATA_SORTS: { value: string; label: string }[] = [
  { value: 'createdAt:desc', label: 'Newest' },
  { value: 'basePrice:asc', label: 'Price: low to high' },
  { value: 'basePrice:desc', label: 'Price: high to low' },
  { value: 'name:asc', label: 'Name: A to Z' },
];

/** `/products` with the current filters, changed by `next` (empty values are dropped). */
export function kenakataShopHref(storeSlug: string, filters: KenakataShopFilters, next: Partial<KenakataShopFilters>): string {
  const merged = { ...filters, ...next };
  const params = new URLSearchParams({ store: storeSlug });
  for (const [key, value] of Object.entries(merged)) {
    if (value && !(key === 'page' && value === '1') && !(key === 'sort' && value === 'createdAt:desc')) params.set(key, value);
  }
  return `/products?${params.toString()}`;
}

/** Which page numbers to show: the first, the last and the ones around the current page. */
function pageList(page: number, total: number): (number | 'gap')[] {
  const wanted = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1]! > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

export function KenakataShop({
  storeSlug,
  title,
  description,
  items,
  meta,
  categories,
  filters,
}: {
  storeSlug: string;
  title: string;
  description?: string | null;
  items: PublicProductCard[];
  meta: OffsetPageMeta;
  categories: PublicCategory[];
  filters: KenakataShopFilters;
}) {
  const href = (next: Partial<KenakataShopFilters>) => kenakataShopHref(storeSlug, filters, next);
  const filtered = Boolean(filters.category || filters.minPrice || filters.maxPrice || filters.q);
  const crumb = 'flex flex-wrap gap-2 text-sm text-[var(--color-muted)]';

  return (
    <div>
      <nav aria-label="Breadcrumb" className={crumb}>
        <Link href={`/?store=${encodeURIComponent(storeSlug)}`} className="hover:underline">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-[var(--color-ink)]">{title}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4 pb-7 pt-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold leading-tight tracking-tight text-[var(--color-ink)]">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-[var(--color-muted)]">{description}</p> : null}
          <p className="pt-1 text-[var(--color-muted)]">
            {filters.q ? `Results for “${filters.q}” · ` : ''}
            {meta.total} {meta.total === 1 ? 'product' : 'products'}
          </p>
        </div>
        <KenakataSortSelect value={filters.sort} options={KENAKATA_SORTS} hrefs={Object.fromEntries(KENAKATA_SORTS.map((s) => [s.value, href({ sort: s.value, page: '1' })]))} />
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <aside aria-label="Filters" className="flex max-w-full flex-1 basis-[240px] flex-col gap-7 lg:max-w-[280px]">
          <nav aria-labelledby="kk-filter-category" className="flex flex-col gap-1">
            <h2 id="kk-filter-category" className="mb-2 font-semibold text-[var(--color-ink)]">
              Category
            </h2>
            {[{ id: 'all', slug: '', name: 'All products' }, ...categories].map((category) => {
              const on = filters.category === category.slug;
              return (
                <Link
                  key={category.id}
                  href={href({ category: category.slug, page: '1' })}
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-h-[36px] items-center gap-3 ${on ? 'font-semibold text-[var(--color-ink)]' : 'text-[var(--color-ink)]/80 hover:text-[var(--color-ink)]'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] ${
                      on ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'
                    }`}
                  >
                    {on ? <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" /> : null}
                  </span>
                  {category.name}
                </Link>
              );
            })}
          </nav>
          <div className="h-px bg-[var(--color-border)]" />
          <form action="/products" method="get" className="flex flex-col gap-3">
            <h2 className="font-semibold text-[var(--color-ink)]">Price (৳)</h2>
            <input type="hidden" name="store" value={storeSlug} />
            {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
            {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
            {filters.sort && filters.sort !== 'createdAt:desc' ? <input type="hidden" name="sort" value={filters.sort} /> : null}
            <div className="flex items-center gap-2">
              <input
                name="minPrice"
                type="number"
                min={0}
                defaultValue={filters.minPrice}
                aria-label="Minimum price"
                placeholder="Min"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--color-border)] px-3"
              />
              <span aria-hidden="true">–</span>
              <input
                name="maxPrice"
                type="number"
                min={0}
                defaultValue={filters.maxPrice}
                aria-label="Maximum price"
                placeholder="Max"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--color-border)] px-3"
              />
            </div>
            <button
              type="submit"
              className="h-11 rounded-full border-[1.5px] border-[var(--color-ink)] font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-white"
            >
              Apply
            </button>
          </form>
          {filtered ? (
            <>
              <div className="h-px bg-[var(--color-border)]" />
              <Link href={`/products?store=${encodeURIComponent(storeSlug)}`} className="flex h-11 items-center self-start text-sm font-semibold text-[var(--color-ink)] underline">
                Clear all filters
              </Link>
            </>
          ) : null}
        </aside>

        <div className="min-w-0 flex-[999_1_600px]">
          {items.length === 0 ? (
            <p className="py-16 text-center text-[var(--color-muted)]">No products match these filters.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
              {items.map((product) => (
                <KenakataProductCard key={product.id} product={product} storeSlug={storeSlug} />
              ))}
            </div>
          )}

          {meta.totalPages > 1 ? (
            <nav aria-label="Pagination" className="flex flex-wrap justify-center gap-2 pt-12">
              {meta.page > 1 ? (
                <Link href={href({ page: String(meta.page - 1) })} className="flex h-11 items-center rounded-xl border border-[var(--color-border)] px-5 font-medium hover:bg-[var(--color-surface)]">
                  ← Previous
                </Link>
              ) : null}
              {pageList(meta.page, meta.totalPages).map((n, i) =>
                n === 'gap' ? (
                  <span key={`gap-${i}`} className="flex h-11 w-8 items-center justify-center text-[var(--color-muted)]">
                    …
                  </span>
                ) : (
                  <Link
                    key={n}
                    href={href({ page: String(n) })}
                    aria-current={n === meta.page ? 'page' : undefined}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                      n === meta.page
                        ? 'bg-[var(--color-ink)] font-semibold text-white'
                        : 'border border-[var(--color-border)] hover:bg-[var(--color-surface)]'
                    }`}
                  >
                    {n}
                  </Link>
                ),
              )}
              {meta.page < meta.totalPages ? (
                <Link href={href({ page: String(meta.page + 1) })} className="flex h-11 items-center rounded-xl border border-[var(--color-border)] px-5 font-medium hover:bg-[var(--color-surface)]">
                  Next →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
