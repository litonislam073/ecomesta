import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PublicStorefrontService } from '../public-storefront/public-storefront.service';
import {
  PUBLISHED_THEME_CACHE_TTL_SECONDS,
  publishedThemeCacheKey,
} from './theme-cache';
import { asStoreThemeConfig } from './theme-config.normalizer';
import { DEFAULT_THEME_SLUG, StoreThemeConfig } from './theme-config.types';

export interface PublicStoreThemePayload {
  theme: { slug: string; name: string } | null;
  publishedAt: string | null;
  configuration: StoreThemeConfig;
}

@Injectable()
export class PublicThemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storefront: PublicStorefrontService,
  ) {}

  async getPublishedTheme(storeSlug: string) {
    const store = await this.storefront.requireActiveStore(storeSlug);

    const cached = await this.readCache(store.id);
    if (cached) {
      return { success: true as const, data: cached };
    }

    const payload = await this.loadPublishedTheme(store.id);
    await this.writeCache(store.id, payload);
    return { success: true as const, data: payload };
  }

  /**
   * Public callers only ever see the last published snapshot — the draft
   * configuration never leaves the authenticated merchant surface.
   */
  private async loadPublishedTheme(
    storeId: string,
  ): Promise<PublicStoreThemePayload> {
    const storeTheme = await this.prisma.storeTheme.findFirst({
      where: { storeId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: {
        publishedConfiguration: true,
        publishedAt: true,
        theme: { select: { slug: true, name: true } },
      },
    });

    if (!storeTheme) {
      const fallback = await this.prisma.theme.findFirst({
        where: { slug: DEFAULT_THEME_SLUG },
        select: { slug: true, name: true },
      });
      return {
        theme: fallback ?? null,
        publishedAt: null,
        configuration: {},
      };
    }

    return {
      theme: storeTheme.theme,
      publishedAt: storeTheme.publishedAt?.toISOString() ?? null,
      configuration:
        storeTheme.publishedConfiguration === null
          ? {}
          : asStoreThemeConfig(storeTheme.publishedConfiguration),
    };
  }

  private async readCache(
    storeId: string,
  ): Promise<PublicStoreThemePayload | null> {
    try {
      const raw = await this.redis.getClient().get(publishedThemeCacheKey(storeId));
      return raw ? (JSON.parse(raw) as PublicStoreThemePayload) : null;
    } catch {
      return null;
    }
  }

  private async writeCache(
    storeId: string,
    payload: PublicStoreThemePayload,
  ): Promise<void> {
    try {
      await this.redis
        .getClient()
        .set(
          publishedThemeCacheKey(storeId),
          JSON.stringify(payload),
          'EX',
          PUBLISHED_THEME_CACHE_TTL_SECONDS,
        );
    } catch {
      // Storefront reads must not fail when Redis is unavailable.
    }
  }
}
