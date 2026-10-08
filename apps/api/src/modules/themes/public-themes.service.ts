import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PublicStorefrontService } from '../public-storefront/public-storefront.service';
import {
  PUBLISHED_THEME_CACHE_TTL_SECONDS,
  publishedThemeCacheKey,
} from './theme-cache';
import { asStoreThemeConfig } from './theme-config.normalizer';
import { LIVE_STORE_THEME_ORDER, liveStoreThemeWhere } from './theme-live';
import { ThemeAccessService, canUseTheme, isPremiumTheme } from './theme-access.service';
import { ThemePreviewService } from './theme-preview.service';
import { DEFAULT_THEME_SLUG, StoreThemeConfig } from './theme-config.types';

export interface PublicStoreThemePayload {
  theme: { slug: string; name: string } | null;
  publishedAt: string | null;
  configuration: StoreThemeConfig;
  /** Set only for the theme editor's unsaved-draft preview. */
  preview?: boolean;
}

@Injectable()
export class PublicThemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storefront: PublicStorefrontService,
    private readonly themeAccess: ThemeAccessService,
    private readonly previews: ThemePreviewService,
  ) {}

  /** `previewToken`: the theme editor's draft preview; ignored when unknown or expired. */
  async getPublishedTheme(storeSlug: string, previewToken?: string) {
    const store = await this.storefront.requireActiveStore(storeSlug);

    if (previewToken) {
      const preview = await this.previews.publicPayload(store.id, previewToken);
      if (preview) return { success: true as const, data: preview };
    }

    const cached = await this.readCache(store.id);
    if (cached) {
      return { success: true as const, data: cached };
    }

    const payload = await this.loadPublishedTheme(store.id);
    await this.writeCache(store.id, payload);
    return { success: true as const, data: payload };
  }

  /**
   * Public callers only ever see the live theme: the most recently published
   * snapshot. The merchant's selected theme and draft configuration never
   * leave the authenticated merchant surface until they are published.
   */
  private async loadPublishedTheme(
    storeId: string,
  ): Promise<PublicStoreThemePayload> {
    const storeTheme = await this.prisma.storeTheme.findFirst({
      where: liveStoreThemeWhere(storeId),
      orderBy: LIVE_STORE_THEME_ORDER,
      select: {
        publishedConfiguration: true,
        publishedAt: true,
        theme: { select: { id: true, slug: true, name: true, priceBdt: true } },
        store: { select: { tenantId: true } },
      },
    });

    // A premium theme the business may no longer use (plan changed, payment
    // rejected) is not served: the store falls back to the default theme.
    const locked =
      storeTheme !== null &&
      isPremiumTheme(storeTheme.theme) &&
      !canUseTheme(await this.themeAccess.accessForTheme(storeTheme.store.tenantId, storeTheme.theme));

    // Nothing published yet: the default theme with an empty configuration,
    // which the storefront renders with its packaged defaults. An unpublished
    // selection is never used here.
    if (!storeTheme || locked) {
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
      theme: { slug: storeTheme.theme.slug, name: storeTheme.theme.name },
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
