import { cookies } from 'next/headers';
import type { PublicStore } from '@ecomesta/types';
import { publicGet, PublicApiError } from '@/lib/public-api';

const COOKIE_KEY = 'ecomesta.storeSlug';

export function readStoreSlugFromSearch(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const raw = searchParams.store;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ? value.trim().toLowerCase() : null;
}

export async function resolveStoreSlug(
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<string | null> {
  const fromQuery = searchParams ? readStoreSlugFromSearch(searchParams) : null;
  if (fromQuery) {
    return fromQuery;
  }
  const fromEnv = process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG?.trim().toLowerCase();
  if (fromEnv) {
    return fromEnv;
  }
  const jar = cookies();
  const fromCookie = jar.get(COOKIE_KEY)?.value?.trim().toLowerCase();
  return fromCookie || null;
}

export async function fetchPublicStore(storeSlug: string): Promise<PublicStore> {
  const result = await publicGet<{ success: true; data: PublicStore }>(
    `/public/stores/${encodeURIComponent(storeSlug)}`,
  );
  return result.data;
}

export async function requirePublicStore(
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<{ store: PublicStore; storeSlug: string }> {
  const storeSlug = await resolveStoreSlug(searchParams);
  if (!storeSlug) {
    throw new PublicApiError(
      404,
      'STORE_REQUIRED',
      'Add ?store=your-store-slug to the URL (local multi-tenant resolution).',
    );
  }
  const store = await fetchPublicStore(storeSlug);
  return { store, storeSlug };
}

export { COOKIE_KEY as STORE_SLUG_COOKIE };
