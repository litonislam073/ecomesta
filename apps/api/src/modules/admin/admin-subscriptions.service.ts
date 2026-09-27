import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import type { Request } from 'express';
import {
  moneyToString,
  normalizePagination,
  pageMeta,
} from '../../common/utils/catalog.util';
import {
  billingCyclePrice,
  paymentDeadline,
  paymentDueFrom,
  subscriptionPhase,
  trialEndDate,
} from '@ecomesta/utils';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { planMonthlyPrice, readPlanSettings } from '../billing/plan-catalog';
import { SubscriptionLifecycleService } from '../billing/subscription-lifecycle.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSubscriptionDto,
  ListAdminSubscriptionsQueryDto,
  UpdateSubscriptionStatusDto,
} from './dto/admin-subscription.dto';
import { assertSubscriptionStatusTransition } from './subscription-transitions';

const SUBSCRIPTION_INCLUDE = {
  tenant: { select: { id: true, name: true, slug: true, status: true } },
  plan: {
    select: {
      id: true,
      name: true,
      slug: true,
      monthlyPrice: true,
      yearlyPrice: true,
      active: true,
      configuration: true,
    },
  },
} as const;

type SubscriptionWithRelations = Prisma.SubscriptionGetPayload<{
  include: typeof SUBSCRIPTION_INCLUDE;
}>;

@Injectable()
export class AdminSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly lifecycle: SubscriptionLifecycleService,
  ) {}

  async list(actingUserId: string, query: ListAdminSubscriptionsQueryDto) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const { page, limit, skip } = normalizePagination(query);
    const where: Prisma.SubscriptionWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.planId) where.planId = query.planId;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { tenant: { name: { contains: search, mode: 'insensitive' } } },
        { tenant: { slug: { contains: search, mode: 'insensitive' } } },
        { plan: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where,
        include: SUBSCRIPTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: items.map((item) => this.toDto(item)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getOne(actingUserId: string, subscriptionId: string) {
    await this.authorization.assertSuperAdmin(actingUserId);
    const subscription = await this.requireSubscription(subscriptionId);
    return { success: true as const, data: this.toDto(subscription) };
  }

  async create(
    actingUserId: string,
    dto: CreateSubscriptionDto,
    req?: Request,
  ) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const [tenant, plan] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: dto.tenantId },
        select: { id: true, slug: true },
      }),
      this.prisma.subscriptionPlan.findUnique({
        where: { id: dto.planId },
        select: { id: true, slug: true, active: true, configuration: true },
      }),
    ]);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    if (!plan.active) {
      throw new UnprocessableEntityException(
        'Cannot assign an inactive subscription plan',
      );
    }

    let startsAt = new Date();
    if (dto.startsAt) {
      startsAt = new Date(dto.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        throw new BadRequestException('startsAt is invalid');
      }
    }

    const status = dto.status ?? SubscriptionStatus.TRIALING;
    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        billingCycle: dto.billingCycle,
        status,
        startsAt,
        trialEndsAt:
          status === SubscriptionStatus.TRIALING
            ? trialEndDate(startsAt, readPlanSettings(plan.configuration).trialMonths)
            : null,
      },
      include: SUBSCRIPTION_INCLUDE,
    });

    await this.audit.log({
      action: 'SUBSCRIPTION_CREATED',
      entityType: 'Subscription',
      entityId: subscription.id,
      userId: actingUserId,
      tenantId: tenant.id,
      metadata: {
        planSlug: plan.slug,
        billingCycle: subscription.billingCycle,
        status: subscription.status,
      },
      req,
    });

    return { success: true as const, data: this.toDto(subscription) };
  }

  async updateStatus(
    actingUserId: string,
    subscriptionId: string,
    dto: UpdateSubscriptionStatusDto,
    req?: Request,
  ) {
    await this.authorization.assertSuperAdmin(actingUserId);
    const existing = await this.requireSubscription(subscriptionId);

    assertSubscriptionStatusTransition(existing.status, dto.status);

    // ACTIVE and EXPIRED also change store availability, so they go through the lifecycle.
    if (dto.status === SubscriptionStatus.ACTIVE) {
      await this.lifecycle.activateAfterConfirmedPayment({
        subscriptionId: existing.id,
        source: 'ADMIN_CONFIRMED',
        actorUserId: actingUserId,
        req,
      });
    } else if (dto.status === SubscriptionStatus.EXPIRED) {
      await this.lifecycle.suspendForNonPayment(existing.id, new Date(), {
        actorUserId: actingUserId,
        req,
        force: true,
      });
    } else {
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data: { status: dto.status },
      });
    }
    const subscription = await this.requireSubscription(existing.id);

    await this.audit.log({
      action: 'SUBSCRIPTION_STATUS_CHANGED',
      entityType: 'Subscription',
      entityId: subscription.id,
      userId: actingUserId,
      tenantId: subscription.tenantId,
      metadata: {
        previousStatus: existing.status,
        status: subscription.status,
        planSlug: subscription.plan.slug,
      },
      req,
    });

    return { success: true as const, data: this.toDto(subscription) };
  }

  private async requireSubscription(
    subscriptionId: string,
  ): Promise<SubscriptionWithRelations> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: SUBSCRIPTION_INCLUDE,
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    return subscription;
  }

  private toDto(subscription: SubscriptionWithRelations) {
    const dueFrom =
      subscription.status === SubscriptionStatus.ACTIVE ||
      subscription.status === SubscriptionStatus.CANCELLED
        ? null
        : paymentDueFrom(subscription);
    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      planId: subscription.planId,
      status: subscription.status,
      phase: subscriptionPhase(subscription),
      billingCycle: subscription.billingCycle,
      startsAt: subscription.startsAt,
      endsAt: subscription.endsAt,
      trialEndsAt: subscription.trialEndsAt,
      paymentDueBy: dueFrom ? paymentDeadline(dueFrom) : null,
      amountDue: billingCyclePrice(planMonthlyPrice(subscription.plan), subscription.billingCycle),
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      tenant: subscription.tenant,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        slug: subscription.plan.slug,
        active: subscription.plan.active,
        monthlyPrice: moneyToString(subscription.plan.monthlyPrice)!,
        yearlyPrice: moneyToString(subscription.plan.yearlyPrice)!,
        trialMonths: readPlanSettings(subscription.plan.configuration).trialMonths,
      },
    };
  }
}
