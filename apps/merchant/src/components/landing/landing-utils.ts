import { storefrontUrl } from '@/lib/storefront-url';

/** Public address of a landing page: /lp/{slug} on the store's own address. */
export function landingPageUrl(storeSlug: string, pageSlug: string, previewToken?: string): string {
  const url = new URL(storefrontUrl(storeSlug));
  url.pathname = `/lp/${encodeURIComponent(pageSlug)}`;
  if (previewToken) url.searchParams.set('lp_preview', previewToken);
  return url.toString();
}

export const LANDING_PREVIEW_MESSAGE = 'ecomesta-landing-preview';

/**
 * A design with its demo content, for choosing a design. `lp_preview` lets the
 * merchant dashboard frame it (the storefront ignores the value).
 */
export function landingDemoUrl(storeSlug: string, template: string): string {
  const url = new URL(storefrontUrl(storeSlug));
  url.pathname = `/lp-demo/${encodeURIComponent(template)}`;
  url.searchParams.set('lp_preview', 'demo');
  return url.toString();
}
