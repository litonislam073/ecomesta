'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PublicProductCard } from '@ecomesta/types';
import { lineKey, useCart } from '@/lib/cart';
import { Icon } from './icons';

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // Bangladesh: UTC+6, no daylight saving
const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds until midnight in Bangladesh: the deal of the day ends with the day. */
export function msUntilDhakaMidnight(now = Date.now()): number {
  const local = now + DHAKA_OFFSET_MS;
  return Math.floor(local / DAY_MS) * DAY_MS + DAY_MS - local;
}

/** Hours / minutes / seconds left today; blank until mounted so server and browser agree. */
export function DealCountdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(msUntilDhakaMidnight());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const parts =
    left === null
      ? ['--', '--', '--']
      : [Math.floor(left / 3_600_000), Math.floor((left % 3_600_000) / 60_000), Math.floor((left % 60_000) / 1000)].map((n) =>
          String(n).padStart(2, '0'),
        );
  return (
    <div className="flex items-center gap-2" role="timer" aria-label="Time left for today's deal">
      {parts.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="flex min-w-14 flex-col items-center rounded-xl bg-white px-3 py-2 shadow-sm">
            <span className="text-xl font-bold tabular-nums text-[var(--color-ink)]">{value}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {['Hrs', 'Mins', 'Secs'][index]}
            </span>
          </span>
          {index < 2 ? <span className="text-lg font-bold text-[var(--color-muted)]">:</span> : null}
        </div>
      ))}
    </div>
  );
}

/** Round cart button on a product card: adds simple products, opens variant products. */
export function AddToCartIcon({ product, href }: { product: PublicProductCard; href: string }) {
  const { addItem, lines, setDrawerOpen } = useCart();
  const base =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40';
  if (product.hasVariants) {
    return (
      <Link href={href} className={base} aria-label={`Choose options for ${product.name}`}>
        <Icon name="cart" />
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
    <button
      type="button"
      className={`${base} ${inCart ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white' : ''}`}
      disabled={!product.available}
      aria-label={inCart ? `${product.name} is in your cart — open cart` : `Add ${product.name} to cart`}
      onClick={() => (inCart ? setDrawerOpen(true) : addItem(line))}
    >
      <Icon name="cart" />
    </button>
  );
}
