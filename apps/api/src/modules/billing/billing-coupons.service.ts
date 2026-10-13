import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCouponType,
  BillingPaymentStatus,
  Prisma,
  type BillingCoupon,
  type BillingCycle,
  type SubscriptionPlan,
} from '@prisma/client';
import type { Request } from 'express';
import type { AdminBillingCoupon, BillingCouponQuote } from '@ecomesta/types';
import { billingCycleDefinition, billingCyclePrice } from '@ecomesta/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from './billing.service';
import type { CreateBillingCouponDto, UpdateBillingCouponDto } from './dto/billing-coupon.dto';
import { planMonthlyPrice } from './plan-catalog';

/** Payments that hold a coupon use: waiting for review or confirmed. A rejection gives it back. */
const COUNTED: BillingPaymentStatus[] = [BillingPaymentStatus.PENDING, BillingPaymentStatus.APPROVED];

/** Codes are letters, digits, dashes and underscores, stored upper-case. */
export function normalizeCouponCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code) ? code : null;
}

/**
 * Taka off a list price. Percentages round down to whole taka; fixed amounts
 * never go above the price. Prices are whole taka, so the result is too.
 */
export function couponDiscount(coupon: Pick<BillingCoupon, 'type' | 'value'>, listAmount: number): number {
  const value = Number(coupon.value);
  const off = coupon.type === BillingCouponType.PERCENTAGE ? Math.floor((listAmount * value) / 100) : Math.floor(value);
  return Math.max(0, Math.min(off, listAmount));
}

export interface AppliedCoupon {
  coupon: BillingCoupon;
  listAmount: number;
  discountAmount: number;
  amount: number;
}

/**
 * Super Admin discount codes for plan payments. A merchant checks a code
 * before paying (so they send the discounted amount), and the same rules are
 * applied again — under a row lock — when the payment is recorded.
 */
