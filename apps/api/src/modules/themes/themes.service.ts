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
    return { success: true as const, data: this.toStoreThemeDto(storeTheme) };
  }

  async listThemes(userId: string, storeId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.ensureBuiltInThemes();

    const [themes, selected] = await Promise.all([
      this.prisma.theme.findMany({
        where: { active: true },
        orderBy: [{ name: 'asc' }],
      }),
      this.prisma.storeTheme.findFirst({
        where: { storeId, isActive: true },
        select: { themeId: true },
      }),
    ]);

    return {
      success: true as const,
      data: {
        items: themes.map((theme) => ({
          ...this.toThemeDto(theme),
          description: theme.description,
          selected: theme.id === selected?.themeId,
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
      data: { configuration: this.draftOf(storeTheme) },
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
    let storeTheme = await this.requireActiveStoreTheme(storeId);
    let switchedTheme = false;

    if (dto.themeId && dto.themeId !== storeTheme.themeId) {
      storeTheme = await this.selectTheme(storeId, dto.themeId);
      switchedTheme = true;
    }

    if (dto.configuration !== undefined) {
      const patch = normalizeThemeConfiguration(dto.configuration);
      const merged = mergeThemeConfiguration(this.draftOf(storeTheme), patch);
      storeTheme = await this.prisma.storeTheme.update({
        where: { id: storeTheme.id },
        data: { configuration: merged as Prisma.InputJsonValue },
        include: { theme: true },
      });
    }

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
          sections: Object.keys(
            normalizeThemeConfiguration(dto.configuration),
          ),
        },
        req,
      });
    }

    return { success: true as const, data: this.toStoreThemeDto(storeTheme) };
  }

  async publish(userId: string, storeId: string, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);

    const store = await this.requireStore(storeId);
    const current = await this.requireActiveStoreTheme(storeId);
    const draft = this.draftOf(current);

    const storeTheme = await this.prisma.storeTheme.update({
      where: { id: current.id },
      data: {
        configuration: draft as Prisma.InputJsonValue,
        publishedConfiguration: draft as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
      include: { theme: true },
    });

    // Keep the store record in sync so non-theme surfaces (emails, admin) match.
    const branding = draft.branding ?? {};
    const storeUpdate: Prisma.StoreUpdateInput = {};
    if (branding.logoUrl) {
      storeUpdate.logoUrl = branding.logoUrl;
    }
    if (branding.faviconUrl) {
      storeUpdate.faviconUrl = branding.faviconUrl;
    }
    if (Object.keys(storeUpdate).length > 0) {
      await this.prisma.store.update({
        where: { id: storeId },
        data: storeUpdate,
      });
    }

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

    return { success: true as const, data: this.toStoreThemeDto(storeTheme) };
  }

  async reset(userId: string, storeId: string, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);

    const store = await this.requireStore(storeId);
    const current = await this.requireActiveStoreTheme(storeId);
    const defaults = this.themeDefaults(current.theme);

    const storeTheme = await this.prisma.storeTheme.update({
      where: { id: current.id },
      data: { configuration: defaults as Prisma.InputJsonValue },
      include: { theme: true },
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

    return { success: true as const, data: this.toStoreThemeDto(storeTheme) };
  }

  // ---------------------------------------------------------------------------

  /**
   * Every store renders through a theme, so the first read materialises one
   * from the `default` theme instead of returning an empty payload.
   */
  async requireActiveStoreTheme(storeId: string): Promise<StoreThemeWithTheme> {
    const existing = await this.prisma.storeTheme.findFirst({
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

    return this.selectTheme(storeId, theme.id);
  }

  /** Activates `themeId` for the store, keeping any previously saved draft. */
  private async selectTheme(
    storeId: string,
    themeId: string,
  ): Promise<StoreThemeWithTheme> {
    const theme = await this.prisma.theme.findFirst({
      where: { id: themeId, active: true },
    });
    if (!theme) {
      throw new NotFoundException('Theme not found');
    }

    // `store_themes_one_active_uidx` allows a single active row per store, so
    // the previous selection has to be stood down before the new one is armed.
    return this.prisma.$transaction(async (tx) => {
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
    const stored = normalizeThemeConfiguration(theme.configuration ?? {});
    if (Object.keys(stored).length > 0) {
      return stored;
    }
    return normalizeThemeConfiguration(builtInThemeConfiguration(theme.slug));
  }

  private draftOf(storeTheme: StoreThemeWithTheme): StoreThemeConfig {
    const draft = asStoreThemeConfig(storeTheme.configuration);
    if (Object.keys(draft).length > 0) {
      return normalizeThemeConfiguration(draft);
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

  private toStoreThemeDto(storeTheme: StoreThemeWithTheme) {
    const draft = this.draftOf(storeTheme);
    const published =
      storeTheme.publishedConfiguration === null
        ? null
        : asStoreThemeConfig(storeTheme.publishedConfiguration);

    return {
      id: storeTheme.id,
      theme: this.toThemeDto(storeTheme.theme),
      isActive: storeTheme.isActive,
      configuration: draft,
      publishedConfiguration: published,
      publishedAt: storeTheme.publishedAt?.toISOString() ?? null,
      hasUnpublishedChanges:
        published === null || !themeConfigurationsEqual(draft, published),
      updatedAt: storeTheme.updatedAt.toISOString(),
    };
  }
}
