'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart, type CartLine } from '@/lib/cart';

/** The `?store=` value storefront links carry, as the cart drawer builds it. */
export function useStoreQuery() {
  const searchParams = useSearchParams();
  const { storeSlug } = useCart();
  return searchParams.get('store') ?? storeSlug;
}

/**
 * "Order now" / "Buy now": puts the line in the cart — without doubling it when
 * the shopper already added it — then goes straight to checkout.
 */
export function useOrderNow() {
  const router = useRouter();
  const { ensureItem } = useCart();
  const storeQ = useStoreQuery();

  return useCallback(
    (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => {
      ensureItem(line);
      router.push(`/checkout?store=${encodeURIComponent(storeQ)}`);
    },
    [ensureItem, router, storeQ],
  );
}
