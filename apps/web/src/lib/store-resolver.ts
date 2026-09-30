import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
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

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

/**
 * The store context the middleware decided for this request (SF-05). The
 * middleware drops any client-sent copy of these headers and applies the
 * routing rules: hostname first, `?store=` / cookie / env default only on
 * local and preview hosts. Pages must not read `?store=` themselves.
 */
function readStoreHeaders(): { storeSlug: string | null; canonicalHostname: string | null } {
  try {
    const bag = headers();
    return {
      storeSlug: clean(bag.get(STORE_SLUG_HEADER)),
      canonicalHostname: clean(bag.get(CANONICAL_HOST_HEADER)),
    };
  } catch {
    // Not in a request scope (e.g. static generation).
    return { storeSlug: null, canonicalHostname: null };
  }
}

/**
 * The store and canonical host when this request's hostname resolved to a
 * storefront; null for local/preview `?store=` selections, which have no
 * canonical host.
 */
export function readHostResolution(): HostResolution | null {
  const { storeSlug, canonicalHostname } = readStoreHeaders();
  return storeSlug && canonicalHostname ? { storeSlug, canonicalHostname } : null;
}

/**
 * Store serving this request, or null when there is none (marketing site, or
 * a store route that must 404). `searchParams` is accepted for existing call
 * sites but deliberately ignored: see readStoreHeaders.
 */
export async function resolveStoreSlug(
  _searchParams?: Record<string, string | string[] | undefined>,
): Promise<string | null> {
  return readStoreHeaders().storeSlug;
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
    notFound();
  }
  let store: PublicStore;
  try {
    store = await fetchPublicStore(storeSlug);
  } catch (err) {
    // A store that does not exist is a real 404, never a 200 error page.
    if (err instanceof PublicApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
  return {
    store,
    storeSlug,
    canonicalHostname: resolveCanonicalHostname(storeSlug),
  };
}

export { STORE_SLUG_COOKIE, CANONICAL_HOST_COOKIE };
