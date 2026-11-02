'use client';

import { FormEvent, useState } from 'react';
import type { ProductStatus, ProductVariant } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { isNonNegativeMoney } from '@/lib/catalog-utils';

export type VariantFormValues = {
  name: string;
  sku: string;
  barcode: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  weight: string;
  status: ProductStatus;
  /** Initial stock on create when the product tracks inventory. */
  quantity: string;
};

export function VariantForm({
  initial,
  busy,
  submitLabel,
  trackInventory = false,
  showStockField = false,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<VariantFormValues>;
  busy?: boolean;
  submitLabel: string;
  /** When true, show stock field and validate integer quantity on create. */
  trackInventory?: boolean;
  showStockField?: boolean;
  onSubmit: (values: VariantFormValues) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const stockVisible = showStockField && trackInventory;
  const [values, setValues] = useState<VariantFormValues>({
    name: initial?.name ?? '',
    sku: initial?.sku ?? '',
    barcode: initial?.barcode ?? '',
    price: initial?.price ?? '0.00',
    compareAtPrice: initial?.compareAtPrice ?? '',
    costPrice: initial?.costPrice ?? '',
    weight: initial?.weight ?? '',
    status: initial?.status ?? 'ACTIVE',
    quantity: initial?.quantity ?? '0',
  });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!values.name.trim()) {
      setError('Variant name is required.');
      return;
    }
    if (!isNonNegativeMoney(values.price)) {
      setError('Price must be a non-negative amount with up to 2 decimals.');
      return;
    }
    if (stockVisible) {
      const raw = values.quantity.trim() === '' ? '0' : values.quantity.trim();
      const qty = Number.parseInt(raw, 10);
      if (!Number.isFinite(qty) || String(qty) !== raw || qty < 0) {
        setError('Stock must be a whole number of 0 or more.');
        return;
      }
    }
    await onSubmit({
      ...values,
      quantity: values.quantity.trim() === '' ? '0' : values.quantity.trim(),
    });
  }

  const stockQty = Number.parseInt(values.quantity, 10);
  const stockZeroWarning =
    stockVisible && Number.isFinite(stockQty) && stockQty === 0;

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2" noValidate>
      <label className="space-y-1 text-sm">
        <span>Name</span>
        <Input
          required
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span>Status</span>
        <Select
          value={values.status}
          onChange={(e) =>
            setValues((v) => ({ ...v, status: e.target.value as ProductStatus }))
          }
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="DRAFT">DRAFT</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </Select>
      </label>
      <label className="space-y-1 text-sm">
        <span>SKU</span>
        <Input
          value={values.sku}
          onChange={(e) => setValues((v) => ({ ...v, sku: e.target.value }))}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span>Barcode</span>
        <Input
          value={values.barcode}
          onChange={(e) => setValues((v) => ({ ...v, barcode: e.target.value }))}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span>Price</span>
        <Input
          required
          value={values.price}
          onChange={(e) => setValues((v) => ({ ...v, price: e.target.value }))}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span>Compare-at</span>
        <Input
          value={values.compareAtPrice}
          onChange={(e) => setValues((v) => ({ ...v, compareAtPrice: e.target.value }))}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span>Cost</span>
        <Input
          value={values.costPrice}
          onChange={(e) => setValues((v) => ({ ...v, costPrice: e.target.value }))}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span>Weight</span>
        <Input
          value={values.weight}
          onChange={(e) => setValues((v) => ({ ...v, weight: e.target.value }))}
        />
      </label>
      {stockVisible ? (
        <label className="space-y-1 text-sm md:col-span-2">
          <span>Stock quantity</span>
          <Input
            inputMode="numeric"
            value={values.quantity}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                quantity: e.target.value.replace(/[^\d]/g, ''),
              }))
            }
            aria-describedby={stockZeroWarning ? 'variant-stock-warn' : undefined}
          />
          {stockZeroWarning ? (
            <p
              id="variant-stock-warn"
              className="text-xs text-[var(--color-muted)]"
              role="status"
            >
              Stock is 0 — customers cannot buy this variant until you add inventory.
            </p>
          ) : null}
        </label>
      ) : null}
      {error ? (
        <p className="md:col-span-2 text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="md:col-span-2 flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
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

export function variantToFormValues(variant: ProductVariant): VariantFormValues {
  return {
    name: variant.name,
    sku: variant.sku ?? '',
    barcode: variant.barcode ?? '',
    price: variant.price,
    compareAtPrice: variant.compareAtPrice ?? '',
    costPrice: variant.costPrice ?? '',
    weight: variant.weight ?? '',
    status: variant.status,
    quantity: '0',
  };
}
