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

/** "Order now": adds the line to the cart like Add to cart, then goes straight to checkout. */
export function useOrderNow() {
  const router = useRouter();
  const { addItem } = useCart();
  const storeQ = useStoreQuery();

  return useCallback(
    (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => {
      addItem(line);
      router.push(`/checkout?store=${encodeURIComponent(storeQ)}`);
    },
    [addItem, router, storeQ],
  );
}
