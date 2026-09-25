'use client';

import Link from 'next/link';
import { Button } from '@ecomesta/ui';
import { useCart } from '@/lib/cart';
import { formatMoney, multiplyMoney } from '@/lib/money';

export default function CartPage() {
  const {
    lines,
    currency,
    subtotal,
    setQuantity,
    removeItem,
    clear,
    lineKey,
    storeSlug,
  } = useCart();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">Cart</h1>

      {lines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
          <p className="text-[var(--color-muted)]">Your cart is empty.</p>
          <Link
            href={`/products?store=${encodeURIComponent(storeSlug)}`}
            className="mt-4 inline-block text-[var(--color-accent)] hover:underline"
          >
            Continue shopping
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {lines.map((line) => {
              const key = lineKey(line);
              return (
                <li
                  key={key}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/products/${line.productSlug}?store=${encodeURIComponent(storeSlug)}`}
                        className="font-semibold hover:text-[var(--color-accent)]"
                      >
                        {line.productName}
                      </Link>
                      {line.variantName ? (
                        <p className="text-sm text-[var(--color-muted)]">{line.variantName}</p>
                      ) : null}
                      <p className="mt-1 text-sm">
                        {formatMoney(line.unitPrice, currency)} each
                      </p>
                    </div>
                    <p className="font-medium">
                      {formatMoney(multiplyMoney(line.unitPrice, line.quantity), currency)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity(key, line.quantity - 1)}
                    >
                      −
                    </Button>
                    <span>{line.quantity}</span>
                    <Button
                      variant="secondary"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity(key, line.quantity + 1)}
                    >
                      +
                    </Button>
                    <Button variant="danger" onClick={() => removeItem(key)}>
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-lg font-semibold">
              Subtotal: {formatMoney(subtotal, currency)}
            </p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={clear}>
                Clear cart
              </Button>
              <Link href={`/checkout?store=${encodeURIComponent(storeSlug)}`}>
                <Button>Checkout</Button>
              </Link>
            </div>
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            Final prices and stock are confirmed by the server at checkout. Shipping is free
            ($0) in this phase.
          </p>
        </>
      )}
    </div>
  );
}
