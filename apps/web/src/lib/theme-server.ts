import { headers } from 'next/headers';
import type { PublicStoreTheme } from '@ecomesta/types';
import { fetchPublicTheme } from '@/lib/theme';
import { THEME_PREVIEW_HEADER, readThemePreviewToken } from '@/lib/theme-preview';

/** The editor's preview token for this request (set by the middleware), if any. */
export function themePreviewToken(): string | null {
  try {
    return readThemePreviewToken(headers().get(THEME_PREVIEW_HEADER));
  } catch {
    // Outside a request (tests, static generation): no preview.
    return null;
  }
}

/** The store's theme for this request: the editor's draft inside a preview, else the published one. */
export function fetchStoreTheme(storeSlug: string): Promise<PublicStoreTheme> {
  return fetchPublicTheme(storeSlug, themePreviewToken());
}
