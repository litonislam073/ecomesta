import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { defaultLandingContent, isLandingTemplateKey, LANDING_TEMPLATES } from '@ecomesta/utils';
import { LandingPageView } from '@/components/landing/landing-page-view';
import { StoreUnavailable, isStoreUnavailableError } from '@/components/storefront/store-unavailable';
import { PublicApiError } from '@/lib/public-api';
import { fetchPublicStore, resolveStoreSlug } from '@/lib/store-resolver';
import { NOINDEX } from '@/lib/store-seo';

type Props = {
  params: { template: string };
  searchParams: Record<string, string | string[] | undefined>;
};

export function generateMetadata({ params }: Props): Metadata {
  const template = isLandingTemplateKey(params.template) ? LANDING_TEMPLATES[params.template] : null;
  return { title: { absolute: template ? `${template.name} — landing page design` : 'Landing page design' }, robots: NOINDEX };
}

/**
 * A landing page design with its demo text, pictures and products, for
 * merchants choosing a design. Nothing can be ordered here and it is never
 * indexed; the store only supplies its name.
 */
export default async function LandingDemoRoute({ params, searchParams }: Props) {
  if (!isLandingTemplateKey(params.template)) notFound();
  const storeSlug = await resolveStoreSlug(searchParams);
  if (!storeSlug) notFound();
  let store;
  try {
    store = await fetchPublicStore(storeSlug);
  } catch (err) {
    if (isStoreUnavailableError(err)) return <StoreUnavailable />;
    if (err instanceof PublicApiError && err.status === 404) notFound();
    throw err;
  }
  const template = params.template;
  return (
    <LandingPageView
      store={store}
      page={{
        id: `demo-${template}`,
        title: LANDING_TEMPLATES[template].name,
        slug: `demo-${template}`,
        template,
        content: defaultLandingContent(template),
        currency: store.currency,
        products: [],
        preview: true,
      }}
    />
  );
}
