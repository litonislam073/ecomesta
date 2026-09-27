/**
 * Edge-safe host resolution shared by `middleware.ts` and the server
 * components. Deliberately free of `next/headers` and Node built-ins so the
 * middleware bundle stays valid.
 */

export const STORE_SLUG_COOKIE = 'ecomesta.storeSlug';
export const CANONICAL_HOST_COOKIE = 'ecomesta.canonicalHost';

/** Request headers the middleware injects for the current render. */
export const STORE_SLUG_HEADER = 'x-ecomesta-store-slug';
export const CANONICAL_HOST_HEADER = 'x-ecomesta-canonical-host';

/** Path the middleware rewrites to when a host maps to no storefront. */
export const UNKNOWN_HOST_PATH = '/store-not-found';
export const SUSPENDED_STORE_PATH = '/store-unavailable';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

/**
 * Hosts that never carry a storefront. `.local` is intentionally absent:
 * `{slug}.ecomesta.local` is the documented local development host.
 */
export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.localhost');
}

/**
 * Hosts where an explicit `?store=` override is allowed (platform preview /
 * local multi-tenant). Custom production domains must ignore conflicting
 * `?store=` once the hostname resolves.
 */
export function allowsStoreQueryOverride(hostname: string | null): boolean {
  if (!hostname) {
    return true;
  }
  if (isLoopbackHost(hostname)) {
    return true;
  }
  // Platform preview / mDNS-style local hosts (not a resolved custom domain).
  // Note: apex `something.local` is treated as marketing host, not override.
  if (hostname.endsWith('.local') && hostname.split('.').length > 2) {
    return true;
  }
  return false;
}

/**
 * Platform marketing hosts (SaaS homepage) — not merchant storefronts.
 * Uses NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN when set (edge-safe).
 */
export function isPlatformMarketingHost(hostname: string | null): boolean {
  if (!hostname || isLoopbackHost(hostname)) {
    return true;
  }
  const root = (
    process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN ||
    process.env.PLATFORM_ROOT_DOMAIN ||
    'ecomesta.local'
  )
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, '');
  if (!root) {
    return false;
  }
  if (hostname === root || hostname === `www.${root}`) {
    return true;
  }
  // Reserved fixed apex used in platform docs.
  if (hostname === 'ecomesta.com' || hostname === 'www.ecomesta.com') {
    return true;
  }
  return false;
}

/** Lowercases and strips the port / IPv6 brackets from a Host header. */
export function normalizeHost(header: string | null | undefined): string | null {
  if (!header) {
    return null;
  }
  // `x-forwarded-host` may carry a proxy chain.
  const first = header.split(',')[0]?.trim().toLowerCase() ?? '';
  if (!first) {
    return null;
  }
  if (first.startsWith('[')) {
    const close = first.indexOf(']');
    return close === -1 ? null : first.slice(1, close);
  }
  const host = first.split(':')[0] ?? '';
  return host.replace(/\.+$/, '') || null;
}

/**
 * Select Host vs X-Forwarded-Host based on TRUST_PROXY / TRUSTED_PROXY_HOPS.
 * Default (local): ignore X-Forwarded-Host so clients cannot spoof a custom domain.
 * Production behind nginx: trust X-Forwarded-Host only when the edge overwrites it.
 */
export function trustProxyEnabled(
  env: Record<string, string | undefined> = {},
): boolean {
  const flag = env.TRUST_PROXY?.trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') {
    return true;
  }
  if (flag === 'false' || flag === '0' || flag === 'no') {
    return false;
  }
  const hops = Number(env.TRUSTED_PROXY_HOPS ?? '');
  return Number.isFinite(hops) && hops >= 1;
}

export function selectRequestHost(input: {
  hostHeader: string | null | undefined;
  forwardedHostHeader: string | null | undefined;
  trustProxy: boolean;
}): string | null {
  const raw = input.trustProxy
    ? (input.forwardedHostHeader ?? input.hostHeader)
    : input.hostHeader;
  return normalizeHost(raw);
}

const SKIPPED_PREFIXES = ['/_next/', '/api/', '/__nextjs', '/og/', '/brand/'];

/**
 * Platform marketing routes. They only exist on the platform apex / loopback;
 * on a storefront host they must 404 rather than render SaaS pages.
 */
