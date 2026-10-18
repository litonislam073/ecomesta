import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { PublicStore } from '@ecomesta/types';
import { LandingPageView } from '@/components/landing/landing-page-view';
import { STORE_UNAVAILABLE_METADATA, StoreUnavailable, isStoreUnavailableError } from '@/components/storefront/store-unavailable';
import { LANDING_PREVIEW_QUERY, fetchLandingPage, readLandingPreviewToken, type PublicLandingPage } from '@/lib/landing';
import { PublicApiError } from '@/lib/public-api';
import { fetchPublicStore, resolveStoreSlug, storeCanonicalUrl, storeMetadataBase } from '@/lib/store-resolver';
import { NOINDEX, metaDescription, storeOgLocale, storePageRobots } from '@/lib/store-seo';
import { googleVerification } from '@/lib/tracking';

type Props = {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
};

async function load({ params, searchParams }: Props): Promise<{ store: PublicStore; page: PublicLandingPage } | null> {
  const storeSlug = await resolveStoreSlug(searchParams);
  if (!storeSlug) return null;
  const previewToken = readLandingPreviewToken(searchParams[LANDING_PREVIEW_QUERY]);
  try {
    const [store, page] = await Promise.all([fetchPublicStore(storeSlug), fetchLandingPage(storeSlug, params.slug, previewToken)]);
    return { store, page };
  } catch (err) {
    if (err instanceof PublicApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  try {
    const loaded = await load(props);
    if (!loaded) return { title: 'Not found', robots: NOINDEX };
    const { store, page } = loaded;
    const title = page.content.seo.title || page.title;
    const description = metaDescription(page.content.seo.description);
    const image = page.content.seo.imageUrl || page.products[0]?.images[0]?.url;
    const url = storeCanonicalUrl(`/lp/${encodeURIComponent(page.slug)}`, store.slug);
    return {
      title: { absolute: title },
      description,
      metadataBase: storeMetadataBase(store.slug),
      alternates: url ? { canonical: url } : undefined,
      robots: page.preview ? NOINDEX : storePageRobots(store, url),
      openGraph: { title, description, url, siteName: store.name, locale: storeOgLocale(store), images: image ? [image] : undefined },
      ...googleVerification(store),
    };
  } catch (err) {
    return isStoreUnavailableError(err) ? STORE_UNAVAILABLE_METADATA : { robots: NOINDEX };
  }
}

/** A merchant's landing page: its own full-page design, no store header or footer. */
export default async function LandingRoute(props: Props) {
  let loaded: Awaited<ReturnType<typeof load>>;
  try {
    loaded = await load(props);
  } catch (err) {
    if (isStoreUnavailableError(err)) return <StoreUnavailable />;
    throw err;
  }
  if (!loaded) notFound();
  return <LandingPageView page={loaded.page} store={loaded.store} />;
}
