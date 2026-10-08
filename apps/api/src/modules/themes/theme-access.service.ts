import { ForbiddenException, Injectable } from '@nestjs/common';
import { BillingPaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { DEFAULT_THEME_SLUG } from './theme-config.types';

type Db = Prisma.TransactionClient | PrismaService;

/**
 * Whether a business may use a theme:
 * - `free`: the default theme, in every plan;
 * - `included`: in the plan (other themes with "all themes"; premium themes with Business);
 * - `owned`: a premium theme the business bought (payment approved);
 * - `pending`: bought, payment waiting for review;
 * - `locked`: neither.
 */
export type ThemeAccess = 'free' | 'included' | 'owned' | 'pending' | 'locked';

export interface ThemeForAccess {
  id: string;
  slug: string;
  priceBdt: Prisma.Decimal | null;
}

export const THEME_PURCHASE_REQUIRED = 'THEME_PURCHASE_REQUIRED';

export function canUseTheme(access: ThemeAccess): boolean {
  return access === 'free' || access === 'included' || access === 'owned';
}

export function isPremiumTheme(theme: Pick<ThemeForAccess, 'priceBdt'>): boolean {
  return theme.priceBdt !== null;
}

@Injectable()
export class ThemeAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  async accessFor(tenantId: string, themes: ThemeForAccess[], db: Db = this.prisma): Promise<Map<string, ThemeAccess>> {
    const limits = await this.entitlements.limitsForTenant(tenantId, db);
    const premiumIds = themes.filter(isPremiumTheme).map((theme) => theme.id);
    const purchases = premiumIds.length
      ? await db.themePurchase.findMany({
          where: {
            tenantId,
            themeId: { in: premiumIds },
            status: { in: [BillingPaymentStatus.APPROVED, BillingPaymentStatus.PENDING] },
          },
          select: { themeId: true, status: true },
        })
      : [];
    const access = new Map<string, ThemeAccess>();
    for (const theme of themes) {
      if (isPremiumTheme(theme)) {
        const bought = purchases.filter((p) => p.themeId === theme.id);
        access.set(
          theme.id,
          !limits || limits.premiumThemes
            ? 'included'
            : bought.some((p) => p.status === BillingPaymentStatus.APPROVED)
              ? 'owned'
              : bought.length > 0
                ? 'pending'
                : 'locked',
        );
      } else if (theme.slug === DEFAULT_THEME_SLUG) {
        access.set(theme.id, 'free');
      } else {
        access.set(theme.id, !limits || limits.allThemes ? 'included' : 'locked');
      }
    }
    return access;
  }

  async accessForTheme(tenantId: string, theme: ThemeForAccess, db: Db = this.prisma): Promise<ThemeAccess> {
    return (await this.accessFor(tenantId, [theme], db)).get(theme.id)!;
  }

  /**
   * Refuses using a premium theme the business has not bought (its plan does
   * not include it). Other themes keep the plan's "all themes" rule.
   */
  async assertPremiumUsable(tenantId: string, theme: ThemeForAccess & { name: string }, db: Db = this.prisma): Promise<void> {
    if (!isPremiumTheme(theme)) return;
    const access = await this.accessForTheme(tenantId, theme, db);
    if (canUseTheme(access)) return;
    throw new ForbiddenException({
      message:
        access === 'pending'
          ? `Your payment for the ${theme.name} theme is waiting for review. You can use it as soon as we confirm it.`
          : `${theme.name} is a premium theme. Buy it for ৳${Number(theme.priceBdt)} or upgrade to the Business plan, which includes it.`,
      error: THEME_PURCHASE_REQUIRED,
    });
  }
}
