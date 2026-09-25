import type { Metadata } from 'next';
import Link from 'next/link';
import type { PublicCategory, PublicProductCard, PublicStore } from '@ecomesta/types';
import { ProductCard } from '@/components/product-card';
import { publicGet } from '@/lib/public-api';
import { requirePublicStore } from '@/lib/store-resolver';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  try {
    const { store } = await requirePublicStore(searchParams);
    return {
      title: store.name,
      description: store.description ?? `Shop ${store.name}`,
      openGraph: {
        title: store.name,
        description: store.description ?? undefined,
        images: store.logoUrl ? [store.logoUrl] : undefined,
      },
    };
  } catch {
    return { title: 'Storefront' };
  }
}

async function loadHome(store: PublicStore) {
  const [products, categories] = await Promise.all([
    publicGet<{
      success: true;
      data: { items: PublicProductCard[] };
    }>(`/public/stores/${store.slug}/products?limit=8&sortBy=createdAt&sortOrder=desc`),
    publicGet<{
      success: true;
      data: { items: PublicCategory[] };
    }>(`/public/stores/${store.slug}/categories?tree=true`),
  ]);
  return { products: products.data.items, categories: categories.data.items };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { store, storeSlug } = await requirePublicStore(searchParams);
  const { products, categories } = await loadHome(store);

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 md:px-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 20% 20%, rgba(15,107,92,0.18), transparent 45%), linear-gradient(135deg, #f7fbf9, #eef4f1)',
          }}
        />
        <div className="relative max-w-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Welcome
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl tracking-tight md:text-5xl">
            {store.name}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-[var(--color-muted)]">
            {store.description ?? 'Browse products and add them to your cart.'}
          </p>
          <Link
            href={`/products?store=${encodeURIComponent(storeSlug)}`}
            className="mt-8 inline-flex rounded-md bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Shop products
          </Link>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Categories</h2>
          <ul className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <li key={cat.id}>
                <Link
                  href={`/categories/${cat.slug}?store=${encodeURIComponent(storeSlug)}`}
                  className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm hover:border-[var(--color-accent)]"
                >
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold">Latest products</h2>
          <Link
            href={`/products?store=${encodeURIComponent(storeSlug)}`}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            View all
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center text-[var(--color-muted)]">
            No products published yet.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} storeSlug={storeSlug} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
