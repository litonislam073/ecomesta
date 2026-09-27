// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  canonicalOrigin,
  canonicalUrl,
  clearHostResolutionCache,
  isLoopbackHost,
  isMarketingPath,
  isPlatformMarketingHost,
  MARKETING_UNAVAILABLE_PATH,
  allowsStoreQueryOverride,
  normalizeHost,
  readStoreQuery,
  resolveHostname,
  selectRequestHost,
  shouldSkipPath,
  trustProxyEnabled,
} from '@/lib/domain-routing';
import { middleware } from '@/middleware';

const RESOLVED = {
  success: true,
  data: {
    hostname: 'shop.example.com',
    domainType: 'CUSTOM_DOMAIN',
    isPrimary: true,
    store: { slug: 'alpha', name: 'Alpha' },
    canonicalHostname: 'shop.example.com',
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function request(url: string, host?: string) {
  const headers = new Headers();
  if (host) {
    headers.set('host', host);
  }
  return new NextRequest(new URL(url), { headers });
}

/** Headers the middleware forwards to the render via `NextResponse.next`. */
function overriddenRequestHeader(
  response: NextResponse,
  name: string,
): string | null {
  return response.headers.get(`x-middleware-request-${name}`);
}

describe('host normalization', () => {
  it('lowercases and strips the port', () => {
    expect(normalizeHost('Shop.Example.COM:3000')).toBe('shop.example.com');
  });

  it('takes the first entry of a proxy chain', () => {
    expect(normalizeHost('shop.example.com, edge.internal')).toBe(
      'shop.example.com',
    );
  });

  it('unwraps bracketed IPv6 and drops the trailing dot', () => {
    expect(normalizeHost('[::1]:3000')).toBe('::1');
    expect(normalizeHost('shop.example.com.')).toBe('shop.example.com');
  });

  it('returns null for missing or empty hosts', () => {
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeHost('   ')).toBeNull();
  });
});

describe('loopback and path policy', () => {
  it('treats only loopback names as local', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('::1')).toBe(true);
    expect(isLoopbackHost('app.localhost')).toBe(true);
    // The documented local storefront host must still resolve.
    expect(isLoopbackHost('alpha.ecomesta.local')).toBe(false);
    expect(isLoopbackHost('shop.example.com')).toBe(false);
  });

  it('allows ?store= on loopback and multi-label .local preview hosts only', () => {
    expect(allowsStoreQueryOverride('localhost')).toBe(true);
    expect(allowsStoreQueryOverride('app.localhost')).toBe(true);
    expect(allowsStoreQueryOverride('alpha.ecomesta.local')).toBe(true);
    expect(allowsStoreQueryOverride('ecomesta.local')).toBe(false);
    expect(allowsStoreQueryOverride('shop.example.com')).toBe(false);
  });

  it('treats platform apex / loopback as marketing hosts', () => {
    expect(isPlatformMarketingHost('localhost')).toBe(true);
    expect(isPlatformMarketingHost('ecomesta.local')).toBe(true);
    expect(isPlatformMarketingHost('www.ecomesta.local')).toBe(true);
    expect(isPlatformMarketingHost('ecomesta.com')).toBe(true);
    expect(isPlatformMarketingHost('www.ecomesta.com')).toBe(true);
    expect(isPlatformMarketingHost('alpha.ecomesta.local')).toBe(false);
    expect(isPlatformMarketingHost('shop.example.com')).toBe(false);
  });

  it('selects Host vs X-Forwarded-Host based on trust', () => {
    expect(
      selectRequestHost({
        hostHeader: 'localhost:3000',
        forwardedHostHeader: 'shop.evil.com',
        trustProxy: false,
      }),
    ).toBe('localhost');
    expect(
      selectRequestHost({
        hostHeader: 'internal',
        forwardedHostHeader: 'shop.example.com',
        trustProxy: true,
      }),
    ).toBe('shop.example.com');
    expect(trustProxyEnabled({ TRUST_PROXY: 'true' })).toBe(true);
  });

  it('skips asset and API-ish paths', () => {
    expect(shouldSkipPath('/_next/data/x.json')).toBe(true);
    expect(shouldSkipPath('/api/anything')).toBe(true);
    expect(shouldSkipPath('/favicon.ico')).toBe(true);
    expect(shouldSkipPath('/robots.txt')).toBe(true);
    expect(shouldSkipPath('/brand/ecomesta-logo.png')).toBe(true);
    expect(shouldSkipPath('/icon.png')).toBe(true);
    expect(shouldSkipPath('/apple-icon.png')).toBe(true);
    expect(shouldSkipPath('/store-not-found')).toBe(true);
    expect(shouldSkipPath('/store-unavailable')).toBe(true);
    expect(shouldSkipPath('/products/mug')).toBe(false);
  });

  it('normalizes the ?store= override', () => {
    expect(readStoreQuery('  Alpha ')).toBe('alpha');
    expect(readStoreQuery('')).toBeNull();
    expect(readStoreQuery(null)).toBeNull();
  });
});

