'use client';

import Link from 'next/link';
import type { PublicProductCard } from '@ecomesta/types';
import { productCardPrice } from '@/components/product-card';
import { lineKey, useCart } from '@/lib/cart';
import { formatMoney } from '@/lib/money';
import { withStoreParam } from '@/lib/theme';
import { KIcon } from './icons';
import { KK, kenakataDiscount } from './kenakata-utils';

export function KenakataPhoto({ product, className }: { product: PublicProductCard; className: string }) {
  const image = product.images[0];
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image.url} alt={image.alt || product.name} loading="lazy" className={className} />
  ) : (
    <div className={`${className} flex items-center justify-center bg-[var(--color-surface)] text-[var(--color-muted)]`}>
      <KIcon name="box" className="h-10 w-10" />
    </div>
  );
}

const OUTLINE_BUTTON =
  'flex h-11 w-full items-center justify-center rounded-full border-[1.5px] border-[var(--color-ink)] text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[var(--color-ink)]';

/** Add to cart for a simple product; products with variants open the product page to pick one. */
function CardAction({ product, href, storeSlug }: { product: PublicProductCard; href: string; storeSlug: string }) {
  const { addItem, lines } = useCart();
  if (product.hasVariants && product.available) {
    return (
      <Link href={href} className={OUTLINE_BUTTON}>
        Choose options
      </Link>
    );
  }
  const line = {
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    variantId: null,
    variantName: null,
    sku: product.sku,
    unitPrice: product.price,
    quantity: 1,
    imageUrl: product.images[0]?.url ?? null,
  };
  if (lines.some((l) => lineKey(l) === lineKey(line))) {
    return (
      <Link href={withStoreParam('/cart', storeSlug)} className={`${OUTLINE_BUTTON} bg-[var(--color-ink)] text-white`}>
        View cart
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={!product.available}
      onClick={() => addItem(line)}
      aria-label={`Add ${product.name} to cart`}
      className={OUTLINE_BUTTON}
    >
      {product.available ? 'Add to cart' : 'Out of stock'}
    </button>
  );
}

export function KenakataProductCard({
  product,
  storeSlug,
  badge,
}: {
  product: PublicProductCard;
  storeSlug: string;
  /** Shown when the product has no discount (e.g. "New"). */
  badge?: string;
}) {
  const href = withStoreParam(`/products/${product.slug}`, storeSlug);
  const off = kenakataDiscount(product);
  const price = productCardPrice(product);
  const category = product.categories[0]?.name;
  return (
    <article className="flex min-w-0 flex-col gap-3">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block overflow-hidden rounded-2xl">
        <KenakataPhoto product={product} className="aspect-square w-full object-cover" />
        {off ? (
          <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: KK.sale }}>
            −{off}%
          </span>
        ) : badge ? (
          <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: KK.ink }}>
            {badge}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        {category ? <p className="text-xs text-[var(--color-muted)]">{category}</p> : null}
        <h3 className="font-semibold leading-snug text-[var(--color-ink)]">
          <Link href={href} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="flex flex-wrap items-baseline gap-2">
          {price ? <span className="text-lg font-semibold text-[var(--color-ink)]">{price}</span> : null}
          {off ? (
            <span className="text-sm text-[var(--color-muted)] line-through">{formatMoney(product.compareAtPrice!, product.currency)}</span>
          ) : null}
        </p>
      </div>
      <CardAction product={product} href={href} storeSlug={storeSlug} />
    </article>
  );
}
