import type { Prisma } from '@prisma/client';

/**
 * Live-vs-draft contract for store themes.
 *
 * - `StoreTheme.isActive` marks the merchant's *selected* theme: the draft the
 *   dashboard edits and previews. Selecting a theme never touches the
 *   storefront.
 * - The *live* theme is the store's row with the most recent `publishedAt`.
 *   Only publishing sets `publishedAt`, so publishing is the only operation
 *   that changes what visitors see, and a previously published theme stays
 *   live while another one is selected and edited.
 */
export function liveStoreThemeWhere(storeId: string): Prisma.StoreThemeWhereInput {
  return { storeId, publishedAt: { not: null } };
}

export const LIVE_STORE_THEME_ORDER: Prisma.StoreThemeOrderByWithRelationInput[] = [
  { publishedAt: 'desc' },
  { updatedAt: 'desc' },
];

/**
 * Timestamp for a new publish. It must sort after the current live row even
 * if clocks disagree, otherwise the older theme would stay live.
 */
export function nextPublishedAt(now: Date, currentLive: Date | null | undefined): Date {
  if (currentLive && currentLive.getTime() >= now.getTime()) {
    return new Date(currentLive.getTime() + 1);
  }
  return now;
}
