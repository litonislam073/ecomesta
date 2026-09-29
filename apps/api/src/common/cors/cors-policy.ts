/**
 * Pure CORS rules. The API has two audiences:
 *
 * - Platform apps (web apex, merchant, admin, CORS_ORIGINS): a fixed allow-list
 *   with credentials, for every route.
 * - Storefronts (`{slug}.{root}` and ACTIVE custom domains): the public
 *   `/api/v1/public/stores/:storeSlug/*` routes only, without credentials, and
 *   only when the origin resolves to that same store (checked against the DB
 *   by StorefrontCorsService).
 *
 * Anything else gets no Access-Control-Allow-Origin.
 */

/** Methods a storefront browser may use against its public store routes. */
export const STOREFRONT_CORS_METHODS = ['GET', 'HEAD', 'POST'] as const;

/** Request headers the storefront sends (see apps/web/src/lib/public-api.ts). */
export const STOREFRONT_CORS_HEADERS = ['Accept', 'Content-Type', 'Idempotency-Key'] as const;

/** Browsers may cache a storefront preflight this long (seconds). */
export const STOREFRONT_CORS_MAX_AGE_SECONDS = 600;

const STORE_ROUTE = /^\/api\/v1\/public\/stores\/([^/?#]+)(?:[/?#]|$)/;

/**
 * Store slug addressed by a public storefront route, or null for every other
 * route (authenticated APIs, webhooks, domain resolution, plans).
 */
export function storefrontStoreSlugFromPath(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  const match = STORE_ROUTE.exec(url);
  if (!match?.[1]) {
    return null;
  }
  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  slug = slug.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]*$/.test(slug) ? slug : null;
}

/**
 * Hostname of a browser Origin that may belong to a storefront, or null.
 *
 * Production accepts only `https://host` on the default port. Other
 * environments also accept `http://` and explicit ports for local previews
 * such as `http://demo-store.ecomesta.local:3000`.
 */
export function storefrontOriginHostname(
  origin: string | undefined,
  options: { production: boolean },
): string | null {
  if (!origin || origin === 'null') {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return null;
  }
  // An Origin header is scheme://host[:port] and nothing else.
  if (
    parsed.username ||
    parsed.password ||
    (parsed.pathname !== '/' && parsed.pathname !== '') ||
    parsed.search ||
    parsed.hash ||
    origin.endsWith('/')
  ) {
    return null;
  }
  if (options.production) {
    if (parsed.protocol !== 'https:' || parsed.port !== '') {
      return null;
    }
  } else if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase();
  return hostname || null;
}

/** Exact-match check against the configured platform app origins. */
export function isPlatformOrigin(origin: string | undefined, platformOrigins: readonly string[]): boolean {
  if (!origin) {
    return false;
  }
  return platformOrigins.includes(origin.replace(/\/$/, ''));
}
