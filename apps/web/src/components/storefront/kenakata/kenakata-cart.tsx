'use client';

import Link from 'next/link';
import { useState } from 'react';
import { type CartLine, useCart } from '@/lib/cart';
import { formatMoney, multiplyMoney } from '@/lib/money';
import { useStoreQuery } from '@/lib/use-order-now';
import { KIcon } from './icons';

function Thumb({ line }: { line: CartLine }) {
  const [failed, setFailed] = useState(false);
  return line.imageUrl && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={line.imageUrl} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-[var(--color-surface)] text-[var(--color-muted)]">
      <KIcon name="box" className="h-8 w-8" />
    </span>
  );
}

export function KenakataCart() {
  const { hydrated, lines, currency, itemCount, subtotal, setQuantity, removeItem, lineKey } = useCart();
  const storeQ = encodeURIComponent(useStoreQuery());
  const items = itemCount === 1 ? '1 item' : `${itemCount} items`;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-[var(--color-muted)]">
        <Link href={`/?store=${storeQ}`} className="hover:underline">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-[var(--color-ink)]">Cart</span>
      </nav>

      <div className="flex flex-wrap items-baseline gap-3 pb-8 pt-4">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold leading-tight tracking-tight text-[var(--color-ink)]">Shopping cart</h1>
        {hydrated && lines.length > 0 ? <span className="text-[var(--color-muted)]">{items}</span> : null}
      </div>

      {!hydrated ? (
        <p className="py-16 text-center text-[var(--color-muted)]">Loading your cart…</p>
      ) : lines.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-[var(--color-surface)] px-6 py-16 text-center">
          <p className="text-lg font-semibold text-[var(--color-ink)]">Your cart is empty</p>
          <p className="max-w-sm text-[var(--color-muted)]">Browse the store and add something you like.</p>
          <Link
            href={`/products?store=${storeQ}`}
            className="inline-flex h-12 items-center rounded-full bg-[var(--color-accent)] px-7 font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-10">
          <section aria-label="Items in your cart" className="min-w-0 flex-[999_1_560px]">
            <ul className="border-t border-[var(--color-border)]">
              {lines.map((line) => {
                const key = lineKey(line);
                const href = `/products/${line.productSlug}?store=${storeQ}`;
                return (
                  <li key={key} className="flex flex-wrap gap-5 border-b border-[var(--color-border)] py-6">
                    <Link href={href} tabIndex={-1} aria-hidden="true" className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl">
                      <Thumb line={line} />
                    </Link>
                    <div className="flex min-w-0 flex-1 basis-[220px] flex-col gap-1">
                      <Link href={href} className="text-lg font-semibold text-[var(--color-ink)] hover:underline">
                        {line.productName}
                      </Link>
                      {line.variantName ? <p className="text-sm text-[var(--color-muted)]">{line.variantName}</p> : null}
                      <p className="text-sm text-[var(--color-muted)]">{formatMoney(line.unitPrice, currency)} each</p>
                      <div className="flex items-center gap-4 pt-3">
                        <div className="flex h-11 items-center rounded-full border-[1.5px] border-[var(--color-border)] px-1">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${line.productName}`}
                            onClick={() => setQuantity(key, line.quantity - 1)}
                            className="h-10 w-10 rounded-full text-xl hover:bg-[var(--color-surface)]"
                          >
                            −
                          </button>
                          <span className="min-w-[28px] text-center font-semibold" aria-label="Quantity">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${line.productName}`}
                            onClick={() => setQuantity(key, line.quantity + 1)}
                            className="h-10 w-10 rounded-full text-xl hover:bg-[var(--color-surface)]"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(key)}
                          className="h-11 px-2 font-medium underline"
                          style={{ color: '#b4361e' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <p className="text-right text-lg font-semibold text-[var(--color-ink)]">
                      {formatMoney(multiplyMoney(line.unitPrice, line.quantity), currency)}
                    </p>
                  </li>
                );
              })}
            </ul>
            <div className="pt-6">
              <Link href={`/products?store=${storeQ}`} className="font-semibold text-[var(--color-ink)] hover:underline">
                ← Continue shopping
              </Link>
            </div>
          </section>

          <aside
            aria-label="Order summary"
            className="flex min-w-0 max-w-full flex-1 basis-[340px] flex-col gap-5 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 lg:max-w-[440px]"
          >
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--color-ink)]">Order summary</h2>
            <dl className="flex flex-col gap-3">
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Subtotal ({items})</dt>
                <dd className="font-medium">{formatMoney(subtotal, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Delivery</dt>
                <dd className="font-medium">Calculated at checkout</dd>
              </div>
              <div className="h-px bg-[var(--color-border)]" />
              <div className="flex items-baseline justify-between">
                <dt className="font-semibold">Total</dt>
                <dd className="text-2xl font-semibold">{formatMoney(subtotal, currency)}</dd>
              </div>
            </dl>
            <p className="flex items-center gap-2.5 rounded-xl bg-white px-3.5 py-3 text-sm text-[var(--color-ink)]">
              <KIcon name="lock" className="h-[18px] w-[18px] shrink-0" />
              Have a discount code? Add it at checkout.
            </p>
            <Link
              href={`/checkout?store=${storeQ}`}
              className="flex h-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-[17px] font-semibold text-white hover:bg-[var(--color-accent-hover)]"
            >
              Proceed to checkout
            </Link>
            <p className="text-center text-sm text-[var(--color-muted)]">Final prices, delivery and stock are confirmed at checkout.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
