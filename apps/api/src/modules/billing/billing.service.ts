import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BillingPaymentStatus,
  MembershipStatus,
  SubscriptionStatus,
  TenantRole,
  type BillingCycle,
  type Subscription,
  type SubscriptionPlan,
} from '@prisma/client';
import type { Request } from 'express';
import type { MerchantSubscription, PublicPlan } from '@ecomesta/types';
import { billingCyclePrice, paymentDeadline, paymentDueFrom } from '@ecomesta/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PAYMENT_INCLUDE, toMerchantBillingPayment } from './billing-payment.mapper';
import { planMonthlyPrice, readPlanLimits, readPlanSettings, sortPlans, toPublicPlan } from './plan-catalog';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

/**
 * Paid subscription checkout is not switched on yet. When it is, a verified
 * provider payment calls SubscriptionLifecycleService.activateAfterConfirmedPayment.
 */
export const SUBSCRIPTION_ONLINE_PAYMENT_ENABLED = false;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly lifecycle: SubscriptionLifecycleService,
  ) {}

  async listPublicPlans(): Promise<{ success: true; data: PublicPlan[] }> {
    const plans = await this.prisma.subscriptionPlan.findMany({ where: { active: true } });
    return { success: true, data: sortPlans(plans).map(toPublicPlan) };
  }

  /** Active plan by slug, for onboarding and plan selection. */
  async requireActivePlan(planSlug: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } });
    if (!plan || !plan.active) {
      throw new UnprocessableEntityException('Selected plan is not available');
    }
    return plan;
  }

  async getForUser(userId: string, tenantSlug?: string): Promise<{ success: true; data: MerchantSubscription }> {
    const tenant = await this.resolveTenant(userId, tenantSlug);
    await this.lifecycle.evaluateTenant(tenant.id);
    const [current, canManage, pending] = await Promise.all([
      this.lifecycle.currentForTenant(tenant.id),
      this.authorization.hasTenantRole(userId, tenant.id, [TenantRole.OWNER, TenantRole.ADMIN]),
      this.prisma.billingPayment.findFirst({
        where: { tenantId: tenant.id, status: BillingPaymentStatus.PENDING },
        include: PAYMENT_INCLUDE,
      }),
    ]);
    return {
      success: true,
      data: {
        tenantName: tenant.name,
        canManage,
        onlinePaymentAvailable: SUBSCRIPTION_ONLINE_PAYMENT_ENABLED,
        subscription: current ? this.toMerchantDto(current) : null,
        pendingPayment: pending ? toMerchantBillingPayment(pending) : null,
      },
    };
  }

  /**
   * Starts the free trial on the chosen plan when the business has never had
   * a subscription. During the trial the business may switch to the same or a
   * cheaper plan, or change billing period; a more expensive plan only unlocks
   * through an approved payment (BillingPaymentsService). After the trial every
   * plan change goes through a payment.
   */
  async selectPlan(
    userId: string,
    input: { planSlug: string; billingCycle: BillingCycle; tenant?: string },
    req?: Request,
  ) {
    const tenant = await this.resolveTenant(userId, input.tenant);
    await this.authorization.assertTenantRole(userId, tenant.id, [TenantRole.OWNER, TenantRole.ADMIN]);
    const plan = await this.requireActivePlan(input.planSlug);

    const outcome = await this.prisma.$transaction(async (tx) => {
      const current = await this.lifecycle.currentForTenant(tenant.id, tx);
      if (!current) {
        const created = await this.lifecycle.startTrial(tx, {
          tenantId: tenant.id,
          plan,
          billingCycle: input.billingCycle,
        });
        return { action: 'SUBSCRIPTION_TRIAL_STARTED' as const, subscription: created };
      }
      if (current.status !== SubscriptionStatus.TRIALING) {
        throw new ConflictException(
          'Plan changes take effect once your payment is confirmed. Choose the plan and pay for it below.',
        );
      }
      if (planMonthlyPrice(plan) > planMonthlyPrice(current.plan)) {
        throw new HttpException(
          {
            message: `${plan.name} unlocks once your payment is confirmed. Pay for ${plan.name} below to upgrade.`,
            error: 'Payment Required',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      const updated = await tx.subscription.update({
        where: { id: current.id },
        data: { planId: plan.id, billingCycle: input.billingCycle },
      });
      return { action: 'SUBSCRIPTION_PLAN_CHANGED' as const, subscription: updated };
    });

    await this.audit.log({
      action: outcome.action,
      entityType: 'Subscription',
      entityId: outcome.subscription.id,
      tenantId: tenant.id,
      userId,
      metadata: {
        planSlug: plan.slug,
        billingCycle: outcome.subscription.billingCycle,
        status: outcome.subscription.status,
        trialEndsAt: outcome.subscription.trialEndsAt?.toISOString() ?? null,
      },
      req,
    });
    return this.getForUser(userId, tenant.slug);
  }

  async resolveTenant(userId: string, tenantSlug?: string) {
    const membership = await this.prisma.tenantUser.findFirst({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        ...(tenantSlug ? { tenant: { slug: tenantSlug } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    if (!membership) {
      throw new NotFoundException('No business account found');
    }
    await this.authorization.assertTenantAccess(userId, membership.tenant.id);
    return membership.tenant;
  }

  toMerchantDto(
    subscription: Subscription & { plan: SubscriptionPlan },
  ): NonNullable<MerchantSubscription['subscription']> {
    const monthlyPrice = planMonthlyPrice(subscription.plan);
    const dueFrom = paymentDueFrom(subscription);
    const awaitingPayment =
      subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.CANCELLED;
    return {
      status: subscription.status,
      phase: this.lifecycle.phaseOf(subscription),
      billingCycle: subscription.billingCycle,
      startsAt: subscription.startsAt.toISOString(),
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      endsAt: subscription.endsAt?.toISOString() ?? null,
      paymentDueBy: awaitingPayment && dueFrom ? paymentDeadline(dueFrom).toISOString() : null,
      currency: 'BDT',
      amountDue: billingCyclePrice(monthlyPrice, subscription.billingCycle),
      plan: {
        name: subscription.plan.name,
        slug: subscription.plan.slug,
        monthlyPrice,
        trialMonths: readPlanSettings(subscription.plan.configuration).trialMonths,
        limits: readPlanLimits(subscription.plan.configuration),
      },
    };
  }
}
