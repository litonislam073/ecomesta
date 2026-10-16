'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { Category, Product, ProductStatus, ProductType } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { DescriptionEditor } from '@/components/catalog/description-editor';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { isNonNegativeMoney, isValidSlug, normalizeSlug, slugifyFromName } from '@/lib/catalog-utils';
import { stockError, stockKey, type StockTarget } from '@/lib/product-stock';

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  status: ProductStatus;
  productType: ProductType;
  basePrice: string;
  compareAtPrice: string;
  costPrice: string;
  trackInventory: boolean;
  allowBackorder: boolean;
  sku: string;
  barcode: string;
  categoryIds: string[];
};

const emptyValues: ProductFormValues = {
  name: '',
  slug: '',
  description: '',
  shortDescription: '',
  status: 'DRAFT',
  productType: 'PHYSICAL',
  basePrice: '0.00',
  compareAtPrice: '',
  costPrice: '',
  trackInventory: true,
  allowBackorder: false,
  sku: '',
  barcode: '',
  categoryIds: [],
};

function stockValues(targets: StockTarget[] | undefined): Record<string, string> {
  return Object.fromEntries((targets ?? []).map((t) => [stockKey(t.variantId), String(t.quantity)]));
}

function StockFields({
  targets,
  stock,
  tracked,
  onChange,
}: {
  targets: StockTarget[];
  stock: Record<string, string>;
  tracked: boolean;
  onChange: (key: string, value: string) => void;
}) {
  if (!tracked) {
    return (
      <p className="text-sm text-[var(--color-muted)] md:col-span-2">
        Stock is not counted for this product, so it never sells out. Tick “Track inventory” to set how many you have.
      </p>
    );
  }
  const perVariant = targets.length > 1 || targets[0]?.variantId !== null;
  return (
    <fieldset className="space-y-2 md:col-span-2">
      <legend className="text-sm font-medium">{perVariant ? 'Stock per variant' : 'Stock'}</legend>
      <p className="text-xs text-[var(--color-muted)]">
        How many you have right now. Orders reduce it automatically. Saved together with the product.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {targets.map((target) => {
          const key = stockKey(target.variantId);
          const hintId = `stock-hint-${key}`;
          return (
            <div key={key} className="space-y-1 text-sm">
              <label className="block space-y-1">
                <span>{perVariant ? `${target.label} stock` : target.label}</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={stock[key] ?? ''}
                  aria-describedby={target.reserved > 0 ? hintId : undefined}
                  onChange={(e) => onChange(key, e.target.value)}
                />
              </label>
              {target.reserved > 0 ? (
                <p id={hintId} className="text-xs text-[var(--color-muted)]">
                  {target.reserved} held for open orders
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function productToFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description ?? '',
    shortDescription: product.shortDescription ?? '',
    status: product.status,
    productType: product.productType,
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice ?? '',
    costPrice: product.costPrice ?? '',
    trackInventory: product.trackInventory,
    allowBackorder: product.allowBackorder,
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    categoryIds: product.categoryIds ?? [],
  };
}

export function ProductForm({
  initial,
  categories,
  busy,
  submitLabel,
  allowArchivedStatus = false,
  stockTargets,
  onSubmit,
}: {
  initial?: ProductFormValues;
  categories: Category[];
  busy?: boolean;
  submitLabel: string;
  allowArchivedStatus?: boolean;
  /** Where stock is counted; leave out to hide the stock fields. */
  stockTargets?: StockTarget[];
  /** `stock` maps each target (see `stockKey`) to the number typed. */
  onSubmit: (values: ProductFormValues, stock: Record<string, string>) => Promise<void> | void;
}) {
  const [values, setValues] = useState<ProductFormValues>(initial ?? emptyValues);
  const [stock, setStock] = useState<Record<string, string>>(() => stockValues(stockTargets));
  const appliedTargets = useRef(stockTargets);
  useEffect(() => {
    if (stockTargets !== appliedTargets.current) {
      appliedTargets.current = stockTargets;
      setStock(stockValues(stockTargets));
    }
  }, [stockTargets]);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [error, setError] = useState<string | null>(null);

  // `useState` above already starts from `initial`; only a *different* initial
  // (e.g. the product reloaded) should replace the fields. Re-applying the same
  // object after mount would overwrite anything typed before effects ran.
  const appliedInitial = useRef(initial);
  useEffect(() => {
    if (initial && initial !== appliedInitial.current) {
      appliedInitial.current = initial;
      setValues(initial);
      setSlugTouched(true);
    }
  }, [initial]);

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!values.name.trim()) {
      setError('Name is required.');
      return;
    }
    const slug = normalizeSlug(values.slug);
    if (!isValidSlug(slug)) {
      setError('Slug must be lowercase letters, numbers, and hyphens (2–64 chars).');
      return;
    }
    if (!isNonNegativeMoney(values.basePrice)) {
      setError('Base price must be a non-negative amount with up to 2 decimals.');
      return;
    }
    if (values.compareAtPrice && !isNonNegativeMoney(values.compareAtPrice)) {
      setError('Compare-at price is invalid.');
      return;
    }
    if (values.costPrice && !isNonNegativeMoney(values.costPrice)) {
      setError('Cost price is invalid.');
      return;
    }
    if (values.trackInventory) {
      for (const target of stockTargets ?? []) {
        const message = stockError(stock[stockKey(target.variantId)] ?? '', target, values.allowBackorder);
        if (message) {
          setError(message);
          return;
        }
      }
    }
    await onSubmit({ ...values, slug }, stock);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <section className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-base font-semibold">Basic</h2>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>Name</span>
          <Input
            required
            value={values.name}
            onChange={(e) => {
              const name = e.target.value;
              update('name', name);
              if (!slugTouched) {
                update('slug', slugifyFromName(name));
              }
            }}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Slug</span>
          <Input
            required
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              update('slug', e.target.value);
            }}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Status</span>
          <Select
            value={values.status}
            onChange={(e) => update('status', e.target.value as ProductStatus)}
          >
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            {allowArchivedStatus ? <option value="ARCHIVED">ARCHIVED</option> : null}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Product type</span>
          <Select
            value={values.productType}
            onChange={(e) => update('productType', e.target.value as ProductType)}
          >
            <option value="PHYSICAL">PHYSICAL</option>
            <option value="DIGITAL">DIGITAL</option>
            <option value="SERVICE">SERVICE</option>
          </Select>
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>Short description</span>
          <Input
            value={values.shortDescription}
            onChange={(e) => update('shortDescription', e.target.value)}
          />
        </label>
        <div className="md:col-span-2">
          <DescriptionEditor value={values.description} onChange={(description) => update('description', description)} />
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-3">
        <h2 className="md:col-span-3 text-base font-semibold">Pricing</h2>
        <label className="space-y-1 text-sm">
          <span>Base price</span>
          <Input
            required
            value={values.basePrice}
            onChange={(e) => update('basePrice', e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Compare-at price</span>
          <Input
            value={values.compareAtPrice}
            onChange={(e) => update('compareAtPrice', e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Cost price</span>
          <Input
            value={values.costPrice}
            onChange={(e) => update('costPrice', e.target.value)}
          />
        </label>
      </section>

      <section className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-base font-semibold">Inventory</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.trackInventory}
            onChange={(e) => update('trackInventory', e.target.checked)}
          />
          Track inventory
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.allowBackorder}
            onChange={(e) => update('allowBackorder', e.target.checked)}
          />
          Allow backorder
        </label>
        {stockTargets?.length ? (
          <StockFields
            targets={stockTargets}
            stock={stock}
            tracked={values.trackInventory}
            onChange={(key, value) => setStock((prev) => ({ ...prev, [key]: value }))}
          />
        ) : null}
        <label className="space-y-1 text-sm">
          <span>SKU</span>
          <Input value={values.sku} onChange={(e) => update('sku', e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Barcode</span>
          <Input
            value={values.barcode}
            onChange={(e) => update('barcode', e.target.value)}
          />
        </label>
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-base font-semibold">Categories</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No categories yet.</p>
          ) : (
            categories.map((category) => {
              const checked = values.categoryIds.includes(category.id);
              return (
                <label key={category.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      update(
                        'categoryIds',
                        e.target.checked
                          ? [...values.categoryIds, category.id]
                          : values.categoryIds.filter((id) => id !== category.id),
                      );
                    }}
                  />
                  {category.name}
                </label>
              );
            })
          )}
        </div>
      </section>

      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
