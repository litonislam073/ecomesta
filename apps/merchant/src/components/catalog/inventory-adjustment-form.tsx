'use client';

import { FormEvent, useState } from 'react';
import type { InventoryItem, Product, ProductVariant } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function InventoryAdjustmentForm({
  item,
  products,
  variants,
  busy,
  onSubmit,
  onCancel,
}: {
  item?: InventoryItem | null;
  products: Product[];
  variants: ProductVariant[];
  busy?: boolean;
  onSubmit: (payload: {
    productId: string;
    variantId: string | null;
    quantity: number;
    type: 'ADJUSTMENT';
    note?: string;
  }) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [productId, setProductId] = useState(item?.productId ?? products[0]?.id ?? '');
  const [variantId, setVariantId] = useState(item?.variantId ?? '');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const productVariants = variants.filter((v) => v.productId === productId);
  const currentQty = item?.quantity;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const delta = Number.parseInt(quantity, 10);
    if (!Number.isInteger(delta) || delta === 0) {
      setError('Enter a non-zero whole number (positive to add, negative to remove).');
      return;
    }
    if (!productId) {
      setError('Select a product.');
      return;
    }
    if (productVariants.length > 0 && !variantId && !item?.variantId) {
      setError('Select a variant for this product.');
      return;
    }
    await onSubmit({
      productId,
      variantId: variantId || item?.variantId || null,
      quantity: delta,
      type: 'ADJUSTMENT',
      note: note.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {typeof currentQty === 'number' ? (
        <p className="text-sm text-[var(--color-muted)]">
          Current on-hand: <strong className="text-[var(--color-ink)]">{currentQty}</strong>
          {typeof item?.availableQuantity === 'number'
            ? ` · Available: ${item.availableQuantity}`
            : null}
        </p>
      ) : null}

      {!item ? (
        <>
          <label className="block space-y-1 text-sm">
            <span>Product</span>
            <Select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setVariantId('');
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>
          {productVariants.length > 0 ? (
            <label className="block space-y-1 text-sm">
              <span>Variant</span>
              <Select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                <option value="">Select variant</option>
                {productVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
        </>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span>Quantity delta</span>
        <Input
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Type</span>
        <Select value="ADJUSTMENT" disabled>
          <option value="ADJUSTMENT">ADJUSTMENT</option>
        </Select>
      </label>
      <label className="block space-y-1 text-sm">
        <span>Note</span>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Adjusting…' : 'Apply adjustment'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
