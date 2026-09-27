import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { StoreStatus, SubscriptionStatus, TenantStatus } from '@prisma/client';
import { subscriptionPhase } from '@ecomesta/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreUnavailableException } from './store-unavailable.exception';
import { SubscriptionLifecycleService, pickCurrent } from './subscription-lifecycle.service';

/**
 * Request-time enforcement for public store traffic. Store status is the
 * source of truth; the lapsed check only closes the gap between a grace
 * period ending and the next scheduled evaluation.
 */
@Injectable()
export class BillingAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: SubscriptionLifecycleService,
  ) {}

  /** True when payment was due and the grace period has run out. */
  async isTenantLapsed(tenantId: string, now = new Date()): Promise<boolean> {
    const rows = await this.prisma.subscription.findMany({
      where: {
        tenantId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE],
        },
      },
      select: { status: true, trialEndsAt: true, endsAt: true, createdAt: true },
    });
    const current = pickCurrent(rows);
    return current ? subscriptionPhase(current, now) === 'LAPSED' : false;
  }

  /** Suspends a lapsed tenant on the spot and refuses the request. */
  async assertTenantInGoodStanding(tenantId: string, now = new Date()): Promise<void> {
    if (await this.isTenantLapsed(tenantId, now)) {
      await this.lifecycle.evaluateTenant(tenantId, now);
      throw new StoreUnavailableException();
    }
  }

  /** Merchant-side gate for actions that would bring a new store online. */
  async assertTenantCanOperate(tenantId: string, now = new Date()): Promise<void> {
    await this.lifecycle.evaluateTenant(tenantId, now);
    const current = await this.lifecycle.currentForTenant(tenantId);
    if (current && current.status === SubscriptionStatus.EXPIRED) {
      throw new HttpException(
        {
          message: 'Your subscription payment is overdue. Complete your payment to reactivate your store.',
          error: 'Payment Required',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  async assertStoreInGoodStanding(storeId: string, now = new Date()): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { tenantId: true },
    });
    if (store) await this.assertTenantInGoodStanding(store.tenantId, now);
  }

  /**
   * Called after an ACTIVE-store lookup found nothing: a suspended store gets
   * the neutral "unavailable" response instead of a 404.
   */
  async throwIfSuspended(where: { slug: string } | { hostname: string }): Promise<void> {
    const store =
      'slug' in where
        ? await this.prisma.store.findFirst({
            where: { slug: where.slug },
            select: { status: true, tenant: { select: { status: true } } },
          })
        : (
            await this.prisma.domain.findFirst({
              where: { hostname: where.hostname },
              select: { store: { select: { status: true, tenant: { select: { status: true } } } } },
            })
          )?.store;
    if (
      store &&
      (store.status === StoreStatus.SUSPENDED || store.tenant.status === TenantStatus.SUSPENDED)
    ) {
      throw new StoreUnavailableException();
    }
  }
}