const MARKETING_PATH_PREFIXES = [
  '/features',
  '/payments',
  '/shipping',
  '/pricing',
  '/solutions',
  '/resources',
  '/blog',
  '/faq',
  '/about',
  '/contact',
  '/login',
  '/register',
];

/** Unrouted path the middleware rewrites to so Next serves its 404. */
export const MARKETING_UNAVAILABLE_PATH = '/__marketing-unavailable';

export function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
const SKIPPED_PATHS = new Set([
  '/favicon.ico',
  '/icon.png',
  '/apple-icon.png',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
]);

/** Asset and API-ish paths that must not pay for a host lookup. */
export function shouldSkipPath(pathname: string): boolean {
  return (
    SKIPPED_PATHS.has(pathname) ||
    SKIPPED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname === UNKNOWN_HOST_PATH ||
    pathname === SUSPENDED_STORE_PATH
  );
}

export function readStoreQuery(value: string | null | undefined): string | null {
  const slug = value?.trim().toLowerCase();
  return slug || null;
}

export interface HostResolution {
  storeSlug: string;
  canonicalHostname: string;
}

export type HostResolutionResult =
  /** The host maps to an ACTIVE storefront. */
  | { status: 'resolved'; resolution: HostResolution }
  /** The API answered 404 — no storefront owns this host. */
  | { status: 'unknown' }
  /** The host belongs to a store that is temporarily suspended. */
  | { status: 'suspended' }
  /** The API could not be reached; fall back instead of hard-404ing. */
  | { status: 'unavailable' };

interface ResolveResponse {
  success: true;
  data: {
    hostname: string;
    canonicalHostname: string;
    store: { slug: string };
  };
}

function apiBaseUrl(): string {
  const base =
    process.env.API_INTERNAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001/api/v1';
  return base.replace(/\/$/, '');
}

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;

/**
 * Middleware runs outside the Next data cache, so a bounded per-instance map
 * keeps a burst of storefront requests from fanning out to the API. The API
 * itself is Redis-backed, so the TTL only has to absorb the burst.
 */
const cache = new Map<string, { expiresAt: number; value: HostResolution | null }>();

export function clearHostResolutionCache(): void {
  cache.clear();
}

export async function resolveHostname(
  hostname: string,
): Promise<HostResolutionResult> {
  const cached = cache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
      ? { status: 'resolved', resolution: cached.value }
      : { status: 'unknown' };
  }

  let value: HostResolution | null = null;
  try {
    const response = await fetch(
      `${apiBaseUrl()}/public/domain/resolve?host=${encodeURIComponent(hostname)}`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' },
    );
    if (response.ok) {
      const payload = (await response.json()) as ResolveResponse;
      const slug = payload?.data?.store?.slug?.trim().toLowerCase();
      if (!slug) {
        return { status: 'unavailable' };
      }
      value = {
        storeSlug: slug,
        canonicalHostname:
          payload.data.canonicalHostname?.trim().toLowerCase() || hostname,
      };
    } else if (response.status === 403) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { code?: string };
      } | null;
      // Not cached, so a reactivated store comes back without waiting out the TTL.
      return payload?.error?.code === 'STORE_UNAVAILABLE'
        ? { status: 'suspended' }
        : { status: 'unavailable' };
    } else if (response.status !== 404) {
      // Upstream trouble: don't cache, and let the caller fall back to the
      // existing cookie/env resolution instead of hard-404ing a live store.
      return { status: 'unavailable' };
    }
  } catch {
    return { status: 'unavailable' };
  }

  if (cache.size >= CACHE_MAX_ENTRIES) {
    cache.clear();
  }
  cache.set(hostname, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value ? { status: 'resolved', resolution: value } : { status: 'unknown' };
}

/** `https://` everywhere except local development hosts. */
export function canonicalOrigin(hostname: string | null | undefined): string | null {
  if (!hostname) {
    return null;
  }
  const host = hostname.trim().toLowerCase();
  if (!host) {
    return null;
  }
  const insecure =
    isLoopbackHost(host) || host === 'localhost' || host.endsWith('.local');
  return `${insecure ? 'http' : 'https'}://${host}`;
}

export function canonicalUrl(
  hostname: string | null | undefined,
  path = '/',
): string | null {
  const origin = canonicalOrigin(hostname);
  if (!origin) {
    return null;
  }
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