describe('resolveHostname', () => {
  beforeEach(() => {
    clearHostResolutionCache();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps a host to its store slug and canonical hostname', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(RESOLVED));

    await expect(resolveHostname('shop.example.com')).resolves.toEqual({
      status: 'resolved',
      resolution: {
        storeSlug: 'alpha',
        canonicalHostname: 'shop.example.com',
      },
    });

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('/public/domain/resolve?host=shop.example.com');
  });

  it('calls the private API_INTERNAL_URL when configured', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api:3001/api/v1/');
    vi.mocked(fetch).mockResolvedValue(jsonResponse(RESOLVED));

    await resolveHostname('shop.example.com');

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toBe('http://api:3001/api/v1/public/domain/resolve?host=shop.example.com');
    vi.unstubAllEnvs();
  });

  it('reports 404 hosts as unknown and caches the miss', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: false }, 404));

    await expect(resolveHostname('nope.example.com')).resolves.toEqual({
      status: 'unknown',
    });
    await expect(resolveHostname('nope.example.com')).resolves.toEqual({
      status: 'unknown',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports upstream failures as unavailable without caching', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: false }, 503));
    await expect(resolveHostname('shop.example.com')).resolves.toEqual({
      status: 'unavailable',
    });

    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    await expect(resolveHostname('shop.example.com')).resolves.toEqual({
      status: 'unavailable',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reports a suspended store without caching it, so reactivation shows up at once', async () => {
    const suspended = jsonResponse(
      { success: false, error: { code: 'STORE_UNAVAILABLE', message: 'This store is currently unavailable.' } },
      403,
    );
    vi.mocked(fetch).mockResolvedValueOnce(suspended);
    await expect(resolveHostname('paused.example.com')).resolves.toEqual({ status: 'suspended' });

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(RESOLVED));
    await expect(resolveHostname('paused.example.com')).resolves.toMatchObject({ status: 'resolved' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('treats other 403 responses as upstream trouble', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: false, error: { code: 'FORBIDDEN' } }, 403));
    await expect(resolveHostname('shop.example.com')).resolves.toEqual({ status: 'unavailable' });
  });
});

describe('canonical URLs', () => {
  it('uses https for public hosts and http locally', () => {
    expect(canonicalOrigin('shop.example.com')).toBe('https://shop.example.com');
    expect(canonicalOrigin('alpha.ecomesta.local')).toBe(
      'http://alpha.ecomesta.local',
    );
    expect(canonicalOrigin(null)).toBeNull();
  });

  it('joins paths onto the canonical origin', () => {
    expect(canonicalUrl('shop.example.com', '/products/mug')).toBe(
      'https://shop.example.com/products/mug',
    );
    expect(canonicalUrl('shop.example.com', 'cart')).toBe(
      'https://shop.example.com/cart',
    );
    expect(canonicalUrl(undefined, '/')).toBeNull();
  });
});

