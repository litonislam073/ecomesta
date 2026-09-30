import type { Theme } from '@prisma/client';
import { ThemesService } from './themes.service';
import { publishedThemeCacheKey } from './theme-cache';
import { DEFAULT_THEME_CONFIGURATION } from './theme-config.types';
import { LIVE_STORE_THEME_ORDER, liveStoreThemeWhere, nextPublishedAt } from './theme-live';

describe('theme live rules', () => {
  it('defines the live theme as the latest published row of the store', () => {
    expect(liveStoreThemeWhere('store-1')).toEqual({
      storeId: 'store-1',
      publishedAt: { not: null },
    });
    expect(LIVE_STORE_THEME_ORDER[0]).toEqual({ publishedAt: 'desc' });
  });

  it('always orders a new publish after the current live one', () => {
    const now = new Date('2026-09-30T00:00:00.000Z');
    expect(nextPublishedAt(now, null)).toBe(now);
    expect(nextPublishedAt(now, new Date('2026-09-29T00:00:00.000Z'))).toBe(now);
    // A live row stamped "in the future" (clock skew) still loses to the new publish.
    expect(nextPublishedAt(now, new Date('2026-09-30T00:00:05.000Z')).toISOString()).toBe(
      '2026-09-30T00:00:05.001Z',
    );
    expect(nextPublishedAt(now, now).getTime()).toBe(now.getTime() + 1);
  });
});

describe('ThemesService draft/publish separation', () => {
  const theme = (id: string, slug: string): Theme => ({
    id,
    slug,
    name: slug,
    version: '1.0.0',
    description: null,
    previewImageUrl: null,
    configuration: DEFAULT_THEME_CONFIGURATION as never,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const themeA = theme('theme-a', 'default');
  const themeB = theme('theme-b', 'minimal');
  const liveA = {
    id: 'st-a',
    storeId: 'store-1',
    themeId: themeA.id,
    isActive: true,
    configuration: {},
    publishedConfiguration: { branding: { primaryColor: '#aa0000' } },
    publishedAt: new Date('2026-09-01T00:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    theme: themeA,
  };
  const draftB = {
    ...liveA,
    id: 'st-b',
    themeId: themeB.id,
    publishedConfiguration: null,
    publishedAt: null,
    theme: themeB,
  };

  function build() {
    const tx = {
      storeTheme: {
        findFirst: jest.fn().mockResolvedValue({ publishedAt: liveA.publishedAt }),
        update: jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ ...draftB, isActive: true }),
      },
      store: { update: jest.fn() },
    };
    const prisma = {
      store: {
        findUnique: jest.fn().mockResolvedValue({ id: 'store-1', tenantId: 'tenant-1' }),
        update: jest.fn(),
      },
      theme: { findFirst: jest.fn().mockResolvedValue(themeB) },
      storeTheme: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn<Promise<unknown>, [(client: typeof tx) => Promise<unknown>]>(
        (fn) => fn(tx),
      ),
    };
    const del = jest.fn();
    const redis = { getClient: () => ({ del }) };
    const authorization = {
      assertStoreRole: jest.fn(),
      assertStoreAccess: jest.fn(),
    };
    const audit = { log: jest.fn() };
    const service = new ThemesService(
      prisma as never,
      authorization as never,
      audit as never,
      redis as never,
    );
    return { service, prisma, tx, del, audit };
  }

  it('selecting a theme never publishes or clears the public cache', async () => {
    const { service, prisma, tx, del } = build();
    // requireActiveStoreTheme → live A; findLiveStoreTheme → A
    prisma.storeTheme.findFirst.mockResolvedValueOnce(liveA).mockResolvedValueOnce(liveA);

    const res = await service.updateStoreTheme('user-1', 'store-1', { themeId: themeB.id });

    expect(tx.storeTheme.upsert).toHaveBeenCalledTimes(1);
    const upsert = tx.storeTheme.upsert.mock.calls[0][0];
    expect(upsert.update).toEqual({ isActive: true });
    expect(JSON.stringify(upsert)).not.toContain('published');
    expect(tx.storeTheme.update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(res.data.isLive).toBe(false);
    expect(res.data.liveTheme?.slug).toBe('default');
    expect(res.data.hasUnpublishedChanges).toBe(true);
  });

  it('saving a draft writes only the draft configuration', async () => {
    const { service, prisma, del } = build();
    prisma.storeTheme.findFirst.mockResolvedValueOnce(draftB).mockResolvedValueOnce(liveA);
    prisma.storeTheme.update.mockResolvedValue(draftB);

    await service.updateStoreTheme('user-1', 'store-1', {
      configuration: { hero: { headline: 'Draft' } },
    });

    const data = prisma.storeTheme.update.mock.calls[0][0].data;
    expect(Object.keys(data)).toEqual(['configuration']);
    expect(del).not.toHaveBeenCalled();
  });

  it('publishes inside one transaction, then invalidates only that store', async () => {
    const { service, prisma, tx, del, audit } = build();
    prisma.storeTheme.findFirst.mockResolvedValueOnce(draftB);
    tx.storeTheme.update.mockResolvedValue({ ...draftB, publishedAt: new Date() });

    const res = await service.publish('user-1', 'store-1');

    const data = tx.storeTheme.update.mock.calls[0][0].data;
    expect(data.publishedAt.getTime()).toBeGreaterThan(liveA.publishedAt.getTime());
    expect(data.publishedConfiguration).toEqual(data.configuration);
    expect(prisma.storeTheme.update).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalledWith(publishedThemeCacheKey('store-1'));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'THEME_PUBLISHED' }));
    expect(res.data.isLive).toBe(true);
  });

  it('a failed publish neither invalidates the cache nor audits', async () => {
    const { service, prisma, tx, del, audit } = build();
    prisma.storeTheme.findFirst.mockResolvedValueOnce(draftB);
    tx.storeTheme.update.mockResolvedValue(draftB);
    prisma.$transaction.mockRejectedValueOnce(new Error('db down'));

    await expect(service.publish('user-1', 'store-1')).rejects.toThrow('db down');
    expect(del).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
