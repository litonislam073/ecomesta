'use client';

import Link from 'next/link';
import type { PublicProductCard } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { useCart } from '@/lib/cart';

/**
 * Card-level add to cart, using the same cart as the product page. Products
 * with variants go to the product page to pick one; unavailable products get
 * a disabled button, as on the product page.
 */
export function ProductCardAction({
  product,
  href,
}: {
  product: PublicProductCard;
  href: string;
}) {
  const { addItem } = useCart();

  if (product.hasVariants && product.available) {
    return (
      <Link
        href={href}
        className="inline-flex w-full items-center justify-center rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        Choose options
      </Link>
    );
  }

  return (
    <Button
      type="button"
      className="w-full"
      disabled={!product.available}
      aria-label={`Add ${product.name} to cart`}
      onClick={() =>
        addItem({
          productId: product.id,
          productSlug: product.slug,
          productName: product.name,
          variantId: null,
          variantName: null,
          sku: product.sku,
          unitPrice: product.price,
          quantity: 1,
          imageUrl: product.images[0]?.url ?? null,
        })
      }
    >
      Add to cart
    </Button>
  );
}
