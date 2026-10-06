import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  StoreStatus,
  SubscriptionStatus,
  type Subscription,
} from '@prisma/client';
import type { Request } from 'express';
import {
  PAYMENT_GRACE_DAYS,
  addCalendarDays,
  addCalendarMonths,
  billingCycleDefinition,
  paymentDeadline,
  subscriptionPhase,
  type SubscriptionPhase,
} from '@ecomesta/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { domainResolutionCacheKey } from '../domains/domain-cache';

type Tx = Prisma.TransactionClient;

/** Statuses that still owe payment and can lapse. */
const PAYMENT_PENDING_STATUSES = [SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE];

/** Preference when a tenant has several subscription rows. */
const STATUS_PRIORITY: Record<SubscriptionStatus, number> = {
  [SubscriptionStatus.ACTIVE]: 0,
  [SubscriptionStatus.PAST_DUE]: 1,
  [SubscriptionStatus.TRIALING]: 2,
  [SubscriptionStatus.EXPIRED]: 3,
  [SubscriptionStatus.CANCELLED]: 4,
};

export interface EvaluationResult {
  movedToGrace: number;
  suspended: number;
  storesSuspended: number;
}

export type PaymentConfirmationSource = 'PAYMENT_PROVIDER' | 'ADMIN_CONFIRMED';

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  /** The subscription that governs the tenant right now (paid beats pending beats ended). */
  async currentForTenant(tenantId: string, client: Tx | PrismaService = this.prisma) {
    const rows = await client.subscription.findMany({
      where: { tenantId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return pickCurrent(rows);
  }

  phaseOf(subscription: Pick<Subscription, 'status' | 'trialEndsAt' | 'endsAt'>, now = new Date()): SubscriptionPhase {
    return subscriptionPhase(subscription, now);
  }

  /** Runs every scheduled pass; safe to repeat and to run concurrently. */
  evaluateDue(now = new Date()): Promise<EvaluationResult> {
    return this.evaluate({}, now);
  }

  /** Same rules for one tenant; used on request paths so enforcement never waits for the scheduler. */
  evaluateTenant(tenantId: string, now = new Date()): Promise<EvaluationResult> {
    return this.evaluate({ tenantId }, now);
  }

  private async evaluate(scope: Prisma.SubscriptionWhereInput, now: Date): Promise<EvaluationResult> {
    const result: EvaluationResult = { movedToGrace: 0, suspended: 0, storesSuspended: 0 };
    const graceCutoff = addCalendarDays(now, -PAYMENT_GRACE_DAYS);

    const trialEnded = await this.prisma.subscription.findMany({
      where: { ...scope, status: SubscriptionStatus.TRIALING, trialEndsAt: { lte: now } },
      select: { id: true, tenantId: true, trialEndsAt: true },
    });
    for (const row of trialEnded) {
      const moved = await this.prisma.subscription.updateMany({
        where: { id: row.id, status: SubscriptionStatus.TRIALING },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
      if (moved.count === 0) continue;
      result.movedToGrace += 1;
      await this.audit.log({
        action: 'SUBSCRIPTION_PAYMENT_DUE',
        entityType: 'Subscription',
        entityId: row.id,
        tenantId: row.tenantId,
        metadata: {
          trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
          graceDays: PAYMENT_GRACE_DAYS,
        },
      });
    }

    // A paid period that has ended needs renewing: same grace rules as a trial,
    // counted from the end of the paid period (`endsAt`).
    const paidPeriodEnded = await this.prisma.subscription.findMany({
      where: { ...scope, status: SubscriptionStatus.ACTIVE, endsAt: { lte: now } },
      select: { id: true, tenantId: true, endsAt: true },
    });
    for (const row of paidPeriodEnded) {
      const moved = await this.prisma.subscription.updateMany({
        where: { id: row.id, status: SubscriptionStatus.ACTIVE, endsAt: { lte: now } },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
      if (moved.count === 0) continue;
      result.movedToGrace += 1;
      await this.audit.log({
        action: 'SUBSCRIPTION_RENEWAL_DUE',
        entityType: 'Subscription',
        entityId: row.id,
        tenantId: row.tenantId,
        metadata: {
          paidThrough: row.endsAt?.toISOString() ?? null,
          graceDays: PAYMENT_GRACE_DAYS,
        },
      });
    }

    const lapsed = await this.prisma.subscription.findMany({
      where: {
        ...scope,
        status: { in: PAYMENT_PENDING_STATUSES },
        OR: [
          { endsAt: null, trialEndsAt: { lte: graceCutoff } },
          { endsAt: { lte: graceCutoff } },
        ],
      },
      select: { id: true, tenantId: true },
    });
    for (const row of lapsed) {
      const outcome = await this.suspendForNonPayment(row.id, now);
      if (!outcome) continue;
      result.suspended += 1;
      result.storesSuspended += outcome.storeIds.length;
    }
    return result;
  }

  /**
   * Marks a lapsed subscription EXPIRED and suspends the tenant's stores,
   * remembering each store's previous status. Deletes nothing.
   * Returns null when another run (or a payment) already handled it.
   */
  async suspendForNonPayment(
    subscriptionId: string,
    now = new Date(),
    options: { actorUserId?: string; req?: Request; force?: boolean } = {},
  ): Promise<{ storeIds: string[] } | null> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const expired = await tx.subscription.updateMany({
        where: {
          id: subscriptionId,
          status: options.force
            ? { notIn: [SubscriptionStatus.EXPIRED] }
            : { in: PAYMENT_PENDING_STATUSES },
        },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      if (expired.count === 0) return null;

      const subscription = await tx.subscription.findUniqueOrThrow({
        where: { id: subscriptionId },
        select: { tenantId: true },
      });
      // A separate paid subscription keeps the stores open.
      const paid = await tx.subscription.count({
        where: { tenantId: subscription.tenantId, status: SubscriptionStatus.ACTIVE },
      });
      if (paid > 0) return { tenantId: subscription.tenantId, stores: [] };

      const stores = await tx.store.findMany({
        where: { tenantId: subscription.tenantId, status: { not: StoreStatus.SUSPENDED } },
        select: { id: true, status: true },
      });
      const suspended: { id: string; previous: StoreStatus }[] = [];
      for (const store of stores) {
        const updated = await tx.store.updateMany({
          where: { id: store.id, status: store.status },
          data: { status: StoreStatus.SUSPENDED, statusBeforeBillingSuspension: store.status },
        });
        if (updated.count > 0) suspended.push({ id: store.id, previous: store.status });
      }
      return { tenantId: subscription.tenantId, stores: suspended };
    });
    if (!outcome) return null;

    await this.audit.log({
      action: 'SUBSCRIPTION_SUSPENDED_NON_PAYMENT',
      entityType: 'Subscription',
      entityId: subscriptionId,
      tenantId: outcome.tenantId,
      userId: options.actorUserId,
      metadata: { evaluatedAt: now.toISOString(), storesSuspended: outcome.stores.length },
      req: options.req,
    });
    for (const store of outcome.stores) {
      await this.audit.log({
        action: 'STORE_SUSPENDED_BILLING',
        entityType: 'Store',
        entityId: store.id,
        storeId: store.id,
        tenantId: outcome.tenantId,
        userId: options.actorUserId,
        metadata: { previousStatus: store.previous },
        req: options.req,
      });
    }
    await this.invalidateStorefrontCache(outcome.stores.map((store) => store.id));
    this.logger.log(
      `Subscription suspended for non-payment; ${outcome.stores.length} store(s) suspended`,
    );
    return { storeIds: outcome.stores.map((store) => store.id) };
  }

  /**
   * The only way a subscription becomes paid. Call it after a payment is
   * confirmed (provider-verified, or confirmed by a Super Admin); never
   * before. Idempotent: an already ACTIVE subscription is left as is apart
   * from restoring any stores still suspended for billing.
   */
  async activateAfterConfirmedPayment(params: {
    subscriptionId: string;
    confirmedAt?: Date;
    source: PaymentConfirmationSource;
    actorUserId?: string;
    req?: Request;
  }): Promise<{ activated: boolean; storesRestored: number; storesLaunched: number }> {
    const confirmedAt = params.confirmedAt ?? new Date();
    const outcome = await this.prisma.$transaction(async (tx) => {
      let activated = false;
      let subscription: Subscription | null = null;
      // A concurrent suspension can change the status between the read and the
      // conditional update; re-read so a confirmed payment always wins.
      for (let attempt = 0; attempt < 3 && !activated; attempt += 1) {
        subscription = await tx.subscription.findUnique({ where: { id: params.subscriptionId } });
        if (!subscription) {
          throw new NotFoundException('Subscription not found');
        }
        if (subscription.status === SubscriptionStatus.ACTIVE) break;
        const periodStart = paidPeriodStart(subscription, confirmedAt);
        const { months } = billingCycleDefinition(subscription.billingCycle);
        const updated = await tx.subscription.updateMany({
          where: { id: subscription.id, status: subscription.status },
          data: {
            status: SubscriptionStatus.ACTIVE,
            endsAt: addCalendarMonths(periodStart, months),
          },
        });
        activated = updated.count > 0;
      }
      if (!subscription || (!activated && subscription.status !== SubscriptionStatus.ACTIVE)) {
        throw new ConflictException('Subscription changed while confirming the payment; please retry');
      }

      const stores = await tx.store.findMany({
        where: {
          tenantId: subscription.tenantId,
          status: StoreStatus.SUSPENDED,
          statusBeforeBillingSuspension: { not: null },
        },
        select: { id: true, statusBeforeBillingSuspension: true },
      });
      for (const store of stores) {
        await tx.store.update({
          where: { id: store.id },
          data: { status: store.statusBeforeBillingSuspension!, statusBeforeBillingSuspension: null },
        });
      }

      // Stores created at sign-up wait offline for their first payment; it
      // has now been confirmed, so they go live. A store a Super Admin
      // suspended meanwhile stays suspended.
      const awaiting = await tx.store.findMany({
        where: { tenantId: subscription.tenantId, awaitingFirstPayment: true },
        select: { id: true, status: true },
      });
      const launchedIds = awaiting.filter((store) => store.status === StoreStatus.INACTIVE).map((store) => store.id);
      if (launchedIds.length > 0) {
        await tx.store.updateMany({
          where: { id: { in: launchedIds }, status: StoreStatus.INACTIVE },
          data: { status: StoreStatus.ACTIVE },
        });
      }
      if (awaiting.length > 0) {
        await tx.store.updateMany({
          where: { id: { in: awaiting.map((store) => store.id) } },
          data: { awaitingFirstPayment: false },
        });
      }
      return {
        tenantId: subscription.tenantId,
        activated,
        storeIds: stores.map((store) => store.id),
        launchedIds,
      };
    });

    if (outcome.activated) {
      await this.audit.log({
        action: 'SUBSCRIPTION_ACTIVATED',
        entityType: 'Subscription',
        entityId: params.subscriptionId,
        tenantId: outcome.tenantId,
        userId: params.actorUserId,
        metadata: { source: params.source, confirmedAt: confirmedAt.toISOString() },
        req: params.req,
      });
    }
    for (const storeId of outcome.storeIds) {
      await this.audit.log({
        action: 'STORE_REACTIVATED_BILLING',
        entityType: 'Store',
        entityId: storeId,
        storeId,
        tenantId: outcome.tenantId,
        userId: params.actorUserId,
        req: params.req,
      });
    }
    for (const storeId of outcome.launchedIds) {
      await this.audit.log({
        action: 'STORE_LAUNCHED_AFTER_FIRST_PAYMENT',
        entityType: 'Store',
        entityId: storeId,
        storeId,
        tenantId: outcome.tenantId,
        userId: params.actorUserId,
        req: params.req,
      });
    }
    await this.invalidateStorefrontCache([...outcome.storeIds, ...outcome.launchedIds]);
    return {
      activated: outcome.activated,
      storesRestored: outcome.storeIds.length,
      storesLaunched: outcome.launchedIds.length,
    };
  }

  private async invalidateStorefrontCache(storeIds: string[]): Promise<void> {
    if (storeIds.length === 0) return;
    const domains = await this.prisma.domain.findMany({
      where: { storeId: { in: storeIds } },
      select: { hostname: true },
    });
    if (domains.length === 0) return;
    try {
      await this.redis
        .getClient()
        .del(...domains.map((domain) => domainResolutionCacheKey(domain.hostname.toLowerCase())));
    } catch {
      // Best-effort; the resolver cache TTL bounds staleness and request paths re-check the store.
    }
  }
}

export function pickCurrent<T extends Pick<Subscription, 'status' | 'createdAt'>>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort(
    (a, b) =>
      STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  )[0]!;
}

/**
 * Paying during the trial starts the paid period when the trial ends; paying
 * before the grace deadline covers the period from the original due date;
 * paying after the grace period (or reactivating a cancelled subscription)
 * starts from the payment date. Dates decide, not whether the scheduler has
 * already moved the status.
 */
function paidPeriodStart(subscription: Subscription, confirmedAt: Date): Date {
  const pending = PAYMENT_PENDING_STATUSES.some((status) => status === subscription.status);
  const dueFrom = subscription.endsAt ?? subscription.trialEndsAt;
  if (pending && dueFrom && confirmedAt < paymentDeadline(dueFrom)) {
    return dueFrom;
  }
  return confirmedAt;
}
