'use client';

import { useEffect, useMemo, useState } from 'react';
import type { StoreThemeConfig, ThemeHomepageSection } from '@ecomesta/types';
import { CategoryImagesEditor } from '@/components/theme/category-images-editor';
import { Card } from '@/components/ui/card';
import { TextField, ToggleField } from '@/components/theme/theme-fields';
import { api } from '@/lib/api-client';

type Homepage = NonNullable<StoreThemeConfig['homepage']>;
export type HomeBlockType = 'featured_categories' | 'featured_products';

/** The most items a homepage block can feature (the API's limit). */
const MAX_FEATURED = 24;

export const HOME_BLOCKS: Record<HomeBlockType, { label: string; noun: string; plural: string; defaultTitle: string }> = {
  featured_categories: { label: 'Categories', noun: 'category', plural: 'categories', defaultTitle: 'Shop by category' },
  featured_products: { label: 'Products', noun: 'product', plural: 'products', defaultTitle: 'Featured products' },
};

/** Sections a merchant can add more than once: text and image content. */
export type ContentSectionType = 'rich_text' | 'image_banner';
export const CONTENT_SECTIONS: Record<ContentSectionType, { label: string; description: string }> = {
  rich_text: { label: 'Rich text', description: 'A heading, a few lines of text and a button.' },
  image_banner: { label: 'Image banner', description: 'A wide picture with a heading and a button on it.' },
};
export function isContentSection(type: string): type is ContentSectionType {
  return type === 'rich_text' || type === 'image_banner';
}
/** The API keeps at most this many homepage sections. */
export const MAX_HOME_SECTIONS = 10;

/** ShopEase's deal of the day as it ships. */
export const DEFAULT_DEAL_SECTION: ThemeHomepageSection = {
  type: 'deal_of_day',
  title: "Grab it before it's gone!",
  text: 'Today only — the offer ends at midnight.',
  buttonLabel: 'Shop the deal',
  showCountdown: true,
  enabled: true,
};

/**
 * Themes with sections of their own: a ShopEase draft saved before the deal
 * of the day was a section gets it where the storefront already shows it
 * (above the products), so the editor and the store agree.
 */
export function withThemeSections(config: StoreThemeConfig, themeSlug: string): StoreThemeConfig {
  if (themeSlug !== 'shopease') return config;
  const sections = effectiveHomeSections(config.homepage);
  if (sections.some((section) => section.type === 'deal_of_day')) return config;
  const at = sections.findIndex((section) => section.type === 'featured_products');
  const next = [...sections];
  next.splice(at < 0 ? next.length : at, 0, { ...DEFAULT_DEAL_SECTION });
  return { ...config, homepage: { ...config.homepage, sections: next } };
}

/** Editor/preview address of a section: its type, or `section:<id>` for content sections. */
export function sectionKey(section: ThemeHomepageSection, index: number): string {
  return isContentSection(section.type) ? `section:${section.id ?? index}` : section.type;
}

