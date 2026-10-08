import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StoreRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuthorizationService } from '../authorization/authorization.service';
import type { PublicStoreThemePayload } from './public-themes.service';
import { normalizeThemeConfiguration } from './theme-config.normalizer';
import { DEFAULT_THEME_SLUG, builtInThemeConfiguration, type StoreThemeConfig } from './theme-config.types';

/** How long the storefront keeps showing an editor's unsaved draft. */
export const THEME_PREVIEW_TTL_SECONDS = 2 * 60 * 60;
/** URL-safe random token, 32 characters. */
export const THEME_PREVIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

function themeDefaults(theme: { slug: string; configuration: Prisma.JsonValue }): StoreThemeConfig {
  const stored = normalizeThemeConfiguration(theme.configuration ?? {}, { stored: true });
  return Object.keys(stored).length > 0
    ? stored
    : normalizeThemeConfiguration(builtInThemeConfiguration(theme.slug), { stored: true });
}

export function themePreviewCacheKey(token: string): string {
  return `storefront:theme:preview:${token}`;
}

interface StoredPreview {
  storeId: string;
  userId: string;
  theme: { slug: string; name: string };
  configuration: StoreThemeConfig;
}

/**
 * The theme editor's live preview. The editor sends its unsaved draft; the
 * storefront renders it only for requests that carry the unguessable token,
 * for this store, for a short time. Nothing here touches the saved draft or
 * the published theme, and any theme may be previewed (also a premium theme
 * the business has not bought yet: try before you buy).
 */
@Injectable()
export class ThemePreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly authorization: AuthorizationService,
  ) {}

  async upsert(
    userId: string,
    storeId: string,
    input: { themeId?: string; configuration?: unknown; token?: string },
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);

    const theme = input.themeId
      ? await this.prisma.theme.findFirst({
          where: { id: input.themeId, active: true },
          select: { slug: true, name: true, configuration: true },
        })
      : ((
          await this.prisma.storeTheme.findFirst({
            where: { storeId, isActive: true },
            select: { theme: { select: { slug: true, name: true, configuration: true } } },
          })
        )?.theme ??
        // Nothing selected yet: the storefront's default theme.
        (await this.prisma.theme.findFirst({
          where: { slug: DEFAULT_THEME_SLUG },
          select: { slug: true, name: true, configuration: true },
        })));
    if (!theme) throw new NotFoundException('Theme not found');

    let configuration: StoreThemeConfig;
    try {
      // No configuration: the theme as it ships (e.g. trying a theme before buying it).
      configuration =
        input.configuration === undefined
          ? themeDefaults(theme)
          : normalizeThemeConfiguration(input.configuration);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid theme configuration');
    }

    // Reuse the editor's token while it still belongs to this store and user,
    // so the open preview keeps its URL and only refreshes.
    let token: string | null = null;
    if (input.token && THEME_PREVIEW_TOKEN_PATTERN.test(input.token)) {
      const existing = await this.read(input.token);
      if (existing && existing.storeId === storeId && existing.userId === userId) {
        token = input.token;
      }
    }
    token ??= randomBytes(24).toString('base64url');

    const stored: StoredPreview = { storeId, userId, theme: { slug: theme.slug, name: theme.name }, configuration };
    await this.redis
      .getClient()
      .set(themePreviewCacheKey(token), JSON.stringify(stored), 'EX', THEME_PREVIEW_TTL_SECONDS);

    return {
      success: true as const,
      data: {
        token,
        expiresAt: new Date(Date.now() + THEME_PREVIEW_TTL_SECONDS * 1000).toISOString(),
      },
    };
  }

  /** The previewed theme for this store, or null (unknown, expired, other store). */
  async publicPayload(storeId: string, token: string): Promise<PublicStoreThemePayload | null> {
    if (!THEME_PREVIEW_TOKEN_PATTERN.test(token)) return null;
    const stored = await this.read(token);
    if (!stored || stored.storeId !== storeId) return null;
    return { theme: stored.theme, publishedAt: null, configuration: stored.configuration, preview: true };
  }

  private async read(token: string): Promise<StoredPreview | null> {
    try {
      const raw = await this.redis.getClient().get(themePreviewCacheKey(token));
      return raw ? (JSON.parse(raw) as StoredPreview) : null;
    } catch {
      return null;
    }
  }
}
