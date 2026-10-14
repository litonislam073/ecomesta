import { storefrontUrl } from '@/lib/storefront-url';

/** Public address of a landing page: /lp/{slug} on the store's own address. */
export function landingPageUrl(storeSlug: string, pageSlug: string, previewToken?: string): string {
  const url = new URL(storefrontUrl(storeSlug));
  url.pathname = `/lp/${encodeURIComponent(pageSlug)}`;
  if (previewToken) url.searchParams.set('lp_preview', previewToken);
  return url.toString();
}

export const LANDING_PREVIEW_MESSAGE = 'ecomesta-landing-preview';
