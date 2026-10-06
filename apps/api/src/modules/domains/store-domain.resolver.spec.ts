import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { StoreDomainResolver } from './store-domain.resolver';

/** storefrontOrigin(): where links back to a storefront (payment returns) must land. */
describe('StoreDomainResolver.storefrontOrigin', () => {
  const store = { id: 'store-1', slug: 'liton' };

  function resolverWith(env: Record<string, string>, primaryHostname: string | null) {
    const prisma = {
      domain: { findFirst: jest.fn().mockResolvedValue(primaryHostname ? { hostname: primaryHostname } : null) },
    } as unknown as PrismaService;
    const config = { get: (key: string) => env[key] } as unknown as ConfigService;
    return { resolver: new StoreDomainResolver(prisma, {} as RedisService, config), prisma };
  }

  it('uses the platform subdomain when the store has no primary custom domain', async () => {
    const { resolver } = resolverWith({ WEB_URL: 'https://ecomesta.com', PLATFORM_ROOT_DOMAIN: 'ecomesta.com', NODE_ENV: 'production' }, null);
    await expect(resolver.storefrontOrigin(store)).resolves.toBe('https://liton.ecomesta.com');
  });

  it('uses the primary ACTIVE domain (verified custom domain), without the platform port', async () => {
    const { resolver, prisma } = resolverWith({ WEB_URL: 'https://ecomesta.com:8443', PLATFORM_ROOT_DOMAIN: 'ecomesta.com', NODE_ENV: 'production' }, 'Shop.Example.com');
    await expect(resolver.storefrontOrigin(store)).resolves.toBe('https://shop.example.com');
    expect(prisma.domain.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'store-1', isPrimary: true, status: 'ACTIVE' } }),
    );
  });

  it('keeps WEB_URL’s port on the platform subdomain', async () => {
    const { resolver } = resolverWith({ WEB_URL: 'http://ecomesta.test:8080', PLATFORM_ROOT_DOMAIN: 'ecomesta.test' }, null);
    await expect(resolver.storefrontOrigin(store)).resolves.toBe('http://liton.ecomesta.test:8080');
  });

  it('falls back to the platform subdomain when the stored hostname is unusable', async () => {
    const { resolver } = resolverWith({ WEB_URL: 'https://ecomesta.com', PLATFORM_ROOT_DOMAIN: 'ecomesta.com', NODE_ENV: 'production' }, 'not a host/../@evil');
    await expect(resolver.storefrontOrigin(store)).resolves.toBe('https://liton.ecomesta.com');
  });

  it('serves every store from a loopback WEB_URL in local development', async () => {
    const { resolver, prisma } = resolverWith({ WEB_URL: 'http://localhost:3000', PLATFORM_ROOT_DOMAIN: 'ecomesta.local' }, 'shop.example.com');
    await expect(resolver.storefrontOrigin(store)).resolves.toBe('http://localhost:3000');
    expect(prisma.domain.findFirst).not.toHaveBeenCalled();
  });
});
