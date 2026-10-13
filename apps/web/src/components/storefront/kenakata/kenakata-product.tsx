'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { PublicProductCard, PublicProductDetail } from '@ecomesta/types';
import { lineKey, useCart } from '@/lib/cart';
import { formatMoney, multiplyMoney } from '@/lib/money';
import { withStoreParam } from '@/lib/theme';
import { useOrderNow } from '@/lib/use-order-now';
import { KIcon } from './icons';
import { KK } from './kenakata-utils';
import { KenakataProductCard } from './kenakata-product-card';

function percentOff(price: string, was: string | null): number | null {
  if (!was) return null;
  const p = Number(price);
  const w = Number(was);
  return w > p && p >= 0 ? Math.round(((w - p) / w) * 100) : null;
}

export function KenakataProductView({
  product,
  storeSlug,
  related,
}: {
  product: PublicProductDetail;
  storeSlug: string;
  related: PublicProductCard[];
}) {
  const { addItem, lines } = useCart();
  const orderNow = useOrderNow();
  const [photo, setPhoto] = useState(0);
  const [variantId, setVariantId] = useState(product.variants.find((v) => v.available)?.id ?? product.variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => product.variants.find((v) => v.id === variantId) ?? null, [product.variants, variantId]);
  const price = selected?.price ?? product.price;
  const was = selected ? selected.compareAtPrice : product.compareAtPrice;
  const off = percentOff(price, was);
  const available = product.hasVariants ? Boolean(selected?.available) : product.available;
  const images = product.images;
  const category = product.categories[0];
  const inCart = lines.some((l) => lineKey(l) === lineKey({ productId: product.id, variantId: selected?.id ?? null }));

  function line() {
    setError(null);
    if (product.hasVariants && !selected) {
      setError('Choose an option first.');
      return null;
    }
    if (!available) {
      setError('This option is out of stock.');
      return null;
    }
    return {
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantId: selected?.id ?? null,
      variantName: selected?.name ?? null,
      sku: selected?.sku ?? product.sku,
      unitPrice: price,
      quantity,
      imageUrl: images[0]?.url ?? null,
    };
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-[var(--color-muted)]">
        <Link href={withStoreParam('/', storeSlug)} className="hover:underline">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        {category ? (
          <>
            <Link href={withStoreParam(`/categories/${category.slug}`, storeSlug)} className="hover:underline">
              {category.name}
            </Link>
            <span aria-hidden="true">/</span>
          </>
        ) : null}
        <span className="font-medium text-[var(--color-ink)]">{product.name}</span>
      </nav>

      <section className="flex flex-wrap items-start gap-8 pt-7 lg:gap-12">
        {/* Gallery */}
        <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-4">
          <div className="relative overflow-hidden rounded-3xl bg-[var(--color-surface)]">
            {images[photo] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={images[photo]!.url}
                alt={images[photo]!.alt || product.name}
                className="aspect-square w-full object-cover sm:aspect-[4/4.2]"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center text-[var(--color-muted)] sm:aspect-[4/4.2]">
                <KIcon name="box" className="h-16 w-16" />
              </div>
            )}
            {off ? (
              <span className="absolute left-4 top-4 rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ backgroundColor: KK.sale }}>
                −{off}%
              </span>
            ) : null}
          </div>
          {images.length > 1 ? (
            <div className="flex gap-3">
              {images.slice(0, 5).map((image, index) => (
                <button
                  key={image.url}
                  type="button"
                  onClick={() => setPhoto(index)}
                  aria-label={`View photo ${index + 1}`}
                  aria-pressed={photo === index}
                  className={`min-w-0 flex-1 overflow-hidden rounded-2xl border-2 ${photo === index ? 'border-[var(--color-ink)]' : 'border-transparent'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 basis-[380px] flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            {category ? <p className="text-sm font-medium text-[var(--color-muted)]">{category.name}</p> : null}
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold leading-tight tracking-tight text-[var(--color-ink)]">
              {product.name}
            </h1>
          </div>

          <p className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold text-[var(--color-ink)]">{formatMoney(price, product.currency)}</span>
            {off && was ? <span className="text-lg text-[var(--color-muted)] line-through">{formatMoney(was, product.currency)}</span> : null}
          </p>

          {product.shortDescription ? <p className="text-[var(--color-ink)]/80">{product.shortDescription}</p> : null}

          {product.hasVariants ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 font-semibold text-[var(--color-ink)]">
                Option: <span className="font-normal text-[var(--color-muted)]">{selected?.name ?? 'Choose one'}</span>
              </legend>
              <div className="flex flex-wrap gap-2.5">
                {product.variants.map((variant) => {
                  const on = variant.id === variantId;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setVariantId(variant.id);
                        setError(null);
                      }}
                      className={`h-12 min-w-[64px] rounded-xl border-[1.5px] px-4 font-semibold ${
                        on
                          ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                          : 'border-[var(--color-border)] bg-white text-[var(--color-ink)] hover:border-[var(--color-ink)]'
                      } ${variant.available ? '' : 'line-through opacity-50'}`}
                    >
                      {variant.name}
                      {variant.available ? null : <span className="sr-only"> (out of stock)</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <p className={`text-sm font-medium ${available ? 'text-green-800' : 'text-[var(--color-muted)]'}`}>
            {available ? 'In stock' : 'Out of stock'}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-[52px] items-center rounded-full border-[1.5px] border-[var(--color-border)] px-1.5">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-11 w-11 rounded-full text-2xl hover:bg-[var(--color-surface)]"
              >
                −
              </button>
              <span className="min-w-[32px] text-center font-semibold" aria-live="polite" aria-label="Quantity">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                className="h-11 w-11 rounded-full text-2xl hover:bg-[var(--color-surface)]"
              >
                +
              </button>
            </div>
            {inCart ? (
              <Link
                href={withStoreParam('/cart', storeSlug)}
                className="flex h-[52px] flex-1 basis-[220px] items-center justify-center rounded-full bg-[var(--color-accent)] font-semibold text-white hover:bg-[var(--color-accent-hover)]"
              >
                In your cart — view cart
              </Link>
            ) : (
              <button
                type="button"
                disabled={!available}
                onClick={() => {
                  const next = line();
                  if (next) addItem(next);
                }}
                className="h-[52px] flex-1 basis-[220px] rounded-full bg-[var(--color-accent)] font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add to cart · {formatMoney(multiplyMoney(price, quantity), product.currency)}
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={!available}
            onClick={() => {
              const next = line();
              if (next) orderNow(next);
            }}
            className="h-[52px] rounded-full border-[1.5px] border-[var(--color-ink)] font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Buy now
          </button>
          {error ? (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}

          <ul className="flex flex-col gap-3.5 rounded-2xl border border-[var(--color-border)] p-5 text-[var(--color-ink)]">
            <li className="flex items-center gap-3">
              <KIcon name="cash" />
              Cash on delivery available
            </li>
            <li className="flex items-center gap-3">
              <KIcon name="phone" />
              Pay with bKash or Nagad
            </li>
            <li className="flex items-center gap-3">
              <KIcon name="returns" />
              Easy return on eligible items
            </li>
          </ul>
        </div>
      </section>

      {product.description || product.sku ? (
        <section aria-labelledby="kk-details" className="max-w-3xl pt-16">
          <h2 id="kk-details" className="mb-4 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Product details
          </h2>
          {product.description ? <p className="whitespace-pre-wrap text-[var(--color-ink)]/80">{product.description}</p> : null}
          {product.sku || selected?.sku ? (
            <dl className="mt-4 border-t border-[var(--color-border)]">
              <div className="flex gap-4 border-b border-[var(--color-border)] py-3.5">
                <dt className="shrink-0 basis-36 text-[var(--color-muted)]">SKU</dt>
                <dd>{selected?.sku ?? product.sku}</dd>
              </div>
            </dl>
          ) : null}
        </section>
      ) : null}

      {related.length > 0 ? (
        <section aria-labelledby="kk-related" className="pt-16">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 id="kk-related" className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
              You may also like
            </h2>
            <Link href={withStoreParam('/products', storeSlug)} className="font-semibold text-[var(--color-ink)] hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
            {related.map((item) => (
              <KenakataProductCard key={item.id} product={item} storeSlug={storeSlug} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
