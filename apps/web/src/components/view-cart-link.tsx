'use client';

import Link from 'next/link';
import { useStoreQuery } from '@/lib/use-order-now';

/** Shown in place of Add to cart once that product (or variant) is in the cart. */
export function ViewCartLink({ label }: { label?: string }) {
  const storeQ = useStoreQuery();
  return (
    <Link
      href={`/cart?store=${encodeURIComponent(storeQ)}`}
      aria-label={label}
      className="inline-flex w-full items-center justify-center rounded-md border border-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-bg)]"
    >
      View cart
    </Link>
  );
}
