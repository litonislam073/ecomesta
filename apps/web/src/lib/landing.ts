import type { PublicProductDetail } from '@ecomesta/types';
import type { LandingContent, LandingTemplateKey } from '@ecomesta/utils';
import { publicGet } from '@/lib/public-api';

/**
 * Landing page editor preview: the merchant's editor opens `/lp/{slug}?lp_preview=<token>`
 * and the page renders the editor's unsaved content (the API checks the token
 * belongs to this store).
 */
export const LANDING_PREVIEW_QUERY = 'lp_preview';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function readLandingPreviewToken(value: string | string[] | null | undefined): string | null {
  const token = Array.isArray(value) ? value[0] : value;
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

export interface PublicLandingPage {
  id: string;
  title: string;
  slug: string;
  template: LandingTemplateKey;
  content: LandingContent;
  currency: string;
  products: PublicProductDetail[];
  /** The editor's unsaved draft (never indexed, no marketing tags). */
  preview: boolean;
}

export async function fetchLandingPage(
  storeSlug: string,
  pageSlug: string,
  previewToken: string | null,
): Promise<PublicLandingPage> {
  const query = previewToken ? `?previewToken=${encodeURIComponent(previewToken)}` : '';
  const result = await publicGet<{ success: true; data: PublicLandingPage }>(
    `/public/stores/${encodeURIComponent(storeSlug)}/landing-pages/${encodeURIComponent(pageSlug)}${query}`,
    { fresh: !!previewToken },
  );
  return result.data;
}
