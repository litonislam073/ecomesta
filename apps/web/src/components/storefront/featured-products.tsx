import Link from 'next/link';
import type { PublicProductCard } from '@ecomesta/types';
import { ProductCard } from '@/components/product-card';
import { withStoreParam } from '@/lib/theme';

export function FeaturedProducts({
  products,
  storeSlug,
  title = 'Latest products',
}: {
  products: PublicProductCard[];
  storeSlug: string;
  title?: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <Link
          href={withStoreParam('/products', storeSlug)}
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
  );
}
