import type { PublicCategory, PublicProductDetail } from '@ecomesta/types';
import { publicGet } from '@/lib/public-api';

/*
 * Product and category pages look their record up without the 30 s data
 * cache. Next only stores 200 responses, so once a product is archived,
 * unpublished or deleted the API's 404 would never replace the cached copy
 * and the page would keep showing the old product indefinitely. Within one
 * render, Next still dedupes the metadata and page lookups.
 */

export function fetchPublicProduct(storeSlug: string, productSlug: string) {
  return publicGet<{ success: true; data: PublicProductDetail }>(
    `/public/stores/${storeSlug}/products/${encodeURIComponent(productSlug)}`,
    { fresh: true },
  );
}

export function fetchPublicCategory(storeSlug: string, categorySlug: string) {
  return publicGet<{ success: true; data: PublicCategory }>(
    `/public/stores/${storeSlug}/categories/${encodeURIComponent(categorySlug)}`,
    { fresh: true },
  );
}
