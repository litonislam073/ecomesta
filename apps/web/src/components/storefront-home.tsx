import type {
  PublicCategory,
  PublicProductCard,
  PublicStore,
  StoreThemeConfig,
} from '@ecomesta/types';
import { FeaturedCategories } from '@/components/storefront/featured-categories';
import { FeaturedProducts } from '@/components/storefront/featured-products';
import { ContentSection, homeSections } from '@/components/storefront/content-sections';
import { HeroSection } from '@/components/storefront/hero-section';
import { ShopEaseHome } from '@/components/storefront/shopease/shopease-home';
import { StorefrontProviders } from '@/components/storefront-providers';
import {
  STORE_UNAVAILABLE_METADATA,
  StoreUnavailable,
  isStoreUnavailableError,
} from '@/components/storefront/store-unavailable';
import { notFound } from 'next/navigation';
import { PublicApiError, publicGet } from '@/lib/public-api';
import {
  requirePublicStore,
  storeCanonicalUrl,
  storeMetadataBase,
} from '@/lib/store-resolver';
import { NOINDEX, resolveStoreSeo, storeOgLocale, storePageRobots } from '@/lib/store-seo';
import { fetchStoreTheme } from '@/lib/theme-server';
import { googleVerification } from '@/lib/tracking';
import type { Metadata } from 'next';

function pickFeatured<T extends { id: string }>(
  items: T[],
  ids: string[] | undefined,
  fallbackLimit: number,
): T[] {
  if (!ids?.length) {
    return items.slice(0, fallbackLimit);
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  const selected = ids
    .map((id) => byId.get(id))
    .filter((item): item is T => item !== undefined);
  return selected.length > 0 ? selected : items.slice(0, fallbackLimit);
}

async function loadHome(store: PublicStore, config: StoreThemeConfig) {
  const featuredProductIds = config.homepage?.featuredProducts ?? [];
  const limit = featuredProductIds.length > 0 ? 48 : 8;

  const [products, categories] = await Promise.all([
    publicGet<{
      success: true;
      data: { items: PublicProductCard[] };
    }>(
      `/public/stores/${store.slug}/products?limit=${limit}&sortBy=createdAt&sortOrder=desc`,
    ),
    publicGet<{
      success: true;
      data: { items: PublicCategory[] };
    }>(`/public/stores/${store.slug}/categories?tree=true`),
  ]);

  // The deal of the day may feature a product outside the newest few.
  const dealProductId = config.homepage?.sections?.find((section) => section.type === 'deal_of_day')?.productId;
  let dealProduct: PublicProductCard | null = null;
  if (dealProductId && !products.data.items.some((item) => item.id === dealProductId)) {
    try {
      const found = await publicGet<{ success: true; data: { items: PublicProductCard[] } }>(
        `/public/stores/${store.slug}/products?limit=1&ids=${encodeURIComponent(dealProductId)}`,
      );
      dealProduct = found.data.items[0] ?? null;
    } catch {
      dealProduct = null;
    }
  }

  return {
    dealProduct,
    products: pickFeatured(products.data.items, featuredProductIds, 8),
    categories: pickFeatured(
      categories.data.items,
      config.homepage?.featuredCategories,
      24,
    ),
  };
}

function sectionSettings(config: StoreThemeConfig, type: string) {
  const sections = config.homepage?.sections;
  if (!sections?.length) {
    return { enabled: true, title: undefined as string | undefined };
  }
  const match = sections.find((section) => section.type === type);
  if (!match) {
    return { enabled: false, title: undefined as string | undefined };
  }
  return {
    enabled: match.enabled !== false,
    title: match.title?.trim() || undefined,
  };
}

export async function storefrontHomeMetadata(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<Metadata> {
  try {
    const { store, storeSlug } = await requirePublicStore(searchParams);
    const { configuration } = await fetchStoreTheme(storeSlug);
    const branding = configuration.branding ?? {};
    const seo = resolveStoreSeo(store, configuration);
    const url = storeCanonicalUrl('/', storeSlug);

    return {
      title: seo.title,
      description: seo.description,
      keywords: seo.keywords,
      metadataBase: storeMetadataBase(storeSlug),
      alternates: url ? { canonical: url } : undefined,
      robots: storePageRobots(store, url),
      ...googleVerification(store),
      icons: branding.faviconUrl
        ? { icon: branding.faviconUrl }
        : store.faviconUrl
          ? { icon: store.faviconUrl }
          : undefined,
      openGraph: {
        title: seo.ogTitle,
        description: seo.ogDescription,
        url,
        siteName: branding.brandName?.trim() || store.name,
        locale: storeOgLocale(store),
        images: seo.ogImage ? [seo.ogImage] : undefined,
      },
    };
  } catch (err) {
    return isStoreUnavailableError(err)
      ? STORE_UNAVAILABLE_METADATA
      : { title: 'Storefront', robots: NOINDEX };
  }
}

export async function StorefrontHome({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  let resolved: Awaited<ReturnType<typeof requirePublicStore>>;
  try {
    resolved = await requirePublicStore(searchParams);
  } catch (err) {
    if (isStoreUnavailableError(err)) return <StoreUnavailable />;
    if (err instanceof PublicApiError && err.status === 404) notFound();
    throw err;
  }
  const { store, storeSlug } = resolved;
  const theme = await fetchStoreTheme(storeSlug);
  const { products, categories, dealProduct } = await loadHome(store, theme.configuration);

  const categoriesSection = sectionSettings(
    theme.configuration,
    'featured_categories',
  );
  const productsSection = sectionSettings(
    theme.configuration,
    'featured_products',
  );

  if (theme.theme?.slug === 'shopease') {
    return (
      <StorefrontProviders store={store} theme={theme}>
        <ShopEaseHome
          store={store}
          storeSlug={storeSlug}
          config={theme.configuration}
          products={products}
          categories={categories}
          showCategories={categoriesSection.enabled}
          showProducts={productsSection.enabled}
          categoriesTitle={categoriesSection.title}
          productsTitle={productsSection.title}
          sections={homeSections(theme.configuration)}
          dealProduct={dealProduct}
        />
      </StorefrontProviders>
    );
  }

  return (
    <StorefrontProviders store={store} theme={theme}>
      <div className="space-y-12">
        <HeroSection
          config={theme.configuration}
          storeSlug={storeSlug}
          fallbackHeadline={
            theme.configuration.branding?.brandName?.trim() || store.name
          }
          fallbackSubheadline={
            theme.configuration.branding?.tagline ?? store.description
          }
        />

        {homeSections(theme.configuration).map((section, index) =>
          section.type === 'featured_categories' ? (
            categoriesSection.enabled ? (
              <FeaturedCategories
                key={section.type}
                categories={categories}
                storeSlug={storeSlug}
                title={categoriesSection.title ?? 'Categories'}
              />
            ) : null
          ) : section.type === 'featured_products' ? (
            productsSection.enabled ? (
              <FeaturedProducts
                key={section.type}
                products={products}
                storeSlug={storeSlug}
                title={productsSection.title ?? 'Latest products'}
              />
            ) : null
          ) : (
            <ContentSection key={section.id ?? index} section={section} index={index} storeSlug={storeSlug} />
          ),
        )}
      </div>
    </StorefrontProviders>
  );
}
