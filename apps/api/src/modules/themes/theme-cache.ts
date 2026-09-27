/** Published-theme cache contract shared by the publish and public read paths. */
export const PUBLISHED_THEME_CACHE_TTL_SECONDS = 60;

export function publishedThemeCacheKey(storeId: string): string {
  return `storefront:theme:published:${storeId}`;
}
