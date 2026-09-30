import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, StoreRole, type StoreTheme, type Theme } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { UpdateStoreThemeDto } from './dto/store-theme.dto';
import { publishedThemeCacheKey } from './theme-cache';
import {
  LIVE_STORE_THEME_ORDER,
  liveStoreThemeWhere,
  nextPublishedAt,
} from './theme-live';
import {
  asStoreThemeConfig,
  mergeThemeConfiguration,
  normalizeThemeConfiguration,
  themeConfigurationsEqual,
} from './theme-config.normalizer';
import {
  BUILT_IN_THEMES,
  DEFAULT_THEME_SLUG,
  StoreThemeConfig,
  builtInThemeConfiguration,
} from './theme-config.types';

type StoreThemeWithTheme = StoreTheme & { theme: Theme };
type LiveStoreTheme = { id: string; publishedAt: Date | null; theme: Theme };

@Injectable()
export class ThemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  async getStoreTheme(userId: string, storeId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const storeTheme = await this.requireActiveStoreTheme(storeId);
    const live = await this.findLiveStoreTheme(storeId);
    return { success: true as const, data: this.toStoreThemeDto(storeTheme, live) };
  }

  async listThemes(userId: string, storeId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.ensureBuiltInThemes();

    const [themes, selected, live] = await Promise.all([
      this.prisma.theme.findMany({
        where: { active: true },
        orderBy: [{ name: 'asc' }],
      }),
      this.prisma.storeTheme.findFirst({
        where: { storeId, isActive: true },
        select: { themeId: true },
      }),
      this.findLiveStoreTheme(storeId),
    ]);

    return {
      success: true as const,
      data: {
        items: themes.map((theme) => ({
          ...this.toThemeDto(theme),
          description: theme.description,
          selected: theme.id === selected?.themeId,
          live: theme.id === live?.theme.id,
        })),
        meta: { total: themes.length },
      },
    };
  }

  /** Draft configuration for the authenticated preview surface. */
  async getPreview(userId: string, storeId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const storeTheme = await this.requireActiveStoreTheme(storeId);
    return {
      success: true as const,
      data: {
        theme: this.toThemeDto(storeTheme.theme),
        configuration: this.draftOf(storeTheme),
      },
    };
  }

  async updateStoreTheme(
    userId: string,
    storeId: string,
    dto: UpdateStoreThemeDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);

    if (dto.themeId === undefined && dto.configuration === undefined) {
      throw new BadRequestException(
        'Provide themeId and/or configuration to update',
      );
    }

    const store = await this.requireStore(storeId);
    // Validate before taking the lock so a bad payload never touches the draft.
    const patch =
      dto.configuration === undefined
        ? undefined
        : normalizeThemeConfiguration(dto.configuration);

    // Selecting and saving only touch the merchant's draft. The live theme and
    // the public cache are left alone until publish(). The merge runs against
    // the latest committed draft under the store's theme lock, so concurrent
    // saves of different fields cannot overwrite each other.
    const { storeTheme, switchedTheme } = await this.prisma.$transaction(
      async (tx) => {
        await this.lockStoreThemes(tx, storeId);
        let current = await this.requireActiveStoreTheme(storeId, tx);
        let switched = false;

        if (dto.themeId && dto.themeId !== current.themeId) {
          current = await this.selectTheme(tx, storeId, dto.themeId);
          switched = true;
        }

        if (patch !== undefined) {
          const merged = mergeThemeConfiguration(this.draftOf(current), patch);
          current = await tx.storeTheme.update({
            where: { id: current.id },
            data: { configuration: merged as Prisma.InputJsonValue },
            include: { theme: true },
          });
        }
        return { storeTheme: current, switchedTheme: switched };
      },
    );

    if (switchedTheme) {
      await this.audit.log({
        action: 'THEME_SELECTED',
        entityType: 'StoreTheme',
        entityId: storeTheme.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { themeId: storeTheme.themeId, themeSlug: storeTheme.theme.slug },
        req,
      });
    }

    if (dto.configuration !== undefined) {
      await this.audit.log({
        action: 'THEME_UPDATED',
        entityType: 'StoreTheme',
        entityId: storeTheme.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: {
          themeSlug: storeTheme.theme.slug,
          sections: Object.keys(patch ?? {}),
        },
        req,
      });
    }

    const live = await this.findLiveStoreTheme(storeId);
    return { success: true as const, data: this.toStoreThemeDto(storeTheme, live) };
  }

  async publish(userId: string, storeId: string, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);

    const store = await this.requireStore(storeId);

    // One transaction: the selected theme becomes live (latest publishedAt)
    // together with the store branding sync, or nothing changes and the
    // previously live theme keeps serving. The draft is read under the store's
    // theme lock so a concurrent save is never overwritten by a stale copy.
    const storeTheme = await this.prisma.$transaction(async (tx) => {
      await this.lockStoreThemes(tx, storeId);
      const current = await this.requireActiveStoreTheme(storeId, tx);
      const draft = this.draftOf(current);

      const previousLive = await tx.storeTheme.findFirst({
        where: liveStoreThemeWhere(storeId),
        orderBy: LIVE_STORE_THEME_ORDER,
        select: { id: true, publishedAt: true, publishedConfiguration: true },
      });

      const published = await tx.storeTheme.update({
        where: { id: current.id },
        data: {
          configuration: draft as Prisma.InputJsonValue,
          publishedConfiguration: draft as Prisma.InputJsonValue,
          publishedAt: nextPublishedAt(new Date(), previousLive?.publishedAt),
        },
        include: { theme: true },
      });

      await this.syncPublishedBranding(
        tx,
        storeId,
        draft,
        // Only a republish of the same theme can remove a value from it.
        previousLive?.id === current.id
          ? asStoreThemeConfig(previousLive.publishedConfiguration)
          : {},
      );
      return published;
    });

    await this.invalidatePublishedCache(storeId);

    await this.audit.log({
      action: 'THEME_PUBLISHED',
      entityType: 'StoreTheme',
      entityId: storeTheme.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        themeSlug: storeTheme.theme.slug,
        publishedAt: storeTheme.publishedAt?.toISOString(),
      },
      req,
    });

    return {
      success: true as const,
      data: this.toStoreThemeDto(storeTheme, storeTheme),
    };
  }

  async reset(userId: string, storeId: string, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);

    const store = await this.requireStore(storeId);
    const storeTheme = await this.prisma.$transaction(async (tx) => {
      await this.lockStoreThemes(tx, storeId);
      const current = await this.requireActiveStoreTheme(storeId, tx);
      return tx.storeTheme.update({
        where: { id: current.id },
        data: {
          configuration: this.themeDefaults(current.theme) as Prisma.InputJsonValue,
        },
        include: { theme: true },
      });
    });

    await this.audit.log({
      action: 'THEME_RESET',
      entityType: 'StoreTheme',
      entityId: storeTheme.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { themeSlug: storeTheme.theme.slug },
      req,
    });

    const live = await this.findLiveStoreTheme(storeId);
    return { success: true as const, data: this.toStoreThemeDto(storeTheme, live) };
  }

  // ---------------------------------------------------------------------------

  /**
   * Every store renders through a theme, so the first read materialises one
   * from the `default` theme instead of returning an empty payload.
   */
  async requireActiveStoreTheme(
    storeId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<StoreThemeWithTheme> {
    const existing = await (tx ?? this.prisma).storeTheme.findFirst({
      where: { storeId, isActive: true },
      include: { theme: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) {
      return existing;
    }

    await this.ensureBuiltInThemes();
    const theme =
      (await this.prisma.theme.findFirst({
        where: { slug: DEFAULT_THEME_SLUG, active: true },
      })) ??
      (await this.prisma.theme.findFirst({
        where: { active: true },
        orderBy: { createdAt: 'asc' },
      }));
    if (!theme) {
      throw new ServiceUnavailableException(
        'No storefront themes are available',
      );
    }

    return tx
      ? this.selectTheme(tx, storeId, theme.id)
      : this.prisma.$transaction((inner) =>
          this.selectTheme(inner, storeId, theme.id),
        );
  }

  /**
   * Serialises every theme write of one store (select, draft save, reset,
   * publish) for the rest of the transaction, so a read → merge → write never
   * works from a stale draft. Locks the parent store row: the theme state spans
   * several store_themes rows (the selection moves between them). NO KEY UPDATE
   * does not block inserts that reference the store (orders, products).
   */
  private async lockStoreThemes(
    tx: Prisma.TransactionClient,
    storeId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM stores WHERE id = ${storeId}::uuid FOR NO KEY UPDATE`;
  }

  /** The theme visitors currently see, or null before the first publish. */
  private findLiveStoreTheme(storeId: string): Promise<LiveStoreTheme | null> {
    return this.prisma.storeTheme.findFirst({
      where: liveStoreThemeWhere(storeId),
      orderBy: LIVE_STORE_THEME_ORDER,
      select: { id: true, publishedAt: true, theme: true },
    });
  }

  /**
   * Keeps the store record in sync so non-theme surfaces (emails, admin) match.
   * The storefront falls back to the store's logo/favicon, so a logo or favicon
   * the merchant removed from this theme (present in `previouslyPublished`,
   * absent now) is also cleared on the store, but only while the store still
   * holds the value the previous publish copied there.
   */
  async syncPublishedBranding(
    tx: Prisma.TransactionClient,
    storeId: string,
    config: StoreThemeConfig,
    previouslyPublished: StoreThemeConfig = {},
  ): Promise<void> {
    const branding = config.branding ?? {};
    const previous = previouslyPublished.branding ?? {};
    const storeUpdate: Prisma.StoreUpdateInput = {};
    if (branding.logoUrl) {
      storeUpdate.logoUrl = branding.logoUrl;
    }
    if (branding.faviconUrl) {
      storeUpdate.faviconUrl = branding.faviconUrl;
    }

    const removedLogo = !branding.logoUrl && previous.logoUrl;
    const removedFavicon = !branding.faviconUrl && previous.faviconUrl;
    if (removedLogo || removedFavicon) {
      const store = await tx.store.findUnique({
        where: { id: storeId },
        select: { logoUrl: true, faviconUrl: true },
      });
      if (removedLogo && store?.logoUrl === previous.logoUrl) {
        storeUpdate.logoUrl = null;
      }
      if (removedFavicon && store?.faviconUrl === previous.faviconUrl) {
        storeUpdate.faviconUrl = null;
      }
    }

    if (Object.keys(storeUpdate).length > 0) {
      await tx.store.update({
        where: { id: storeId },
        data: storeUpdate,
      });
    }
  }

  /**
   * Selects `themeId` as the merchant's draft theme, keeping any previously
   * saved draft. Does not change the live storefront.
   */
  private async selectTheme(
    tx: Prisma.TransactionClient,
    storeId: string,
    themeId: string,
  ): Promise<StoreThemeWithTheme> {
    const theme = await tx.theme.findFirst({
      where: { id: themeId, active: true },
    });
    if (!theme) {
      throw new NotFoundException('Theme not found');
    }

    // `store_themes_one_active_uidx` allows a single active row per store, so
    // the previous selection has to be stood down before the new one is armed.
    await tx.storeTheme.updateMany({
      where: { storeId, isActive: true, themeId: { not: theme.id } },
      data: { isActive: false },
    });

    return tx.storeTheme.upsert({
      where: { storeId_themeId: { storeId, themeId: theme.id } },
      update: { isActive: true },
      create: {
        storeId,
        themeId: theme.id,
        isActive: true,
        configuration: this.themeDefaults(theme) as Prisma.InputJsonValue,
      },
      include: { theme: true },
    });
  }

  /** Creates missing built-in themes so a fresh database is still themable. */
  async ensureBuiltInThemes(): Promise<void> {
    for (const definition of BUILT_IN_THEMES) {
      await this.prisma.theme.upsert({
        where: { slug: definition.slug },
        update: {},
        create: {
          slug: definition.slug,
          name: definition.name,
          version: definition.version,
          description: definition.description,
          previewImageUrl: definition.previewImageUrl,
          configuration: definition.configuration as Prisma.InputJsonValue,
          active: true,
        },
      });
    }
  }

  private themeDefaults(theme: Theme): StoreThemeConfig {
    const stored = normalizeThemeConfiguration(theme.configuration ?? {}, { stored: true });
    if (Object.keys(stored).length > 0) {
      return stored;
    }
    return normalizeThemeConfiguration(builtInThemeConfiguration(theme.slug), {
      stored: true,
    });
  }

  private draftOf(storeTheme: StoreThemeWithTheme): StoreThemeConfig {
    const draft = asStoreThemeConfig(storeTheme.configuration);
    if (Object.keys(draft).length > 0) {
      return normalizeThemeConfiguration(draft, { stored: true });
    }
    return this.themeDefaults(storeTheme.theme);
  }

  private async invalidatePublishedCache(storeId: string): Promise<void> {
    try {
      await this.redis.getClient().del(publishedThemeCacheKey(storeId));
    } catch {
      // Cache invalidation is best-effort; the 60s TTL bounds staleness.
    }
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, tenantId: true },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }

  private toThemeDto(theme: Theme) {
    return {
      id: theme.id,
      name: theme.name,
      slug: theme.slug,
      version: theme.version,
      previewImageUrl: theme.previewImageUrl,
    };
  }

  private toStoreThemeDto(
    storeTheme: StoreThemeWithTheme,
    live: LiveStoreTheme | null,
  ) {
    const draft = this.draftOf(storeTheme);
    const published =
      storeTheme.publishedConfiguration === null
        ? null
        : asStoreThemeConfig(storeTheme.publishedConfiguration);
    const isLive = live?.id === storeTheme.id;

    return {
      id: storeTheme.id,
      theme: this.toThemeDto(storeTheme.theme),
      isActive: storeTheme.isActive,
      isLive,
      liveTheme: live
        ? {
            ...this.toThemeDto(live.theme),
            publishedAt: live.publishedAt?.toISOString() ?? null,
          }
        : null,
      configuration: draft,
      publishedConfiguration: published,
      publishedAt: storeTheme.publishedAt?.toISOString() ?? null,
      // A selected theme that is not live always needs a publish.
      hasUnpublishedChanges:
        !isLive ||
        published === null ||
        !themeConfigurationsEqual(draft, published),
      updatedAt: storeTheme.updatedAt.toISOString(),
    };
  }
}
