import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { Request } from 'express';
import { createCorsDelegate } from './cors.config';
import {
  isPlatformOrigin,
  storefrontOriginHostname,
  storefrontStoreSlugFromPath,
} from './cors-policy';

describe('storefrontStoreSlugFromPath', () => {
  it('extracts the store slug from public store routes', () => {
    expect(storefrontStoreSlugFromPath('/api/v1/public/stores/demo-store')).toBe('demo-store');
    expect(storefrontStoreSlugFromPath('/api/v1/public/stores/demo-store/checkout')).toBe('demo-store');
    expect(storefrontStoreSlugFromPath('/api/v1/public/stores/Demo-Store/products?page=2')).toBe(
      'demo-store',
    );
  });

  it('ignores every other route', () => {
    for (const url of [
      undefined,
      '/api/v1/stores',
      '/api/v1/auth/refresh',
      '/api/v1/admin/stats',
      '/api/v1/public/plans',
      '/api/v1/public/domain/resolve?host=x',
      '/api/v1/public/payment-webhooks/STRIPE',
      '/api/v1/public/stores/',
      '/api/v1/public/stores/%zz/checkout',
      '/api/v1/public/stores/..%2Fadmin/checkout',
      '/api/v2/public/stores/demo-store',
    ]) {
      expect(storefrontStoreSlugFromPath(url)).toBeNull();
    }
  });
});

describe('storefrontOriginHostname', () => {
  const prod = { production: true };
  const dev = { production: false };

  it('accepts https origins on the default port in production', () => {
    expect(storefrontOriginHostname('https://demo-store.ecomesta.com', prod)).toBe(
      'demo-store.ecomesta.com',
    );
    expect(storefrontOriginHostname('https://Shop.Example.COM', prod)).toBe('shop.example.com');
  });

  it('rejects http, ports, paths, credentials and opaque origins in production', () => {
    for (const origin of [
      undefined,
      '',
      'null',
      'http://demo-store.ecomesta.com',
      'https://demo-store.ecomesta.com:8443',
      'https://demo-store.ecomesta.com/',
      'https://demo-store.ecomesta.com/path',
      'https://user:pw@demo-store.ecomesta.com',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'not a url',
    ]) {
      expect(storefrontOriginHostname(origin, prod)).toBeNull();
    }
  });

  it('allows http and ports outside production for local previews', () => {
    expect(storefrontOriginHostname('http://demo-store.ecomesta.local:3000', dev)).toBe(
      'demo-store.ecomesta.local',
    );
    expect(storefrontOriginHostname('ftp://demo-store.ecomesta.local', dev)).toBeNull();
  });
});

describe('isPlatformOrigin', () => {
  it('matches the configured list exactly', () => {
    const list = ['https://ecomesta.com', 'https://merchant.ecomesta.com'];
    expect(isPlatformOrigin('https://ecomesta.com', list)).toBe(true);
    expect(isPlatformOrigin('https://ecomesta.com/', list)).toBe(true);
    expect(isPlatformOrigin('https://evil-ecomesta.com', list)).toBe(false);
    expect(isPlatformOrigin('https://ecomesta.com.evil.com', list)).toBe(false);
    expect(isPlatformOrigin(undefined, list)).toBe(false);
  });
});

describe('createCorsDelegate', () => {
  const platformOrigins = ['https://ecomesta.com', 'https://merchant.ecomesta.com'];
  const storefront = {
    isStorefrontOriginFor: jest.fn(async (origin: string | undefined, slug: string) =>
      origin === 'https://demo-store.ecomesta.com' && slug === 'demo-store',
    ),
  };
  const delegate = createCorsDelegate({ platformOrigins, storefront });

  function optionsFor(url: string, origin?: string): Promise<CorsOptions> {
    const req = { headers: origin ? { origin } : {}, originalUrl: url, url } as unknown as Request;
    return new Promise((resolve, reject) => {
      delegate(req, (err, options) => (err ? reject(err) : resolve(options as CorsOptions)));
    });
  }

  beforeEach(() => storefront.isStorefrontOriginFor.mockClear());

  it('keeps the strict credentialed allow-list for platform origins', async () => {
    const options = await optionsFor('/api/v1/stores', 'https://merchant.ecomesta.com');
    expect(options).toEqual({ origin: platformOrigins, credentials: true });
    expect(storefront.isStorefrontOriginFor).not.toHaveBeenCalled();
  });

  it('grants a verified storefront its own public store routes without credentials', async () => {
    const options = await optionsFor(
      '/api/v1/public/stores/demo-store/checkout',
      'https://demo-store.ecomesta.com',
    );
    expect(options).toMatchObject({
      origin: 'https://demo-store.ecomesta.com',
      credentials: false,
      methods: ['GET', 'HEAD', 'POST'],
      allowedHeaders: ['Accept', 'Content-Type', 'Idempotency-Key'],
    });
  });

  it('never grants storefront origins on authenticated or non-store routes', async () => {
    for (const url of ['/api/v1/stores', '/api/v1/auth/refresh', '/api/v1/public/plans']) {
      const options = await optionsFor(url, 'https://demo-store.ecomesta.com');
      expect(options).toEqual({ origin: platformOrigins, credentials: true });
    }
    expect(storefront.isStorefrontOriginFor).not.toHaveBeenCalled();
  });

  it('falls back to the platform list for unverified origins', async () => {
    for (const origin of ['https://evil.example.com', 'https://unknown-shop.ecomesta.com']) {
      const options = await optionsFor('/api/v1/public/stores/demo-store/checkout', origin);
      expect(options).toEqual({ origin: platformOrigins, credentials: true });
    }
  });

  it('fails closed when the store lookup throws', async () => {
    storefront.isStorefrontOriginFor.mockRejectedValueOnce(new Error('db down'));
    const options = await optionsFor(
      '/api/v1/public/stores/demo-store/checkout',
      'https://demo-store.ecomesta.com',
    );
    expect(options).toEqual({ origin: platformOrigins, credentials: true });
  });
});
