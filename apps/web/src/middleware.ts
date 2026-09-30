import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  CANONICAL_HOST_COOKIE,
  CANONICAL_HOST_HEADER,
  STORE_SLUG_COOKIE,
  MARKETING_UNAVAILABLE_PATH,
  STORE_SLUG_HEADER,
  SUSPENDED_STORE_PATH,
  UNKNOWN_HOST_PATH,
  allowsStoreQueryOverride,
  isLoopbackHost,
  isMarketingPath,
  isPlatformMarketingHost,
  marketingApexRedirect,
  readStoreQuery,
  resolveHostname,
  selectRequestHost,
  shouldSkipPath,
  trustProxyEnabled,
} from '@/lib/domain-routing';

const COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax',
  httpOnly: false,
} as const;

/**
 * Request headers forwarded to the render. The store headers are the only
 * store context pages trust, so whatever the client sent is dropped and only
 * this middleware's decision is set.
 */
function forwardedHeaders(
  request: NextRequest,
  store?: { slug: string; canonicalHostname: string | null },
) {
  const headers = new Headers(request.headers);
  headers.delete(STORE_SLUG_HEADER);
  headers.delete(CANONICAL_HOST_HEADER);
  if (store) {
    headers.set(STORE_SLUG_HEADER, store.slug);
    if (store.canonicalHostname) {
      headers.set(CANONICAL_HOST_HEADER, store.canonicalHostname);
    }
  }
  return headers;
}

/** Continue without a store (marketing site, or a store route that will 404). */
function withoutStore(request: NextRequest) {
  return NextResponse.next({ request: { headers: forwardedHeaders(request) } });
}

/**
 * Produces a response that carries the resolved store both as request headers
 * (read during this render) and as cookies (the local-development and
 * API-outage fallbacks below).
 */
function withStore(
  request: NextRequest,
  storeSlug: string,
  canonicalHostname: string | null,
) {
  const headers = forwardedHeaders(request, { slug: storeSlug, canonicalHostname });
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(STORE_SLUG_COOKIE, storeSlug, COOKIE_OPTIONS);
  if (canonicalHostname) {
    response.cookies.set(
      CANONICAL_HOST_COOKIE,
      canonicalHostname,
      COOKIE_OPTIONS,
    );
  } else {
    response.cookies.delete(CANONICAL_HOST_COOKIE);
  }
  return response;
}

/**
 * Origin the visitor actually used. Behind a reverse proxy `request.nextUrl`
 * carries the server's internal origin (e.g. localhost:3000), so the scheme
 * and port come from the trusted proxy headers instead.
 */
function publicOrigin(request: NextRequest, hostname: string, trustProxy: boolean): string {
  const forwardedProto = trustProxy
    ? request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
    : undefined;
  const protocol =
    forwardedProto === 'https' || forwardedProto === 'http'
      ? `${forwardedProto}:`
      : request.nextUrl.protocol;
  const forwardedPort = trustProxy
    ? request.headers.get('x-forwarded-port')?.split(',')[0]?.trim()
    : undefined;
  const port = forwardedPort ?? (trustProxy ? '' : request.nextUrl.port);
  const defaultPort = protocol === 'https:' ? '443' : '80';
  return `${protocol}//${hostname}${port && port !== defaultPort ? `:${port}` : ''}`;
}

/**
 * Strip a conflicting `?store=` from the URL when the hostname already
 * resolved to an ACTIVE storefront (hostname wins). `hostname` is the resolved
 * store host, so the redirect cannot point anywhere else.
 */
function redirectWithoutStoreQuery(
  request: NextRequest,
  hostname: string,
  trustProxy: boolean,
) {
  const url = request.nextUrl.clone();
  url.searchParams.delete('store');
  return NextResponse.redirect(
    `${publicOrigin(request, hostname, trustProxy)}${url.pathname}${url.search}`,
    307,
  );
}

/**
 * Internal rewrite to one of the storefront's own pages. The standalone
 * server resolves middleware rewrites by proxying to its own plain-HTTP
 * origin, so the scheme inherited from X-Forwarded-Proto (https behind nginx)
 * must not be kept or that hop fails with a TLS error.
 */
