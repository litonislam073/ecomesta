import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Domain,
  DomainStatus,
  DomainType,
  Prisma,
  StoreStatus,
  TenantStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  DOMAIN_RESOLUTION_CACHE_TTL_SECONDS,
  domainResolutionCacheKey,
} from './domain-cache';
import {
  DEFAULT_PLATFORM_ROOT_DOMAIN,
  isPlatformControlHostname,
  platformSubdomainHostname,
  platformSubdomainSlug,
  validateHostname,
} from './domain-normalize';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface ResolvedStorefrontStore {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  currency: string;
  timezone: string;
  locale: string;
}

export interface ResolvedStorefront {
  hostname: string;
  domainType: DomainType;
  isPrimary: boolean;
  store: ResolvedStorefrontStore;
  canonicalHostname: string;
}

const STORE_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  faviconUrl: true,
  currency: true,
  timezone: true,
  locale: true,
} satisfies Prisma.StoreSelect;

/**
 * Maps an inbound Host header to a storefront. Owns platform-subdomain
 * provisioning so the merchant service and the public read path agree on the
 * `{slug}.{root}` contract.
 */
@Injectable()
export class StoreDomainResolver {
  readonly platformRootDomain: string;

  private readonly allowLocalHostnames: boolean;

  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.platformRootDomain = (
      config.get<string>('PLATFORM_ROOT_DOMAIN') ?? DEFAULT_PLATFORM_ROOT_DOMAIN
    )
      .trim()
      .toLowerCase();
    this.allowLocalHostnames =
      config.get<string>('NODE_ENV') !== 'production';
    this.webUrl = config.get<string>('WEB_URL') ?? 'http://localhost:3000';
  }

  /** Strips ports/protocol and applies the local-hostname policy. */
  normalize(hostname: string): string | null {
    const { hostname: normalized } = validateHostname(hostname, {
      allowLocal: this.allowLocalHostnames,
    });
    return normalized ?? null;
  }

  platformHostnameFor(storeSlug: string): string {
    return platformSubdomainHostname(storeSlug, this.platformRootDomain);
  }

  /** Store slug when `host` is `{slug}.{platform root}`, else null. */
  platformSlugFor(host: string): string | null {
    return platformSubdomainSlug(host, this.platformRootDomain);
  }

  async resolve(hostname: string): Promise<ResolvedStorefront | null> {
    const host = this.normalize(hostname);
    if (!host) {
      return null;
    }
    if (isPlatformControlHostname(host, this.platformRootDomain)) {
      return null;
    }

    const cached = await this.readCache(host);
    if (cached) {
      return cached;
    }

    const resolved =
      (await this.resolveRegisteredDomain(host)) ??
      (await this.resolvePlatformSubdomain(host));

    if (resolved) {
      await this.writeCache(host, resolved);
    }
    return resolved;
  }

  /**
   * Materialises the store's `{slug}.{root}` row. Idempotent: safe to call on
   * every merchant list request and from the public resolve path.
   */
  async ensurePlatformDomain(store: {
    id: string;
    slug: string;
  }): Promise<Domain> {
    const hostname = this.platformHostnameFor(store.slug);

    const existing = await this.prisma.domain.findFirst({
      where: { storeId: store.id, type: DomainType.SUBDOMAIN },
      orderBy: { createdAt: 'asc' },
    });

    if (existing) {
      if (existing.hostname.toLowerCase() === hostname) {
        return existing;
      }
      // The store slug changed; follow it unless another store got there first.
      try {
        return await this.prisma.domain.update({
          where: { id: existing.id },
          data: { hostname },
        });
      } catch {
        return existing;
      }
    }

    const conflict = await this.prisma.domain.findUnique({
      where: { hostname },
      select: { storeId: true },
    });
    if (conflict && conflict.storeId !== store.id) {
      throw new ConflictException(
        'The platform subdomain for this store slug is already taken',
      );
    }

    const primaryCount = await this.prisma.domain.count({
      where: { storeId: store.id, isPrimary: true },
    });

    try {
      return await this.prisma.domain.create({
        data: {
          storeId: store.id,
          hostname,
          type: DomainType.SUBDOMAIN,
          status: DomainStatus.ACTIVE,
          isPrimary: primaryCount === 0,
          verifiedAt: new Date(),
        },
      });
    } catch (error) {
      // Concurrent ensure() calls race on the unique hostname index.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const row = await this.prisma.domain.findUnique({ where: { hostname } });
        if (row && row.storeId === store.id) {
          return row;
        }
      }
      throw error;
    }
  }

  /** Primary ACTIVE hostname, falling back to the platform subdomain. */
  async canonicalHostname(store: {
    id: string;
    slug: string;
  }): Promise<string> {
    const primary = await this.prisma.domain.findFirst({
      where: {
        storeId: store.id,
        isPrimary: true,
        status: DomainStatus.ACTIVE,
      },
      select: { hostname: true },
    });
    return primary?.hostname.toLowerCase() ?? this.platformHostnameFor(store.slug);
  }

  /**
   * Public origin (scheme + host) of the store's storefront, for links that
   * must open on it — e.g. payment provider return URLs. The host comes only
   * from the store's own domain rows (its primary ACTIVE domain: a verified
   * custom domain or its platform subdomain), never from a request header; an
   * unusable hostname falls back to the platform subdomain. With a loopback
   * WEB_URL (local development) every store is served from that one origin
   * and picked with `?store=`.
   */
  async storefrontOrigin(store: { id: string; slug: string }): Promise<string> {
    const web = new URL(this.webUrl);
    if (LOOPBACK_HOSTNAMES.has(web.hostname)) {
      return web.origin;
    }
    const platformHost = this.platformHostnameFor(store.slug);
    const host = this.normalize(await this.canonicalHostname(store)) ?? platformHost;
    // Platform subdomains share WEB_URL's port; custom domains use the default one.
    const port = host === platformHost && web.port ? `:${web.port}` : '';
    return `${web.protocol}//${host}${port}`;
  }

  async invalidateHostname(hostname: string): Promise<void> {
    try {
      await this.redis.getClient().del(domainResolutionCacheKey(hostname));
    } catch {
      // Best-effort; the 60s TTL bounds staleness.
    }
  }

  /**
   * Any write to a store's domains can change the canonical hostname returned
   * for its other hosts, so the whole set is dropped together.
   */
  async invalidateStore(storeId: string): Promise<void> {
    const rows = await this.prisma.domain.findMany({
      where: { storeId },
      select: { hostname: true },
    });
    const keys = rows.map((row) =>
      domainResolutionCacheKey(row.hostname.toLowerCase()),
    );
    if (keys.length === 0) {
      return;
    }
    try {
      await this.redis.getClient().del(...keys);
    } catch {
      // Best-effort.
    }
  }

  // ---------------------------------------------------------------------------

  private async resolveRegisteredDomain(
    host: string,
  ): Promise<ResolvedStorefront | null> {
    const domain = await this.prisma.domain.findFirst({
      where: {
        hostname: host,
        status: DomainStatus.ACTIVE,
        store: {
          status: StoreStatus.ACTIVE,
          tenant: { status: TenantStatus.ACTIVE },
        },
      },
      select: {
        hostname: true,
        type: true,
        isPrimary: true,
        store: { select: STORE_SELECT },
      },
    });
    if (!domain) {
      return null;
    }

    return {
      hostname: domain.hostname.toLowerCase(),
      domainType: domain.type,
      isPrimary: domain.isPrimary,
      store: domain.store,
      canonicalHostname: await this.canonicalHostname(domain.store),
    };
  }

  private async resolvePlatformSubdomain(
    host: string,
  ): Promise<ResolvedStorefront | null> {
    const slug = platformSubdomainSlug(host, this.platformRootDomain);
    if (!slug) {
      return null;
    }

    const store = await this.prisma.store.findFirst({
      where: {
        slug,
        status: StoreStatus.ACTIVE,
        tenant: { status: TenantStatus.ACTIVE },
      },
      select: STORE_SELECT,
    });
    if (!store) {
      return null;
    }

    const domain = await this.ensurePlatformDomain(store);
    if (domain.status !== DomainStatus.ACTIVE) {
      return null;
    }
    return {
      hostname: domain.hostname.toLowerCase(),
      domainType: domain.type,
      isPrimary: domain.isPrimary,
      store,
      canonicalHostname: await this.canonicalHostname(store),
    };
  }

  private async readCache(host: string): Promise<ResolvedStorefront | null> {
    try {
      const raw = await this.redis.getClient().get(domainResolutionCacheKey(host));
      return raw ? (JSON.parse(raw) as ResolvedStorefront) : null;
    } catch {
      return null;
    }
  }

  private async writeCache(
    host: string,
    payload: ResolvedStorefront,
  ): Promise<void> {
    try {
      await this.redis
        .getClient()
        .set(
          domainResolutionCacheKey(host),
          JSON.stringify(payload),
          'EX',
          DOMAIN_RESOLUTION_CACHE_TTL_SECONDS,
        );
    } catch {
      // Storefront reads must not fail when Redis is unavailable.
    }
  }
}
