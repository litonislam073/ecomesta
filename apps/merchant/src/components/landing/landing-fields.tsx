'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LandingFieldDef, LandingItem, LandingItemValue, LandingValue } from '@ecomesta/utils';
import { Button } from '@ecomesta/ui';
import { ImageField } from '@/components/media/image-field';
import { FieldLabel, NumberField, TextAreaField, TextField, ToggleField } from '@/components/theme/theme-fields';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { mediaSrc } from '@/lib/media';

export interface StoreProductOption {
  id: string;
  name: string;
  basePrice: string;
  compareAtPrice: string | null;
  imageUrl: string | null;
  status: string;
}

/** The store's products for pickers (loaded once per editor). */
export function useStoreProducts(storeId: string | null) {
  const [products, setProducts] = useState<StoreProductOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    api
      .get<{ success: true; data: { items: StoreProductOption[] } }>(`/stores/${storeId}/products?limit=100&status=ACTIVE`)
      .then((r) => !cancelled && setProducts(r.data.items))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [storeId]);
  return { products, failed };
}

/** Chooses products in order (one, or up to `max`). */
export function ProductPicker({
  label,
  hint,
  value,
  max,
  products,
  failed,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string[];
  max: number;
  products: StoreProductOption[] | null;
  failed: boolean;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const chosen = value.map((id) => products?.find((p) => p.id === id)).filter((p): p is StoreProductOption => !!p);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products ?? []).filter((p) => !value.includes(p.id) && (!q || p.name.toLowerCase().includes(q))).slice(0, 30);
  }, [products, query, value]);
  const move = (index: number, delta: number) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    onChange(next);
  };
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium text-[var(--color-ink)]">{label}</p>
      {hint ? <p className="text-xs text-[var(--color-muted)]">{hint}</p> : null}
      {chosen.length > 0 ? (
        <ul className="space-y-1.5" aria-label={`${label}: chosen`}>
          {chosen.map((product, index) => (
            <li key={product.id} className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-white p-1.5">
              {mediaSrc(product.imageUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaSrc(product.imageUrl)!} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
              ) : (
                <span className="h-9 w-9 shrink-0 rounded bg-[#eef1f4]" />
              )}
              <span className="min-w-0 flex-1 truncate">{product.name}</span>
              {max > 1 ? (
                <>
                  <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${product.name} up`} className="rounded px-1.5 text-[var(--color-muted)] hover:bg-[#f1f4f7] disabled:opacity-30">
                    ↑
                  </button>
                  <button type="button" disabled={disabled || index === chosen.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${product.name} down`} className="rounded px-1.5 text-[var(--color-muted)] hover:bg-[#f1f4f7] disabled:opacity-30">
                    ↓
                  </button>
                </>
              ) : null}
              <button type="button" disabled={disabled} onClick={() => onChange(value.filter((id) => id !== product.id))} aria-label={`Remove ${product.name}`} className="rounded px-1.5 text-[var(--color-danger)] hover:bg-[#fdecec]">
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {failed ? <p className="text-[var(--color-danger)]">Could not load your products.</p> : null}
      {products === null && !failed ? <p className="text-[var(--color-muted)]">Loading products…</p> : null}
      {products && value.length < max ? (
        <div className="space-y-1.5">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your products" aria-label={`${label}: search`} disabled={disabled} />
          <ul className="max-h-56 space-y-1 overflow-auto">
            {results.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(max === 1 ? [product.id] : [...value, product.id])}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-[#f1f4f7]"
                >
                  {mediaSrc(product.imageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaSrc(product.imageUrl)!} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="h-8 w-8 shrink-0 rounded bg-[#eef1f4]" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{product.name}</span>
                  <span className="text-xs text-[var(--color-accent)]">+ Add</span>
                </button>
              </li>
            ))}
            {results.length === 0 ? <li className="px-1.5 text-[var(--color-muted)]">{products.length === 0 ? 'No active products yet. Add products first.' : 'No matching products.'}</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function OptionSelect({ field, value, onChange, disabled }: { field: LandingFieldDef; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <FieldLabel label={field.label} hint={field.help}>
      <Select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {(field.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </FieldLabel>
  );
}

function ScalarField({
  field,
  value,
  onChange,
  storeId,
  disabled,
}: {
  field: LandingFieldDef;
  value: LandingItemValue | undefined;
  onChange: (value: LandingItemValue) => void;
  storeId: string | null;
  disabled?: boolean;
}) {
  const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  switch (field.kind) {
    case 'textarea':
      return <TextAreaField label={field.label} hint={field.help} value={text} rows={field.max && field.max > 600 ? 6 : 3} disabled={disabled} onChange={onChange} />;
    case 'image':
      return <ImageField label={field.label} note={field.help} purpose="general" storeId={storeId} value={text} disabled={disabled} onChange={onChange} />;
    case 'number':
      return (
        <NumberField
          label={field.label}
          hint={field.help}
          value={typeof value === 'number' ? value : undefined}
          min={field.min}
          max={field.max}
          disabled={disabled}
          onChange={(n) => onChange(n ?? field.min ?? 0)}
        />
      );
    case 'toggle':
      return <ToggleField label={field.label} hint={field.help} checked={value === true} disabled={disabled} onChange={onChange} />;
    case 'icon':
    case 'select':
      return <OptionSelect field={field} value={text} disabled={disabled} onChange={onChange} />;
    case 'url':
      return <TextField label={field.label} hint={field.help} value={text} placeholder={field.placeholder ?? 'https://'} disabled={disabled} onChange={onChange} />;
    default:
      return <TextField label={field.label} hint={field.help ?? (field.max ? undefined : undefined)} value={text} placeholder={field.placeholder} disabled={disabled} onChange={onChange} />;
  }
}

function itemTitle(item: LandingItem, index: number, itemLabel: string): string {
  for (const key of ['title', 'name', 'question', 'feature', 'caption', 'text', 'label', 'description']) {
    const v = item[key];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 48);
  }
  return `${itemLabel} ${index + 1}`;
}

function ListField({
  field,
  value,
  onChange,
  storeId,
  disabled,
}: {
  field: LandingFieldDef;
  value: LandingItem[];
  onChange: (value: LandingItem[]) => void;
  storeId: string | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const itemLabel = field.itemLabel ?? 'Item';
  const max = field.max ?? 20;
  const blank = (): LandingItem =>
    Object.fromEntries(
      (field.itemFields ?? []).map((f) => [f.key, f.kind === 'number' ? (f.key === 'rating' ? 5 : (f.min ?? 0)) : f.kind === 'toggle' ? false : f.kind === 'icon' ? (f.options?.[0]?.value ?? '') : '']),
    );
  const update = (index: number, key: string, v: LandingItemValue) => onChange(value.map((item, i) => (i === index ? { ...item, [key]: v } : item)));
  const move = (index: number, delta: number) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    onChange(next);
    setOpen(index + delta);
  };
  return (
    <fieldset className="space-y-2 text-sm">
      <legend className="font-medium text-[var(--color-ink)]">{field.label}</legend>
      {field.help ? <p className="text-xs text-[var(--color-muted)]">{field.help}</p> : null}
      <ul className="space-y-1.5">
        {value.map((item, index) => (
          <li key={index} className="rounded-md border border-[var(--color-border)] bg-white">
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)} className="min-w-0 flex-1 truncate text-left font-medium">
                {itemTitle(item, index, itemLabel)}
              </button>
              <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${itemLabel.toLowerCase()} ${index + 1} up`} className="rounded px-1.5 text-[var(--color-muted)] hover:bg-[#f1f4f7] disabled:opacity-30">
                ↑
              </button>
              <button type="button" disabled={disabled || index === value.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${itemLabel.toLowerCase()} ${index + 1} down`} className="rounded px-1.5 text-[var(--color-muted)] hover:bg-[#f1f4f7] disabled:opacity-30">
                ↓
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(value.filter((_, i) => i !== index));
                  setOpen(null);
                }}
                aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                className="rounded px-1.5 text-[var(--color-danger)] hover:bg-[#fdecec]"
              >
                ×
              </button>
            </div>
            {open === index ? (
              <div role="group" aria-label={`${itemLabel} ${index + 1}`} className="space-y-3 border-t border-[var(--color-border)] p-2.5">
                {(field.itemFields ?? []).map((f) => (
                  <ScalarField key={f.key} field={f} value={item[f.key]} storeId={storeId} disabled={disabled} onChange={(v) => update(index, f.key, v)} />
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {value.length < max ? (
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            onChange([...value, blank()]);
            setOpen(value.length);
          }}
        >
          + Add {itemLabel.toLowerCase()}
        </Button>
      ) : null}
    </fieldset>
  );
}

/** A section's settings as a form, built from the template's field list. */
export function LandingFieldsForm({
  fields,
  value,
  onChange,
  storeId,
  products,
  disabled,
}: {
  fields: LandingFieldDef[];
  value: Record<string, LandingValue>;
  onChange: (next: Record<string, LandingValue>) => void;
  storeId: string | null;
  products: ReturnType<typeof useStoreProducts>;
  disabled?: boolean;
}) {
  const set = (key: string, v: LandingValue) => onChange({ ...value, [key]: v });
  return (
    <div className="space-y-4">
      {fields.map((field) => {
        if (field.kind === 'list') {
          const items = Array.isArray(value[field.key]) ? (value[field.key] as LandingItem[]).filter((i) => i && typeof i === 'object') : [];
          return <ListField key={field.key} field={field} value={items} storeId={storeId} disabled={disabled} onChange={(v) => set(field.key, v)} />;
        }
        if (field.kind === 'products') {
          const ids = Array.isArray(value[field.key]) ? (value[field.key] as string[]).filter((i) => typeof i === 'string') : [];
          return (
            <ProductPicker
              key={field.key}
              label={field.label}
              hint={field.help}
              value={ids}
              max={field.max ?? 12}
              products={products.products}
              failed={products.failed}
              disabled={disabled}
              onChange={(v) => set(field.key, v)}
            />
          );
        }
        const raw = value[field.key];
        return (
          <ScalarField
            key={field.key}
            field={field}
            value={Array.isArray(raw) ? null : (raw as LandingItemValue | undefined)}
            storeId={storeId}
            disabled={disabled}
            onChange={(v) => set(field.key, v)}
          />
        );
      })}
    </div>
  );
}