describe('middleware', () => {
  beforeEach(() => {
    clearHostResolutionCache();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serves platform apex without rewriting to store-not-found', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: false }, 404));

    const response = await middleware(
      request('http://ecomesta.local/', 'ecomesta.local'),
    );

    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.cookies.get('ecomesta.storeSlug')?.value).toBe('');
    expect(response.cookies.get('ecomesta.canonicalHost')?.value).toBe('');
  });

  it('rewrites a suspended store host to the neutral unavailable page', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ success: false, error: { code: 'STORE_UNAVAILABLE', message: 'x' } }, 403),
    );
    const response = await middleware(request('https://paused.example.com/checkout', 'paused.example.com'));
    expect(new URL(response.headers.get('x-middleware-rewrite')!).pathname).toBe('/store-unavailable');
    expect(response.cookies.get('ecomesta.storeSlug')?.value).toBe('');
  });

  it('lets ?store= win only on loopback / preview hosts', async () => {
    const response = await middleware(
      request('http://localhost:3000/products?store=Beta', 'localhost:3000'),
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(response.cookies.get('ecomesta.storeSlug')?.value).toBe('beta');
    expect(response.cookies.get('ecomesta.canonicalHost')?.value).toBe('');
    expect(overriddenRequestHeader(response, 'x-ecomesta-store-slug')).toBe(
      'beta',
    );
  });

  it('hostname wins over conflicting ?store= on a resolved custom domain', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(RESOLVED));

    const response = await middleware(
      request('https://shop.example.com/products?store=Beta', 'shop.example.com'),
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    // Conflicting override is stripped via redirect.
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('https://shop.example.com/products');
    expect(new URL(location!).searchParams.get('store')).toBeNull();
  });

  it('keeps the public host on the ?store= strip redirect behind a proxy', async () => {
    vi.stubEnv('TRUST_PROXY', 'true');
    vi.mocked(fetch).mockResolvedValue(jsonResponse(RESOLVED));

    const headers = new Headers();
    headers.set('host', 'localhost:3000');
    headers.set('x-forwarded-host', 'shop.example.com');
    headers.set('x-forwarded-proto', 'https');
    headers.set('x-forwarded-port', '443');
    const response = await middleware(
      new NextRequest(new URL('https://localhost:3000/cart?store=beta&x=1'), { headers }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://shop.example.com/cart?x=1');
    vi.unstubAllEnvs();
  });

  it('rewrites over plain http even when the proxy reports https', async () => {
    vi.stubEnv('TRUST_PROXY', 'true');
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: false }, 404));

    const headers = new Headers();
    headers.set('host', 'localhost:3000');
    headers.set('x-forwarded-host', 'ghost.example.com');
    headers.set('x-forwarded-proto', 'https');
    const response = await middleware(
      new NextRequest(new URL('https://localhost:3000/'), { headers }),
    );

    const rewrite = new URL(response.headers.get('x-middleware-rewrite')!);
    expect(rewrite.protocol).toBe('http:');
    expect(rewrite.pathname).toBe('/store-not-found');
    vi.unstubAllEnvs();
  });

  it('ignores spoofed X-Forwarded-Host when trust proxy is off', async () => {
    vi.stubEnv('TRUST_PROXY', 'false');
    vi.mocked(fetch).mockResolvedValue(jsonResponse(RESOLVED));

    const headers = new Headers();
    headers.set('host', 'localhost:3000');
    headers.set('x-forwarded-host', 'shop.example.com');
    const response = await middleware(
      new NextRequest(new URL('http://localhost:3000/'), { headers }),
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(response.cookies.get('ecomesta.storeSlug')).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it('resolves a custom domain into cookies and request headers', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(RESOLVED));

    const response = await middleware(
      request('https://shop.example.com/', 'shop.example.com'),
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(response.cookies.get('ecomesta.storeSlug')?.value).toBe('alpha');
    expect(response.cookies.get('ecomesta.canonicalHost')?.value).toBe(
      'shop.example.com',
    );
    expect(overriddenRequestHeader(response, 'x-ecomesta-store-slug')).toBe(
      'alpha',
    );
    expect(overriddenRequestHeader(response, 'x-ecomesta-canonical-host')).toBe(
      'shop.example.com',
    );
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('resolves the platform subdomain the same way', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...RESOLVED.data,
          hostname: 'alpha.ecomesta.local',
          domainType: 'SUBDOMAIN',
          canonicalHostname: 'alpha.ecomesta.local',
        },
      }),
    );

    const response = await middleware(
      request('http://alpha.ecomesta.local/', 'alpha.ecomesta.local:3000'),
    );

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('host=alpha.ecomesta.local');
    expect(response.cookies.get('ecomesta.storeSlug')?.value).toBe('alpha');
  });

  it('rewrites unknown hosts to the storefront 404 page', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: false }, 404));

    const response = await middleware(
      request('https://ghost.example.com/products', 'ghost.example.com'),
    );

    const rewrite = response.headers.get('x-middleware-rewrite');
    expect(rewrite).not.toBeNull();
    expect(new URL(rewrite!).pathname).toBe('/store-not-found');
    expect(response.cookies.get('ecomesta.storeSlug')?.value).toBe('');
  });

  it('falls through instead of 404ing when the resolve API is down', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    const response = await middleware(
      request('https://shop.example.com/', 'shop.example.com'),
    );

    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.cookies.get('ecomesta.storeSlug')).toBeUndefined();
  });

  it('does not honor ?store= on a production host when the resolve API is down', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    const response = await middleware(
      request(
        'https://shop.example.com/products?store=Beta',
        'shop.example.com',
      ),
    );

    expect(response.cookies.get('ecomesta.storeSlug')).toBeUndefined();
    expect(overriddenRequestHeader(response, 'x-ecomesta-store-slug')).toBeNull();
    const rewrite = new URL(response.headers.get('x-middleware-rewrite')!);
    expect(rewrite.pathname).toBe('/products');
    expect(rewrite.searchParams.has('store')).toBe(false);
  });

  it('keeps other query params when stripping ?store= during an outage', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    const response = await middleware(
      request(
        'https://shop.example.com/search?q=shoes&store=beta&page=2',
        'shop.example.com',
      ),
    );

    const rewrite = new URL(response.headers.get('x-middleware-rewrite')!);
    expect(rewrite.protocol).toBe('http:');
    expect(rewrite.pathname).toBe('/search');
    expect(rewrite.search).toBe('?q=shoes&page=2');
  });

  it('does not honor ?store= on an unknown production host', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: false }, 404));

    const response = await middleware(
      request('https://ghost.example.com/?store=Beta', 'ghost.example.com'),
    );

    const rewrite = response.headers.get('x-middleware-rewrite');
    expect(rewrite).not.toBeNull();
    expect(new URL(rewrite!).pathname).toBe('/store-not-found');
    expect(response.cookies.get('ecomesta.storeSlug')?.value).toBe('');
  });

  it('never resolves on localhost, keeping the existing cookie behavior', async () => {
    const response = await middleware(
      request('http://localhost:3000/products', 'localhost:3000'),
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(response.cookies.get('ecomesta.storeSlug')).toBeUndefined();
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('skips resolution for API-ish paths', async () => {
    const response = await middleware(
      request('https://shop.example.com/api/health', 'shop.example.com'),
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });
});

describe('marketing paths', () => {
  it('matches marketing routes without catching storefront routes', () => {
    expect(isMarketingPath('/features')).toBe(true);
    expect(isMarketingPath('/features/order-management')).toBe(true);
    expect(isMarketingPath('/payments')).toBe(true);
    expect(isMarketingPath('/blog/some-post')).toBe(true);
    expect(isMarketingPath('/login')).toBe(true);
    expect(isMarketingPath('/')).toBe(false);
    expect(isMarketingPath('/payment/success')).toBe(false);
    expect(isMarketingPath('/products/mug')).toBe(false);
    expect(isMarketingPath('/featuresx')).toBe(false);
    expect(isMarketingPath('/track-order')).toBe(false);
  });
});

describe('middleware marketing guard', () => {
  beforeEach(() => {
    clearHostResolutionCache();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function rewrittenPath(response: NextResponse): string | null {
    const rewrite = response.headers.get('x-middleware-rewrite');
    return rewrite ? new URL(rewrite).pathname : null;
  }

  it('serves marketing pages on localhost', async () => {
    const response = await middleware(
      request('http://localhost:3000/pricing', 'localhost:3000'),
    );
    expect(rewrittenPath(response)).toBeNull();
  });

  it('serves marketing pages on the platform apex', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: false }, 404));
    const response = await middleware(
      request('http://ecomesta.local/features/coupons', 'ecomesta.local'),
    );
    expect(rewrittenPath(response)).toBeNull();
  });

  it('hides marketing pages on a custom store domain', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(RESOLVED));
    const response = await middleware(
      request('https://shop.example.com/features', 'shop.example.com'),
    );
    expect(rewrittenPath(response)).toBe(MARKETING_UNAVAILABLE_PATH);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('hides marketing pages on a store subdomain', async () => {
    const response = await middleware(
      request('http://alpha.ecomesta.local/pricing', 'alpha.ecomesta.local'),
    );
    expect(rewrittenPath(response)).toBe(MARKETING_UNAVAILABLE_PATH);
  });

  it('does not let ?store= expose marketing pages on a store domain', async () => {
    const response = await middleware(
      request('https://shop.example.com/login?store=beta', 'shop.example.com'),
    );
    expect(rewrittenPath(response)).toBe(MARKETING_UNAVAILABLE_PATH);
    expect(response.cookies.get('ecomesta.storeSlug')).toBeUndefined();
  });

  it('leaves storefront payment routes on a custom domain untouched', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(RESOLVED));
    const response = await middleware(
      request('https://shop.example.com/payment/success', 'shop.example.com'),
    );
    expect(rewrittenPath(response)).toBeNull();
    expect(response.cookies.get('ecomesta.storeSlug')?.value).toBe('alpha');
  });
});
