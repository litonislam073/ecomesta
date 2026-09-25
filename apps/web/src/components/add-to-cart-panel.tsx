'use client';

import { useMemo, useState } from 'react';
import type { PublicProductDetail } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { useCart } from '@/lib/cart';
import { formatMoney } from '@/lib/money';

export function AddToCartPanel({ product }: { product: PublicProductDetail }) {
  const { addItem } = useCart();
  const [variantId, setVariantId] = useState(
    product.variants.find((v) => v.available)?.id ?? product.variants[0]?.id ?? '',
  );
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => product.variants.find((v) => v.id === variantId) ?? null,
    [product.variants, variantId],
  );

  const price = selected?.price ?? product.price;
  const available = selected ? selected.available : product.available;
  const needsVariant = product.hasVariants;

  function onAdd() {
    setError(null);
    if (needsVariant && !selected) {
      setError('Select a variant.');
      return;
    }
    if (needsVariant && selected && !selected.available) {
      setError('That variant is unavailable.');
      return;
    }
    if (!needsVariant && !product.available) {
      setError('This product is unavailable.');
      return;
    }
    if (quantity < 1) {
      setError('Quantity must be at least 1.');
      return;
    }
    addItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantId: selected?.id ?? null,
      variantName: selected?.name ?? null,
      sku: selected?.sku ?? product.sku,
      unitPrice: price,
      quantity,
      imageUrl: product.images[0]?.url ?? null,
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <p className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        {formatMoney(price, product.currency)}
      </p>
      {product.compareAtPrice && !selected ? (
        <p className="text-sm text-[var(--color-muted)] line-through">
          {formatMoney(product.compareAtPrice, product.currency)}
        </p>
      ) : null}

      {needsVariant ? (
        <label className="block space-y-1 text-sm">
          <span>Variant</span>
          <select
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            aria-label="Choose variant"
          >
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {!v.available ? ' (unavailable)' : ''} —{' '}
                {formatMoney(v.price, product.currency)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span>Quantity</span>
        <input
          type="number"
          min={1}
          className="w-24 rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
          value={quantity}
          onChange={(e) => setQuantity(Number.parseInt(e.target.value, 10) || 1)}
          aria-label="Quantity"
        />
      </label>

      <p className="text-sm text-[var(--color-muted)]">
        {available ? 'In stock' : 'Currently unavailable'}
      </p>

      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        onClick={onAdd}
        disabled={needsVariant ? !variantId || !available : !product.available}
      >
        Add to cart
      </Button>
    </div>
  );
}
