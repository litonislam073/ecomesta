import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import type { PlanLimits } from '@ecomesta/types';
import { PrismaService } from '../../prisma/prisma.service';
import { readPlanLimits, sortPlans } from './plan-catalog';
import { pickCurrent } from './subscription-lifecycle.service';

type Db = Prisma.TransactionClient | PrismaService;

/** Plan features a request can require (product counts and storage are checked separately). */
export type PlanFeature = Exclude<keyof PlanLimits, 'maxProducts' | 'storageMb'>;

const MB = 1024 * 1024;

/** "1 GB", "512 MB", "0.98 GB": sizes as merchants read them. */
export function formatStorage(bytes: number): string {
  if (bytes >= 1024 * MB) {
    const gb = bytes / (1024 * MB);
    return `${Number.isInteger(gb) ? gb : gb.toFixed(2)} GB`;
  }
  return `${Math.ceil(bytes / MB)} MB`;
}

const FEATURE_NAMES: Record<PlanFeature, string> = {
  customDomain: 'Custom domains',
  onlinePayments: 'Online payments with SSLCommerz',
  stripe: 'Stripe payments',
  coupons: 'Coupons',
  deliveryZones: 'Delivery zones',
  allThemes: 'This theme',
  premiumThemes: 'Premium themes',
  marketingTracking: 'Marketing & tracking',
};

export const PLAN_UPGRADE_REQUIRED = 'PLAN_UPGRADE_REQUIRED';

/**
 * What the business's current plan allows. Limits come from plans that define
 * them (Starter / Growth / Business); see `limitsForTenant` for a business
 * without a subscription.
 */
@Injectable()
export class PlanEntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The limits that apply to a business, failing closed:
   * 1. its subscription's plan;
   * 2. no subscription yet (the sign-up payment is waiting for approval, or was
   *    refused): the plan it paid for;
   * 3. neither: the smallest plan that sets limits — never "unlimited".
   * Only a database with no limited plans at all restricts nothing.
   */
  async limitsForTenant(tenantId: string, db: Db = this.prisma): Promise<PlanLimits | null> {
    const rows = await db.subscription.findMany({
      where: { tenantId },
      select: { status: true, createdAt: true, plan: { select: { configuration: true } } },
    });
    const current = pickCurrent(rows);
    if (current) return readPlanLimits(current.plan.configuration);
    const payment = await db.billingPayment.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { plan: { select: { configuration: true } } },
    });
    if (payment) return readPlanLimits(payment.plan.configuration);
    const plans = sortPlans(await db.subscriptionPlan.findMany({ where: { active: true } }));
    for (const plan of plans) {
      const limits = readPlanLimits(plan.configuration);
      if (limits) return limits;
    }
    return null;
  }

  /** Refuses the request when the store's plan does not include `feature`. */
  async assertFeature(storeId: string, feature: PlanFeature, db: Db = this.prisma): Promise<void> {
    const tenantId = await this.tenantOfStore(storeId, db);
    const limits = await this.limitsForTenant(tenantId, db);
    if (!limits || limits[feature]) return;
    throw await this.upgradeRequired(
      `${FEATURE_NAMES[feature]} ${feature === 'allThemes' || feature === 'marketingTracking' ? 'is' : 'are'} not included in your plan.`,
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

  /**
   * Refuses an upload that would take the business past its plan's storage.
   * Call it inside the transaction that saves the file: the business row is
   * locked so concurrent uploads cannot both slip under the limit.
   */
  async assertStorageCapacity(tx: Prisma.TransactionClient, storeId: string, addingBytes: number): Promise<void> {
    const tenantId = await this.tenantOfStore(storeId, tx);
    const limits = await this.limitsForTenant(tenantId, tx);
    if (!limits || limits.storageMb === null) return;
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
    // Summed as bigint: a business can hold more than the 2 GB an int column sum allows.
    const rows = await tx.$queryRaw<Array<{ used: bigint }>>`
      SELECT COALESCE(SUM(m.size), 0)::bigint AS used
      FROM media m JOIN stores s ON s.id = m.store_id
      WHERE s.tenant_id = ${tenantId}::uuid`;
    const used = Number(rows[0]?.used ?? 0);
    const max = limits.storageMb;
    if (used + addingBytes <= max * MB) return;
    throw await this.upgradeRequired(
      `Your plan includes ${formatStorage(max * MB)} of storage and you have used ${formatStorage(used)}. Delete images you no longer need to free space.`,
      (candidate) => candidate.storageMb === null || candidate.storageMb > max,
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
