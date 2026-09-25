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
};

export function VariantForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<VariantFormValues>;
  busy?: boolean;
  submitLabel: string;
  onSubmit: (values: VariantFormValues) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<VariantFormValues>({
    name: initial?.name ?? '',
    sku: initial?.sku ?? '',
    barcode: initial?.barcode ?? '',
    price: initial?.price ?? '0.00',
    compareAtPrice: initial?.compareAtPrice ?? '',
    costPrice: initial?.costPrice ?? '',
    weight: initial?.weight ?? '',
    status: initial?.status ?? 'ACTIVE',
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
    await onSubmit(values);
  }

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
  };
}
