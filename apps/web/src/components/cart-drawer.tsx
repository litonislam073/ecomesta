'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@ecomesta/ui';
import { useCart } from '@/lib/cart';
import { formatMoney, multiplyMoney } from '@/lib/money';

export function CartDrawer() {
  const searchParams = useSearchParams();
  const storeParam = searchParams.get('store');
  const {
    lines,
    currency,
    subtotal,
    drawerOpen,
    setDrawerOpen,
    setQuantity,
    removeItem,
    clear,
    lineKey,
    storeSlug,
  } = useCart();
  const storeQ = storeParam ?? storeSlug;

  // Escape closes the drawer, like any modal dialog.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Cart">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close cart"
        onClick={() => setDrawerOpen(false)}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-[var(--color-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
          <h2 className="text-lg font-semibold">Your cart</h2>
          <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {lines.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Your cart is empty.</p>
          ) : (
            <ul className="space-y-4">
              {lines.map((line) => {
                const key = lineKey(line);
                return (
                  <li key={key} className="border-b border-[var(--color-border)] pb-4">
                    <p className="font-medium">{line.productName}</p>
                    {line.variantName ? (
                      <p className="text-xs text-[var(--color-muted)]">{line.variantName}</p>
                    ) : null}
                    <p className="mt-1 text-sm">
                      {formatMoney(line.unitPrice, currency)} × {line.quantity} ={' '}
                      {formatMoney(multiplyMoney(line.unitPrice, line.quantity), currency)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        aria-label="Decrease quantity"
                        onClick={() => setQuantity(key, line.quantity - 1)}
                      >
                        −
                      </Button>
                      <span aria-live="polite">{line.quantity}</span>
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
          )}
        </div>
        <div className="space-y-3 border-t border-[var(--color-border)] px-4 py-4">
          <p className="flex justify-between text-sm font-semibold">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal, currency)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/cart?store=${encodeURIComponent(storeQ)}`}>
              <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
                View cart
              </Button>
            </Link>
            {lines.length > 0 ? (
              <>
                <Link href={`/checkout?store=${encodeURIComponent(storeQ)}`}>
                  <Button onClick={() => setDrawerOpen(false)}>Checkout</Button>
                </Link>
                <Button variant="danger" onClick={clear}>
                  Clear
                </Button>
              </>
            ) : null}
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Prices are recalculated on the server when you place an order.
          </p>
        </div>
      </aside>
    </div>
  );
}
