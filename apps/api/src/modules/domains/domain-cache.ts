/** Public domain-resolution cache contract shared by the resolver and writes. */
export const DOMAIN_RESOLUTION_CACHE_TTL_SECONDS = 60;

export function domainResolutionCacheKey(hostname: string): string {
  return `storefront:domain:${hostname}`;
}
