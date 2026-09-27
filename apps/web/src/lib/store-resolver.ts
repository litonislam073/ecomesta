import { cookies, headers } from 'next/headers';
import type { PublicStore } from '@ecomesta/types';
import {
  CANONICAL_HOST_COOKIE,
  CANONICAL_HOST_HEADER,
  STORE_SLUG_COOKIE,
  STORE_SLUG_HEADER,
  canonicalOrigin,
  canonicalUrl,
  type HostResolution,
} from '@/lib/domain-routing';
import { publicGet, PublicApiError } from '@/lib/public-api';

export function readStoreSlugFromSearch(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const raw = searchParams.store;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ? value.trim().toLowerCase() : null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

/**
 * What the middleware learned from the inbound Host header. Request headers
 * describe *this* request; the cookies are the client-navigation fallback.
 */
export function readHostResolution(): HostResolution | null {
  let storeSlug: string | null = null;
  let canonicalHostname: string | null = null;

  try {
    const bag = headers();
    storeSlug = clean(bag.get(STORE_SLUG_HEADER));
    canonicalHostname = clean(bag.get(CANONICAL_HOST_HEADER));
  } catch {
    // Not in a request scope (e.g. static generation).
  }

  if (!storeSlug || !canonicalHostname) {
    try {
      const jar = cookies();
      storeSlug = storeSlug ?? clean(jar.get(STORE_SLUG_COOKIE)?.value);
      canonicalHostname =
        canonicalHostname ?? clean(jar.get(CANONICAL_HOST_COOKIE)?.value);
    } catch {
      // Same as above.
    }
  }

  // A canonical host is only ever set by hostname resolution, so its presence
  // is what separates a real custom-domain hit from a `?store=` cookie.
  return storeSlug && canonicalHostname
    ? { storeSlug, canonicalHostname }
    : null;
}

export async function resolveStoreSlug(
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<string | null> {
  // Hostname resolution outranks `?store=` when the middleware attached a
  // canonical host (custom / platform domain hit). Conflicting query overrides
  // are stripped at the edge; remaining `?store=` is only for preview hosts.
  const fromHost = readHostResolution();
  if (fromHost) {
    return fromHost.storeSlug;
  }

  const fromQuery = searchParams ? readStoreSlugFromSearch(searchParams) : null;
  if (fromQuery) {
    return fromQuery;
  }

  const fromEnv = clean(process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG);
  if (fromEnv) {
    return fromEnv;
  }
  try {
    return clean(cookies().get(STORE_SLUG_COOKIE)?.value);
  } catch {
    return null;
  }
}

/** Primary hostname for the store serving this request, when known. */
export function resolveCanonicalHostname(storeSlug?: string | null): string | null {
  const fromHost = readHostResolution();
  if (!fromHost) {
    return null;
  }
  if (storeSlug && fromHost.storeSlug !== storeSlug) {
    // A `?store=` override is previewing a different store; its canonical
    // host is unknown here, so emit none rather than the wrong one.
    return null;
  }
  return fromHost.canonicalHostname;
}

/** `metadataBase` for a store, or undefined so Next keeps relative URLs. */
export function storeMetadataBase(storeSlug?: string | null): URL | undefined {
  const origin = canonicalOrigin(resolveCanonicalHostname(storeSlug));
  if (!origin) {
    return undefined;
  }
  try {
    return new URL(origin);
  } catch {
    return undefined;
  }
}

/** Absolute canonical URL for a storefront path, or undefined when unknown. */
export function storeCanonicalUrl(
  path: string,
  storeSlug?: string | null,
): string | undefined {
  return canonicalUrl(resolveCanonicalHostname(storeSlug), path) ?? undefined;
}

/**
 * Store settings (name, contact, checkout rules, SEO, indexing) must apply on
 * the next request after a merchant saves, so this payload skips the 30s data
 * cache. Next still dedupes the call within a single render.
 */
export async function fetchPublicStore(storeSlug: string): Promise<PublicStore> {
  const result = await publicGet<{ success: true; data: PublicStore }>(
    `/public/stores/${encodeURIComponent(storeSlug)}`,
    { fresh: true },
  );
  return result.data;
}

export async function requirePublicStore(
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<{
  store: PublicStore;
  storeSlug: string;
  canonicalHostname: string | null;
}> {
  const storeSlug = await resolveStoreSlug(searchParams);
  if (!storeSlug) {
    throw new PublicApiError(
      404,
      'STORE_REQUIRED',
      'This storefront could not be resolved. Open your store’s custom domain or platform subdomain.',
    );
  }
  const store = await fetchPublicStore(storeSlug);
  return {
    store,
    storeSlug,
    canonicalHostname: resolveCanonicalHostname(storeSlug),
  };
}

export { STORE_SLUG_COOKIE, CANONICAL_HOST_COOKIE };
