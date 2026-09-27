import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type SubscriptionPlan } from '@prisma/client';
import type { Request } from 'express';
import {
  moneyToString,
  normalizePagination,
  pageMeta,
  parseMoney,
} from '../../common/utils/catalog.util';
import { billingCyclePrice } from '@ecomesta/utils';
import { AuditService } from '../audit/audit.service';
import { toPublicPlan } from '../billing/plan-catalog';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSubscriptionPlanDto,
  ListAdminPlansQueryDto,
  UpdateSubscriptionPlanDto,
  UpdateSubscriptionPlanStatusDto,
} from './dto/admin-plan.dto';

export function normalizePlanSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

function derivedYearlyPrice(monthlyPrice: Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(billingCyclePrice(monthlyPrice.toString(), 'YEARLY'));
}

@Injectable()
export class AdminPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async list(actingUserId: string, query: ListAdminPlansQueryDto) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const { page, limit, skip } = normalizePagination(query);
    const where: Prisma.SubscriptionPlanWhereInput = {};
    if (query.active !== undefined) where.active = query.active;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscriptionPlan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.subscriptionPlan.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: items.map((plan) => this.toDto(plan)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getOne(actingUserId: string, planId: string) {
    await this.authorization.assertSuperAdmin(actingUserId);
    const plan = await this.requirePlan(planId);
    return { success: true as const, data: this.toDto(plan) };
  }

  async create(
    actingUserId: string,
    dto: CreateSubscriptionPlanDto,
    req?: Request,
  ) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const slug = normalizePlanSlug(dto.slug);
    if (!slug) {
      throw new BadRequestException('slug is required');
    }
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }

    const monthlyPrice = parseMoney(dto.monthlyPrice, 'monthlyPrice');
    const data: Prisma.SubscriptionPlanCreateInput = {
      name,
      slug,
      description: dto.description?.trim() || null,
      monthlyPrice,
      yearlyPrice:
        dto.yearlyPrice === undefined || dto.yearlyPrice === ''
          ? derivedYearlyPrice(monthlyPrice)
          : parseMoney(dto.yearlyPrice, 'yearlyPrice'),
      active: dto.active ?? true,
    };
    if (dto.configuration !== undefined) {
      data.configuration = dto.configuration as Prisma.InputJsonValue;
    }

    let plan: SubscriptionPlan;
    try {
      plan = await this.prisma.subscriptionPlan.create({ data });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A plan with this slug already exists');
      }
      throw err;
    }

    await this.audit.log({
      action: 'PLAN_CREATED',
      entityType: 'SubscriptionPlan',
      entityId: plan.id,
      userId: actingUserId,
      metadata: {
        slug: plan.slug,
        monthlyPrice: moneyToString(plan.monthlyPrice),
        yearlyPrice: moneyToString(plan.yearlyPrice),
        active: plan.active,
      },
      req,
    });

    return { success: true as const, data: this.toDto(plan) };
  }

  async update(
    actingUserId: string,
    planId: string,
    dto: UpdateSubscriptionPlanDto,
    req?: Request,
  ) {
    await this.authorization.assertSuperAdmin(actingUserId);
    const existing = await this.requirePlan(planId);

    const data: Prisma.SubscriptionPlanUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('name is required');
      data.name = name;
    }
    if (dto.slug !== undefined) {
      const slug = normalizePlanSlug(dto.slug);
      if (!slug) throw new BadRequestException('slug is required');
      data.slug = slug;
    }
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }
    if (dto.monthlyPrice !== undefined) {
      const monthlyPrice = parseMoney(dto.monthlyPrice, 'monthlyPrice');
      data.monthlyPrice = monthlyPrice;
      // Keep the stored yearly price in step with the monthly reference price.
      if (dto.yearlyPrice === undefined || dto.yearlyPrice === '') {
        data.yearlyPrice = derivedYearlyPrice(monthlyPrice);
      }
    }
    if (dto.yearlyPrice !== undefined && dto.yearlyPrice !== '') {
      data.yearlyPrice = parseMoney(dto.yearlyPrice, 'yearlyPrice');
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }
    if (dto.configuration !== undefined) {
      data.configuration =
        dto.configuration === null
          ? Prisma.JsonNull
          : (dto.configuration as Prisma.InputJsonValue);
    }

    let plan: SubscriptionPlan;
    try {
      plan = await this.prisma.subscriptionPlan.update({
        where: { id: existing.id },
        data,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A plan with this slug already exists');
      }
      throw err;
    }

    const deactivated = existing.active && plan.active === false;
    await this.audit.log({
      action: deactivated ? 'PLAN_DEACTIVATED' : 'PLAN_UPDATED',
      entityType: 'SubscriptionPlan',
      entityId: plan.id,
      userId: actingUserId,
      metadata: { slug: plan.slug, active: plan.active },
      req,
    });

    return { success: true as const, data: this.toDto(plan) };
  }

  async updateStatus(
    actingUserId: string,
    planId: string,
    dto: UpdateSubscriptionPlanStatusDto,
    req?: Request,
  ) {
    return this.update(actingUserId, planId, { active: dto.active }, req);
  }

  private async requirePlan(planId: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    return plan;
  }

  toDto(plan: SubscriptionPlan) {
    const pricing = toPublicPlan(plan);
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      monthlyPrice: moneyToString(plan.monthlyPrice)!,
      yearlyPrice: moneyToString(plan.yearlyPrice)!,
      currency: pricing.currency,
      trialMonths: pricing.trialMonths,
      prices: pricing.prices,
      active: plan.active,
      configuration: plan.configuration,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
