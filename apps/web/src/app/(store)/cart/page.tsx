'use client';

import { useState } from 'react';
import Link from 'next/link';
import { type CartLine, useCart } from '@/lib/cart';
import { formatMoney, multiplyMoney } from '@/lib/money';
import { useStoreQuery } from '@/lib/use-order-now';

function ImageIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="m21 16-5.5-5.5L5 20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BagIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" strokeLinejoin="round" />
      <path d="M9 10V6.5a3 3 0 0 1 6 0V10" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Product photo for a cart line; an image icon when there is none or it fails to load. */
function LineThumbnail({ line }: { line: CartLine }) {
  const [failed, setFailed] = useState(false);
  const showImage = line.imageUrl && !failed;
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] sm:h-28 sm:w-28">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={line.imageUrl!}
          alt={line.productName}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <ImageIcon className="h-9 w-9 text-[var(--color-muted)]" />
      )}
    </div>
  );
}

export default function CartPage() {
  const { hydrated, lines, currency, itemCount, subtotal, setQuantity, removeItem, clear, lineKey } =
    useCart();
  const storeQ = encodeURIComponent(useStoreQuery());

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">Your cart</h1>
        <p className="mt-6 text-[var(--color-muted)]">Loading your cart…</p>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">Your cart</h1>
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-accent)]">
            <BagIcon className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">Your cart is empty</h2>
          <p className="mt-2 max-w-sm text-sm text-[var(--color-muted)]">
            Looks like you haven’t added anything yet. Browse the store and find something you like.
          </p>
          <Link
            href={`/products?store=${storeQ}`}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Start shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">Your cart</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
        <Link
          href={`/products?store=${storeQ}`}
          className="text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          ← Continue shopping
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section aria-label="Cart items" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <ul className="divide-y divide-[var(--color-border)]">
            {lines.map((line) => {
              const key = lineKey(line);
              const href = `/products/${line.productSlug}?store=${storeQ}`;
              return (
                <li key={key} className="flex gap-4 p-4 sm:gap-5 sm:p-5">
                  <Link href={href} className="shrink-0">
                    <LineThumbnail line={line} />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={href} className="font-semibold leading-snug hover:text-[var(--color-accent)]">
                          {line.productName}
                        </Link>
                        {line.variantName ? (
                          <p className="mt-0.5 text-sm text-[var(--color-muted)]">{line.variantName}</p>
                        ) : null}
                        <p className="mt-1 text-sm text-[var(--color-muted)]">
                          {formatMoney(line.unitPrice, currency)} each
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold">
                        {formatMoney(multiplyMoney(line.unitPrice, line.quantity), currency)}
                      </p>
                    </div>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                      <div className="inline-flex items-center rounded-full border border-[var(--color-border)]">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          className="flex h-9 w-9 items-center justify-center rounded-l-full text-lg hover:bg-[var(--color-bg)]"
                          onClick={() => setQuantity(key, line.quantity - 1)}
                        >
                          −
                        </button>
                        <span className="w-9 text-center text-sm font-medium" aria-label="Quantity">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          className="flex h-9 w-9 items-center justify-center rounded-r-full text-lg hover:bg-[var(--color-bg)]"
                          onClick={() => setQuantity(key, line.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${line.productName}`}
                        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                        onClick={() => removeItem(key)}
                      >
                        <TrashIcon className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end border-t border-[var(--color-border)] px-5 py-3">
            <button
              type="button"
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-danger)]"
              onClick={clear}
            >
              Clear cart
            </button>
          </div>
        </section>

        <aside
          aria-label="Order summary"
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:sticky lg:top-6"
        >
          <h2 className="text-lg font-semibold">Order summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">
                Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
              </dt>
              <dd className="font-medium">{formatMoney(subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Shipping</dt>
              <dd className="text-[var(--color-muted)]">Calculated at checkout</dd>
            </div>
          </dl>
          <div className="mt-4 flex items-baseline justify-between border-t border-[var(--color-border)] pt-4">
            <span className="font-semibold">Estimated total</span>
            <span className="text-xl font-semibold">{formatMoney(subtotal, currency)}</span>
          </div>
          <Link
            href={`/checkout?store=${storeQ}`}
            className="mt-5 flex w-full items-center justify-center rounded-md bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
            Proceed to checkout
          </Link>
          <p className="mt-3 text-center text-xs text-[var(--color-muted)]">
            Final prices, shipping and stock are confirmed at checkout.
          </p>
        </aside>
      </div>
    </div>
  );
}
