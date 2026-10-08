'use client';

import { useEffect, useMemo, useState } from 'react';
import type { StoreThemeConfig, ThemeHomepageSection } from '@ecomesta/types';
import { Card } from '@/components/ui/card';
import { TextAreaField, TextField, ToggleField } from '@/components/theme/theme-fields';
import { effectiveHomeSections } from '@/components/theme/homepage-block-panel';
import { api } from '@/lib/api-client';

type Homepage = NonNullable<StoreThemeConfig['homepage']>;
type ProductOption = { id: string; name: string; basePrice: string; compareAtPrice: string | null };

function discount(product: ProductOption): number | null {
  const price = Number(product.basePrice);
  const was = Number(product.compareAtPrice);
  return product.compareAtPrice && was > price ? Math.round(((was - price) / was) * 100) : null;
}

/** ShopEase's deal of the day: wording, countdown, and which product it features. */
export function DealSectionPanel({
  storeId,
  value,
  onChange,
  disabled,
  active,
}: {
  storeId: string | null;
  value: Homepage;
  onChange: (next: Homepage) => void;
  disabled?: boolean;
  /** Whether the panel is open (the product list loads then). */
  active: boolean;
}) {
  const sections = effectiveHomeSections(value);
  const index = sections.findIndex((section) => section.type === 'deal_of_day');
  const section = sections[index];
  const [products, setProducts] = useState<ProductOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!storeId || !active || products !== null) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => api.get<{ success: true; data: { items: ProductOption[] } }>(`/stores/${storeId}/products?limit=100&status=ACTIVE`))
      .then((result) => {
        if (!cancelled) setProducts(result.data.items.map(({ id, name, basePrice, compareAtPrice }) => ({ id, name, basePrice, compareAtPrice })));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, active, products]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (products ?? []).filter((product) => !q || product.name.toLowerCase().includes(q));
    // Discounted products first: they make the best deals.
    return [...list].sort((a, b) => (discount(b) ?? -1) - (discount(a) ?? -1));
  }, [products, query]);

  if (!section) return null;

  function patch(next: Partial<ThemeHomepageSection>) {
    onChange({ ...value, sections: sections.map((item, i) => (i === index ? { ...item, ...next } : item)) });
  }

  const choice = section.productId ?? '';
  const radio = (id: string, label: string, note?: string) => (
    <li key={id || 'auto'}>
      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[var(--color-bg)]">
        <input
          type="radio"
          name="deal-product"
          checked={choice === id}
          disabled={disabled}
          onChange={() => patch({ productId: id || undefined })}
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {note ? <span className="shrink-0 rounded-full bg-[#fdeee4] px-1.5 text-[11px] font-semibold text-[#c2410c]">{note}</span> : null}
      </label>
    </li>
  );

  return (
    <Card title="Deal of the day" description="One product on offer, with a countdown to midnight.">
      <div className="grid gap-4">
        <ToggleField
          label="Show this section"
          checked={section.enabled !== false}
          disabled={disabled}
          onChange={(enabled) => patch({ enabled })}
        />
        <TextField label="Heading" value={section.title ?? ''} disabled={disabled} onChange={(title) => patch({ title })} />
        <TextAreaField label="Text" rows={2} value={section.text ?? ''} disabled={disabled} onChange={(text) => patch({ text })} />
        <TextField
          label="Button label"
          value={section.buttonLabel ?? ''}
          placeholder="Shop the deal"
          disabled={disabled}
          onChange={(buttonLabel) => patch({ buttonLabel })}
        />
        <ToggleField
          label="Show countdown to midnight"
          checked={section.showCountdown !== false}
          disabled={disabled}
          onChange={(showCountdown) => patch({ showCountdown })}
        />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[var(--color-ink)]">Product</legend>
          {failed ? (
            <p className="text-sm text-[var(--color-danger)]">Could not load your products.</p>
          ) : products === null ? (
            <p className="text-sm text-[var(--color-muted)]">Loading products…</p>
          ) : (
            <>
              {products.length > 6 ? (
                <input
                  type="search"
                  aria-label="Search products"
                  placeholder="Search products"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                />
              ) : null}
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-1">
                {radio('', 'Automatic — the biggest discount')}
                {shown.map((product) => {
                  const off = discount(product);
                  return radio(product.id, product.name, off ? `${off}% off` : undefined);
                })}
              </ul>
              <p className="text-xs text-[var(--color-muted)]">
                Set a compare-at price on a product to show it as a discount. Without one, the deal shows the normal price.
              </p>
            </>
          )}
        </fieldset>
      </div>
    </Card>
  );
}