export function newSectionId(type: ContentSectionType): string {
  return `${type === 'rich_text' ? 'text' : 'banner'}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The homepage blocks as the storefront shows them: an empty list means both
 * product and category rows, in the default order.
 */
export function effectiveHomeSections(homepage: Homepage | undefined): ThemeHomepageSection[] {
  const listed = (homepage?.sections ?? []).filter(
    (section) =>
      section.type === 'featured_categories' ||
      section.type === 'featured_products' ||
      section.type === 'deal_of_day' ||
      isContentSection(section.type),
  );
  if ((homepage?.sections ?? []).length === 0) {
    return [
      { type: 'featured_categories', enabled: true },
      { type: 'featured_products', enabled: true },
    ];
  }
  return listed;
}

/** `homepage` with one block changed (the full list is written). */
export function patchHomeSection(
  homepage: Homepage,
  type: HomeBlockType,
  patch: Partial<ThemeHomepageSection>,
): Homepage {
  const sections = effectiveHomeSections(homepage);
  const exists = sections.some((section) => section.type === type);
  const next = exists
    ? sections.map((section) => (section.type === type ? { ...section, ...patch } : section))
    : [...sections, { type, title: HOME_BLOCKS[type].defaultTitle, enabled: true, ...patch }];
  return { ...homepage, sections: next };
}

type Option = { id: string; name: string; meta?: string; imageUrl?: string | null };

/** Loaded the first time the panel opens. */
function useOptions(storeId: string | null, type: HomeBlockType, active: boolean) {
  const [options, setOptions] = useState<Option[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!storeId || !active || options !== null) return;
    let cancelled = false;
    const path =
      type === 'featured_products'
        ? `/stores/${storeId}/products?limit=100&status=ACTIVE`
        : `/stores/${storeId}/categories?limit=100`;
    Promise.resolve()
      .then(() =>
        api.get<{ success: true; data: { items: { id: string; name: string; sku?: string | null; imageUrl?: string | null }[] } }>(path),
      )
      .then((result) => {
        if (cancelled) return;
        setOptions(
          result.data.items.map((item) => ({ id: item.id, name: item.name, meta: item.sku ?? undefined, imageUrl: item.imageUrl ?? null })),
        );
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, type, active, options]);
  return { options, error, setOptions };
}

/** Settings of one homepage block: show/hide, heading, and what it features. */
export function HomepageBlockPanel({
  type,
  storeId,
  value,
  onChange,
  disabled,
  active = true,
  onCatalogChange,
}: {
  type: HomeBlockType;
  storeId: string | null;
  value: Homepage;
  onChange: (next: Homepage) => void;
  disabled?: boolean;
  /** Whether the panel is open (the list loads then). */
  active?: boolean;
  /** A catalog change the preview should show (a category image saved). */
  onCatalogChange?: () => void;
}) {
  const block = HOME_BLOCKS[type];
  const section = effectiveHomeSections(value).find((item) => item.type === type);
  const idsKey = type === 'featured_products' ? 'featuredProducts' : 'featuredCategories';
  const selected = value[idsKey] ?? [];
  const { options, error, setOptions } = useOptions(storeId, type, active);
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (options ?? []).filter((option) => !q || option.name.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(id: string, checked: boolean) {
    const next = checked ? [...selected, id] : selected.filter((item) => item !== id);
    onChange({ ...value, [idsKey]: next });
  }

  return (
    <Card title={`${block.label} section`} description={`A row of ${block.plural} on your homepage.`}>
      <div className="grid gap-4">
        <ToggleField
          label="Show this section"
          checked={section ? section.enabled !== false : false}
          disabled={disabled}
          onChange={(enabled) => onChange(patchHomeSection(value, type, { enabled }))}
        />
        <TextField
          label="Heading"
          value={section?.title ?? ''}
          placeholder={block.defaultTitle}
          disabled={disabled}
          onChange={(title) => onChange(patchHomeSection(value, type, { title }))}
        />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[var(--color-ink)]">
            {block.label} to show{' '}
            <span className="font-normal text-[var(--color-muted)]">
              ({selected.length ? `${selected.length} chosen` : `newest ${block.plural} automatically`})
            </span>
          </legend>
          {error ? (
            <p className="text-sm text-[var(--color-danger)]">Could not load your {block.plural}.</p>
          ) : options === null ? (
            <p className="text-sm text-[var(--color-muted)]">Loading {block.plural}…</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">You have no {block.plural} yet.</p>
          ) : (
            <>
              {options.length > 6 ? (
                <input
                  type="search"
                  aria-label={`Search ${block.plural}`}
                  placeholder={`Search ${block.plural}`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                />
              ) : null}
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-1">
                {shown.map((option) => {
                  const checked = selected.includes(option.id);
                  return (
                    <li key={option.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[var(--color-bg)]">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled || (!checked && selected.length >= MAX_FEATURED)}
                          onChange={(event) => toggle(option.id, event.target.checked)}
                        />
                        <span className="min-w-0 flex-1 truncate">{option.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {selected.length ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...value, [idsKey]: [] })}
                  className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                >
                  Clear — show the newest {block.plural}
                </button>
              ) : null}
            </>
          )}
        </fieldset>
        {type === 'featured_categories' && options && options.length > 0 ? (
          <CategoryImagesEditor
            storeId={storeId}
            disabled={disabled}
            // The homepage's categories first, in their order.
            categories={[
              ...selected.map((id) => options.find((option) => option.id === id)).filter((option): option is Option => Boolean(option)),
              ...options.filter((option) => !selected.includes(option.id)),
            ]}
            onSaved={(id, imageUrl) => {
              setOptions((items) => items?.map((item) => (item.id === id ? { ...item, imageUrl } : item)) ?? items);
              onCatalogChange?.();
            }}
          />
        ) : null}
      </div>
    </Card>
  );
}
