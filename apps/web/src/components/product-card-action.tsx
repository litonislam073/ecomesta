'use client';

import Link from 'next/link';
import type { PublicProductCard } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { lineKey, useCart } from '@/lib/cart';
import { useOrderNow } from '@/lib/use-order-now';
import { ViewCartLink } from '@/components/view-cart-link';

/**
 * Card-level Order now / Add to cart, using the same cart as the product page.
 * Products with variants go to the product page to pick one; unavailable
 * products get disabled buttons, as on the product page. Once the product is
 * in the cart, Add to cart becomes View cart.
 */
export function ProductCardAction({
  product,
  href,
}: {
  product: PublicProductCard;
  href: string;
}) {
  const { addItem, lines } = useCart();
  const orderNow = useOrderNow();

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

  const inCart = lines.some((l) => lineKey(l) === lineKey(line));

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        className="w-full"
        disabled={!product.available}
        aria-label={`Order ${product.name} now`}
        onClick={() => orderNow(line)}
      >
        Order now
      </Button>
      {inCart ? (
        <ViewCartLink label={`View cart (${product.name} added)`} />
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={!product.available}
          aria-label={`Add ${product.name} to cart`}
          onClick={() => addItem(line)}
        >
          Add to cart
        </Button>
      )}
    </div>
  );
}
