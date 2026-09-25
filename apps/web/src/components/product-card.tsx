import Link from 'next/link';
import type { PublicProductCard } from '@ecomesta/types';
import { formatMoney } from '@/lib/money';

export function ProductCard({
  product,
  storeSlug,
}: {
  product: PublicProductCard;
  storeSlug: string;
}) {
  const href = `/products/${product.slug}?store=${encodeURIComponent(storeSlug)}`;
  const image = product.images[0];

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <Link href={href} className="block aspect-[4/3] bg-[#e8efec]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.alt || product.name}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
            No image
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold text-[var(--color-ink)]">
          <Link href={href} className="hover:text-[var(--color-accent)]">
            {product.name}
          </Link>
        </h3>
        {product.shortDescription ? (
          <p className="line-clamp-2 text-sm text-[var(--color-muted)]">
            {product.shortDescription}
          </p>
        ) : null}
        <div className="mt-auto flex items-baseline gap-2">
          <span className="text-lg font-semibold">
            {formatMoney(product.price, product.currency)}
          </span>
          {product.compareAtPrice ? (
            <span className="text-sm text-[var(--color-muted)] line-through">
              {formatMoney(product.compareAtPrice, product.currency)}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          {product.available ? 'In stock' : 'Unavailable'}
        </p>
      </div>
    </article>
  );
}