@Injectable()
export class BillingCouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  /** What a code takes off a plan for this merchant (nothing is reserved). */
  async quote(
    userId: string,
    input: { code: string; planSlug: string; billingCycle: BillingCycle; tenant?: string },
  ): Promise<{ success: true; data: BillingCouponQuote }> {
    const plan = await this.billing.requireActivePlan(input.planSlug);
    // Sign-up has no business yet; the billing page has one.
    const tenantId = await this.billing
      .resolveTenant(userId, input.tenant)
      .then((tenant) => tenant.id)
      .catch(() => null);
    const applied = await this.apply(this.prisma, { code: input.code, plan, billingCycle: input.billingCycle, tenantId });
    return { success: true, data: this.toQuote(applied) };
  }

  /**
   * Checks a code against a plan and period and returns the discounted price,
   * or throws a 400 with the message the merchant sees. With `lock`, the coupon
   * row is locked first so two payments cannot both take its last use.
   */
  async apply(
    db: Prisma.TransactionClient | PrismaService,
    params: { code: string; plan: SubscriptionPlan; billingCycle: BillingCycle; tenantId: string | null; lock?: boolean },
  ): Promise<AppliedCoupon> {
    const code = normalizeCouponCode(params.code);
    const invalid = new BadRequestException('This coupon code is not valid.');
    if (!code) throw invalid;
    let coupon = await db.billingCoupon.findUnique({ where: { code } });
    if (!coupon) throw invalid;
    if (params.lock) {
      await db.$queryRaw`SELECT id FROM billing_coupons WHERE id = ${coupon.id}::uuid FOR UPDATE`;
      coupon = (await db.billingCoupon.findUnique({ where: { id: coupon.id } }))!;
    }
    const now = new Date();
    if (!coupon.active) throw invalid;
    if (coupon.startsAt && coupon.startsAt > now) throw new BadRequestException('This coupon is not active yet.');
    if (coupon.endsAt && coupon.endsAt <= now) throw new BadRequestException('This coupon has expired.');
    if (coupon.planSlugs.length > 0 && !coupon.planSlugs.includes(params.plan.slug)) {
      throw new BadRequestException(`This coupon is not for the ${params.plan.name} plan.`);
    }
    if (coupon.billingCycles.length > 0 && !coupon.billingCycles.includes(params.billingCycle)) {
      const periods = coupon.billingCycles.map((cycle) => billingCycleDefinition(cycle).label.toLowerCase()).join(' or ');
      throw new BadRequestException(`This coupon works only with ${periods} billing.`);
    }
    if (coupon.maxRedemptions !== null) {
      const used = await db.billingPayment.count({ where: { couponId: coupon.id, status: { in: COUNTED } } });
      if (used >= coupon.maxRedemptions) throw new BadRequestException('This coupon has been fully used.');
    }
    if (params.tenantId && coupon.maxPerTenant !== null) {
      const usedByTenant = await db.billingPayment.count({
        where: { couponId: coupon.id, tenantId: params.tenantId, status: { in: COUNTED } },
      });
      if (usedByTenant >= coupon.maxPerTenant) throw new BadRequestException('You have already used this coupon.');
    }
    const listAmount = billingCyclePrice(planMonthlyPrice(params.plan), params.billingCycle);
    const discountAmount = couponDiscount(coupon, listAmount);
    const amount = listAmount - discountAmount;
    // A wallet payment needs something to send: a coupon cannot make a plan free.
    if (discountAmount <= 0 || amount < 1) throw new BadRequestException('This coupon cannot be used for this plan.');
    return { coupon, listAmount, discountAmount, amount };
  }

  toQuote(applied: AppliedCoupon): BillingCouponQuote {
    return {
      code: applied.coupon.code,
      description: applied.coupon.description,
      listAmount: applied.listAmount,
      discountAmount: applied.discountAmount,
      amount: applied.amount,
    };
  }

  // --- Super Admin -----------------------------------------------------------

  async adminList(): Promise<{ success: true; data: AdminBillingCoupon[] }> {
    const coupons = await this.prisma.billingCoupon.findMany({ orderBy: { createdAt: 'desc' } });
    const counts = await this.prisma.billingPayment.groupBy({
      by: ['couponId', 'status'],
      where: { couponId: { in: coupons.map((c) => c.id) } },
      _count: { _all: true },
      _sum: { discountAmount: true },
    });
    return {
      success: true,
      data: coupons.map((coupon) => {
        const rows = counts.filter((row) => row.couponId === coupon.id);
        const count = (status: BillingPaymentStatus) => rows.find((row) => row.status === status)?._count._all ?? 0;
        const approvedDiscount = Number(rows.find((row) => row.status === BillingPaymentStatus.APPROVED)?._sum.discountAmount ?? 0);
        return this.toAdminDto(coupon, { pending: count(BillingPaymentStatus.PENDING), approved: count(BillingPaymentStatus.APPROVED), approvedDiscount });
      }),
    };
  }

  async create(adminUserId: string, dto: CreateBillingCouponDto, req?: Request) {
    const code = normalizeCouponCode(dto.code);
    if (!code) throw new BadRequestException('Use 3–32 letters, numbers, dashes or underscores for the code');
    const data = this.validate(dto);
    let coupon: BillingCoupon;
    try {
      coupon = await this.prisma.billingCoupon.create({
        data: { ...data, code, type: dto.type, value: dto.value, createdByUserId: adminUserId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A coupon with the code ${code} already exists`);
      }
      throw err;
    }
    await this.audit.log({
      action: 'BILLING_COUPON_CREATED',
      entityType: 'BillingCoupon',
      entityId: coupon.id,
      userId: adminUserId,
      metadata: { code, type: coupon.type, value: Number(coupon.value) },
      req,
    });
    return { success: true as const, data: this.toAdminDto(coupon, { pending: 0, approved: 0, approvedDiscount: 0 }) };
  }

  /** Changes a coupon. The code and the discount stay fixed once it exists. */
  async update(adminUserId: string, couponId: string, dto: UpdateBillingCouponDto, req?: Request) {
    const existing = await this.prisma.billingCoupon.findUnique({ where: { id: couponId } });
    if (!existing) throw new NotFoundException('Coupon not found');
    const data = this.validate({ ...dto, type: existing.type, value: Number(existing.value) }, true);
    const coupon = await this.prisma.billingCoupon.update({ where: { id: couponId }, data });
    await this.audit.log({
      action: 'BILLING_COUPON_UPDATED',
      entityType: 'BillingCoupon',
      entityId: coupon.id,
      userId: adminUserId,
      metadata: { code: coupon.code, changed: Object.keys(data) },
      req,
    });
    const list = await this.adminList();
    return { success: true as const, data: list.data.find((item) => item.id === coupon.id)! };
  }

  /** Field rules shared by create and update; `partial` keeps fields that were not sent. */
  private validate(dto: Partial<CreateBillingCouponDto>, partial = false) {
    if (!partial || dto.value !== undefined) {
      const value = Number(dto.value);
      if (dto.type === BillingCouponType.PERCENTAGE && !(Number.isInteger(value) && value >= 1 && value <= 99)) {
        throw new BadRequestException('A percentage discount must be a whole number from 1 to 99');
      }
      if (dto.type === BillingCouponType.FIXED_AMOUNT && !(Number.isInteger(value) && value >= 1)) {
        throw new BadRequestException('A fixed discount must be at least ৳1, in whole taka');
      }
    }
    const startsAt = dto.startsAt === undefined ? undefined : dto.startsAt ? new Date(dto.startsAt) : null;
    const endsAt = dto.endsAt === undefined ? undefined : dto.endsAt ? new Date(dto.endsAt) : null;
    if (startsAt && endsAt && endsAt <= startsAt) throw new BadRequestException('The end date must be after the start date');
    const data: Prisma.BillingCouponUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.planSlugs !== undefined) data.planSlugs = [...new Set(dto.planSlugs)];
    if (dto.billingCycles !== undefined) data.billingCycles = [...new Set(dto.billingCycles)];
    if (dto.maxRedemptions !== undefined) data.maxRedemptions = dto.maxRedemptions;
    if (dto.maxPerTenant !== undefined) data.maxPerTenant = dto.maxPerTenant;
    if (startsAt !== undefined) data.startsAt = startsAt;
    if (endsAt !== undefined) data.endsAt = endsAt;
    if (dto.active !== undefined) data.active = dto.active;
    return data as Omit<Prisma.BillingCouponCreateInput, 'code' | 'type' | 'value'>;
  }

  private toAdminDto(coupon: BillingCoupon, usage: { pending: number; approved: number; approvedDiscount: number }): AdminBillingCoupon {
    return {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      type: coupon.type,
      value: Number(coupon.value),
      planSlugs: coupon.planSlugs,
      billingCycles: coupon.billingCycles,
      maxRedemptions: coupon.maxRedemptions,
      maxPerTenant: coupon.maxPerTenant,
      startsAt: coupon.startsAt?.toISOString() ?? null,
      endsAt: coupon.endsAt?.toISOString() ?? null,
      active: coupon.active,
      usedCount: usage.pending + usage.approved,
      pendingCount: usage.pending,
      approvedDiscountTotal: usage.approvedDiscount,
      createdAt: coupon.createdAt.toISOString(),
    };
  }
}