function rewriteToPage(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  url.protocol = 'http:';
  return NextResponse.rewrite(url, { request: { headers: forwardedHeaders(request) } });
}

/**
 * Local development only: a store route keeps the store picked earlier with
 * `?store=` (cookie) or NEXT_PUBLIC_DEFAULT_STORE_SLUG. `/` stays the
 * marketing site.
 */
function localDevelopmentStore(request: NextRequest): string | null {
  if (request.nextUrl.pathname === '/') {
    return null;
  }
  return (
    readStoreQuery(request.cookies.get(STORE_SLUG_COOKIE)?.value) ??
    readStoreQuery(process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const trustProxy = trustProxyEnabled({
    TRUST_PROXY: process.env.TRUST_PROXY,
    TRUSTED_PROXY_HOPS: process.env.TRUSTED_PROXY_HOPS,
  });
  const hostname = selectRequestHost({
    hostHeader: request.headers.get('host'),
    forwardedHostHeader: request.headers.get('x-forwarded-host'),
    trustProxy,
  });

  const apexRedirect = marketingApexRedirect(hostname, pathname, request.nextUrl.search);
  if (apexRedirect) {
    return NextResponse.redirect(apexRedirect, 308);
  }

  if (shouldSkipPath(pathname)) {
    return withoutStore(request);
  }

  if (isMarketingPath(pathname) && !isPlatformMarketingHost(hostname)) {
    return rewriteToPage(request, MARKETING_UNAVAILABLE_PATH);
  }

  const fromQuery = readStoreQuery(searchParams.get('store'));

  // On loopback / *.localhost / *.local, `?store=` may override freely.
  if (fromQuery && allowsStoreQueryOverride(hostname)) {
    return withStore(request, fromQuery, null);
  }

  if (!hostname || isLoopbackHost(hostname)) {
    const devStore = localDevelopmentStore(request);
    return devStore ? withStore(request, devStore, null) : withoutStore(request);
  }

  const result = await resolveHostname(hostname);
  if (result.status === 'resolved') {
    // Hostname wins: ignore conflicting `?store=` (strip via redirect).
    if (fromQuery && fromQuery !== result.resolution.storeSlug) {
      return redirectWithoutStoreQuery(request, hostname, trustProxy);
    }
    return withStore(
      request,
      result.resolution.storeSlug,
      result.resolution.canonicalHostname,
    );
  }
  if (result.status === 'suspended') {
    const response = rewriteToPage(request, SUSPENDED_STORE_PATH);
    response.cookies.delete(STORE_SLUG_COOKIE);
    response.cookies.delete(CANONICAL_HOST_COOKIE);
    return response;
  }
  if (result.status === 'unavailable') {
    // API down: never honor `?store=` on production-style hosts (fail closed).
    // A store host keeps serving the store it resolved to before, from the
    // host-scoped cookies this middleware set on that earlier visit.
    const slug = readStoreQuery(request.cookies.get(STORE_SLUG_COOKIE)?.value);
    const canonical = readStoreQuery(request.cookies.get(CANONICAL_HOST_COOKIE)?.value);
    return slug && canonical && !isPlatformMarketingHost(hostname)
      ? withStore(request, slug, canonical)
      : withoutStore(request);
  }

  // Platform apex / www → SaaS homepage (not store-not-found). `?store=` is
  // ignored here: store routes on the apex have no store and answer 404.
  if (isPlatformMarketingHost(hostname)) {
    const response = withoutStore(request);
    response.cookies.delete(STORE_SLUG_COOKIE);
    response.cookies.delete(CANONICAL_HOST_COOKIE);
    return response;
  }

  // Unknown host: only allow `?store=` on explicitly permitted preview hosts.
  // Arbitrary DNS pointed at the storefront must not select a store via query.
  if (fromQuery && allowsStoreQueryOverride(hostname)) {
    return withStore(request, fromQuery, null);
  }

  const response = rewriteToPage(request, UNKNOWN_HOST_PATH);
  response.cookies.delete(STORE_SLUG_COOKIE);
  response.cookies.delete(CANONICAL_HOST_COOKIE);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
