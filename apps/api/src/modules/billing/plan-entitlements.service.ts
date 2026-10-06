import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import type { PlanLimits } from '@ecomesta/types';
import { PrismaService } from '../../prisma/prisma.service';
import { readPlanLimits, sortPlans } from './plan-catalog';
import { pickCurrent } from './subscription-lifecycle.service';

type Db = Prisma.TransactionClient | PrismaService;

/** Plan features a request can require (product counts are checked separately). */
export type PlanFeature = Exclude<keyof PlanLimits, 'maxProducts'>;

const FEATURE_NAMES: Record<PlanFeature, string> = {
  customDomain: 'Custom domains',
  onlinePayments: 'Online payments with SSLCommerz',
  stripe: 'Stripe payments',
  coupons: 'Coupons',
  deliveryZones: 'Delivery zones',
  allThemes: 'This theme',
};

export const PLAN_UPGRADE_REQUIRED = 'PLAN_UPGRADE_REQUIRED';

/**
 * What the business's current plan allows. A business without a subscription,
 * or on a plan that sets no limits, is not restricted — limits only apply to
 * plans that define them (Starter / Growth / Business).
 */
@Injectable()
export class PlanEntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async limitsForTenant(tenantId: string, db: Db = this.prisma): Promise<PlanLimits | null> {
    const rows = await db.subscription.findMany({
      where: { tenantId },
      select: { status: true, createdAt: true, plan: { select: { configuration: true } } },
    });
    const current = pickCurrent(rows);
    return current ? readPlanLimits(current.plan.configuration) : null;
  }

  /** Refuses the request when the store's plan does not include `feature`. */
  async assertFeature(storeId: string, feature: PlanFeature, db: Db = this.prisma): Promise<void> {
    const tenantId = await this.tenantOfStore(storeId, db);
    const limits = await this.limitsForTenant(tenantId, db);
    if (!limits || limits[feature]) return;
    throw await this.upgradeRequired(
      `${FEATURE_NAMES[feature]} ${feature === 'allThemes' ? 'is' : 'are'} not included in your plan.`,
      (candidate) => candidate[feature],
    );
  }

  /**
   * Refuses to add `adding` products beyond the plan's product limit. Call it
   * inside the transaction that creates them: the business row is locked so
   * concurrent creates cannot both slip under the limit.
   */
  async assertProductCapacity(tx: Prisma.TransactionClient, storeId: string, adding = 1): Promise<void> {
    const tenantId = await this.tenantOfStore(storeId, tx);
    const limits = await this.limitsForTenant(tenantId, tx);
    if (!limits || limits.maxProducts === null) return;
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
    const used = await tx.product.count({
      where: { store: { tenantId }, status: { not: ProductStatus.ARCHIVED } },
    });
    if (used + adding <= limits.maxProducts) return;
    const max = limits.maxProducts;
    throw await this.upgradeRequired(
      `Your plan allows up to ${max} products and you have ${used}.`,
      (candidate) => candidate.maxProducts === null || candidate.maxProducts > max,
    );
  }

  /** Whether the store's plan includes `feature` (shopper-facing paths decide how to refuse). */
  async storeHasFeature(storeId: string, feature: PlanFeature, db: Db = this.prisma): Promise<boolean> {
    const limits = await this.limitsForTenant(await this.tenantOfStore(storeId, db), db);
    return !limits || limits[feature];
  }

  /** Plan feature an online payment provider needs, if any. */
  static featureForProvider(provider: string): PlanFeature | null {
    if (provider === 'SSL_COMMERZ') return 'onlinePayments';
    if (provider === 'STRIPE') return 'stripe';
    return null;
  }

  /** Whether the store's plan lets shoppers pay with `provider`. */
  async storeAllowsProvider(storeId: string, provider: string, db: Db = this.prisma): Promise<boolean> {
    const feature = PlanEntitlementsService.featureForProvider(provider);
    if (!feature) return true;
    const limits = await this.limitsForTenant(await this.tenantOfStore(storeId, db), db);
    return !limits || limits[feature];
  }

  private async tenantOfStore(storeId: string, db: Db): Promise<string> {
    const store = await db.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
    if (!store) throw new NotFoundException('Store not found');
    return store.tenantId;
  }

  /** 403 naming the plans that would allow the action. */
  private async upgradeRequired(reason: string, allows: (limits: PlanLimits) => boolean) {
    const plans = sortPlans(
      await this.prisma.subscriptionPlan.findMany({ where: { active: true } }),
    ).filter((plan) => {
      const limits = readPlanLimits(plan.configuration);
      return limits !== null && allows(limits);
    });
    const names = plans.map((plan) => plan.name);
    const upgrade =
      names.length === 0
        ? 'Contact Ecomesta support to change your plan.'
        : `Upgrade to ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`} in Plan & billing.`;
    return new ForbiddenException({ message: `${reason} ${upgrade}`, error: PLAN_UPGRADE_REQUIRED });
  }
}
