import type { Metadata } from 'next';
import type { PublicStore, StoreThemeConfig } from '@ecomesta/types';

/** Merchant turned off search indexing in Settings → SEO. */
export function storeIndexingDisabled(store: Pick<PublicStore, 'seo'>): boolean {
  return store.seo?.indexingEnabled === false;
}

export function storeRobots(
  store: Pick<PublicStore, 'seo'>,
): Metadata['robots'] | undefined {
  return storeIndexingDisabled(store) ? { index: false, follow: false } : undefined;
}

export function storeLang(store: Pick<PublicStore, 'language' | 'locale'>): 'en' | 'bn' {
  if (store.language === 'bn' || store.language === 'en') return store.language;
  return store.locale?.toLowerCase().startsWith('bn') ? 'bn' : 'en';
}

export function storeOgLocale(store: Pick<PublicStore, 'language' | 'locale'>): string {
  return storeLang(store) === 'bn' ? 'bn_BD' : 'en_BD';
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const META_DESCRIPTION_MAX = 160;

/** Plain-text meta description: collapses whitespace and clips at a word boundary. */
export function metaDescription(value: string | null | undefined): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  if (text.length <= META_DESCRIPTION_MAX) return text;
  const clipped = text.slice(0, META_DESCRIPTION_MAX - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/**
 * Product/category metadata: the page's own title and description win; the
 * description falls back to the store SEO chain (store settings → theme → store).
 */
export function resolvePageSeo(params: {
  store: PublicStore;
  configuration: Pick<StoreThemeConfig, 'seo' | 'branding'> | null | undefined;
  pageTitle: string;
  pageDescriptions: (string | null | undefined)[];
}): { title: string; description: string } {
  const storeSeo = resolveStoreSeo(params.store, params.configuration);
  const own = params.pageDescriptions.map(metaDescription).find(Boolean);
  return {
    title: `${clean(params.pageTitle) || params.store.name} | ${params.store.name}`,
    description: own ?? metaDescription(storeSeo.description) ?? storeSeo.description,
  };
}

export interface ResolvedStoreSeo {
  title: string;
  description: string;
  keywords: string[] | undefined;
  ogTitle: string;
  ogDescription: string;
  ogImage: string | undefined;
}

/**
 * Store settings are the source of truth; the legacy theme `seo` block and
 * branding are fallbacks for stores that have not saved SEO settings yet.
 */
export function resolveStoreSeo(
  store: PublicStore,
  configuration: Pick<StoreThemeConfig, 'seo' | 'branding'> | null | undefined,
): ResolvedStoreSeo {
  const themeSeo = configuration?.seo ?? {};
  const branding = configuration?.branding ?? {};
  const seo = store.seo;

  const title =
    clean(seo?.title) ||
    clean(themeSeo.title) ||
    clean(branding.brandName) ||
    store.name;
  const description =
    clean(seo?.description) ||
    clean(themeSeo.description) ||
    clean(branding.tagline) ||
    clean(store.description) ||
    `Shop ${store.name}`;
  const keywords = seo?.keywords?.length
    ? seo.keywords
    : themeSeo.keywords?.length
      ? themeSeo.keywords
      : undefined;

  return {
    title,
    description,
    keywords,
    ogTitle: clean(seo?.ogTitle) || title,
    ogDescription: clean(seo?.ogDescription) || description,
    ogImage:
      clean(seo?.ogImageUrl) ||
      clean(themeSeo.ogImageUrl) ||
      clean(branding.logoUrl) ||
      clean(store.logoUrl),
  };
}
