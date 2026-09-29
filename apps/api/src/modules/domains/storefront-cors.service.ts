import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { storefrontOriginHostname } from '../../common/cors/cors-policy';
import { StoreDomainResolver } from './store-domain.resolver';

const NEGATIVE_CACHE_TTL_MS = 60_000;
const NEGATIVE_CACHE_MAX_ENTRIES = 5_000;

/**
 * Decides whether a browser Origin is the storefront of a given store.
 * Resolution goes through StoreDomainResolver (Redis-cached, ACTIVE store +
 * ACTIVE tenant + ACTIVE domain), so a suspended store, a PENDING custom
 * domain or an unknown subdomain never gains CORS access.
 */
@Injectable()
export class StorefrontCorsService {
  private readonly logger = new Logger(StorefrontCorsService.name);
  private readonly production: boolean;
  /** Hosts that recently failed to resolve; bounds DB work from preflight floods. */
  private readonly unresolved = new Map<string, number>();

  constructor(
    private readonly resolver: StoreDomainResolver,
    config: ConfigService,
  ) {
    this.production = config.get<string>('NODE_ENV') === 'production';
  }

  async isStorefrontOriginFor(origin: string | undefined, storeSlug: string): Promise<boolean> {
    const hostname = storefrontOriginHostname(origin, { production: this.production });
    if (!hostname) {
      return false;
    }

    // A platform subdomain names its store; a mismatch needs no lookup.
    const platformSlug = this.resolver.platformSlugFor(hostname);
    if (platformSlug && platformSlug !== storeSlug) {
      return false;
    }

    if (this.recentlyUnresolved(hostname)) {
      return false;
    }

    try {
      const resolved = await this.resolver.resolve(hostname);
      if (!resolved) {
        this.rememberUnresolved(hostname);
        return false;
      }
      return resolved.store.slug.toLowerCase() === storeSlug;
    } catch (error) {
      // Fail closed: no CORS grant when the store cannot be verified.
      this.logger.warn(
        `Storefront CORS lookup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return false;
    }
  }

  private recentlyUnresolved(hostname: string): boolean {
    const expiresAt = this.unresolved.get(hostname);
    if (expiresAt === undefined) {
      return false;
    }
    if (expiresAt <= Date.now()) {
      this.unresolved.delete(hostname);
      return false;
    }
    return true;
  }

  private rememberUnresolved(hostname: string): void {
    if (this.unresolved.size >= NEGATIVE_CACHE_MAX_ENTRIES) {
      const oldest = this.unresolved.keys().next().value;
      if (oldest !== undefined) {
        this.unresolved.delete(oldest);
      }
    }
    this.unresolved.set(hostname, Date.now() + NEGATIVE_CACHE_TTL_MS);
  }
}
