import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CouponType, OrderStatus, Prisma, type Coupon } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_UPGRADE_REQUIRED, PlanEntitlementsService } from '../billing/plan-entitlements.service';
import {
  calculateCouponDiscount,
  isSupportedCouponType,
  normalizeCouponCode,
  type CouponCustomerIdentity,
  type CouponDiscountResult,
} from './coupon-math';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CouponValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  /**
   * Preview validation outside a placement transaction (public validate / UI).
   * Does NOT lock the coupon row — checkout must re-validate with lock.
   */
  async validateForStore(params: {
    storeId: string;
    code: string;
    subtotal: Prisma.Decimal;
    identity?: CouponCustomerIdentity;
    now?: Date;
  }): Promise<CouponDiscountResult> {
    const code = normalizeCouponCode(params.code);
    if (!code || code.length > 64) {
      throw new BadRequestException('Invalid coupon code');
    }

    await this.assertCouponsIncluded(params.storeId, this.prisma);

    const coupon = await this.prisma.coupon.findFirst({
      where: { storeId: params.storeId, code },
    });
    if (!coupon) {
      throw new UnprocessableEntityException('Coupon is not valid');
    }

    return this.assertCouponApplicable({
      coupon,
      subtotal: params.subtotal,
      identity: params.identity,
      now: params.now ?? new Date(),
      usageCount: coupon.usageCount,
      client: this.prisma,
    });
  }

  /**
   * Transaction-safe apply: locks coupon row, re-checks limits, returns discount.
   * Caller must create CouponUsage and increment usageCount after order create.
   */
  async lockAndValidate(
    tx: Tx,
    params: {
      storeId: string;
      code: string;
      subtotal: Prisma.Decimal;
      identity?: CouponCustomerIdentity;
      now?: Date;
    },
  ): Promise<CouponDiscountResult> {
    const code = normalizeCouponCode(params.code);
    if (!code || code.length > 64) {
      throw new BadRequestException('Invalid coupon code');
    }

    await this.assertCouponsIncluded(params.storeId, tx);

    const rows = await tx.$queryRaw<
      {
        id: string;
        store_id: string;
        code: string;
        type: CouponType;
        value: Prisma.Decimal;
        minimum_order_amount: Prisma.Decimal | null;
        maximum_discount_amount: Prisma.Decimal | null;
        usage_limit: number | null;
        usage_count: number;
        per_customer_limit: number | null;
        starts_at: Date | null;
        expires_at: Date | null;
        active: boolean;
        created_at: Date;
        updated_at: Date;
      }[]
    >`
      SELECT *
      FROM coupons
      WHERE store_id = ${params.storeId}::uuid
        AND code = ${code}
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) {
      throw new UnprocessableEntityException('Coupon is not valid');
    }

    const coupon: Coupon = {
      id: row.id,
      storeId: row.store_id,
      code: row.code,
      type: row.type,
      value: row.value,
      minimumOrderAmount: row.minimum_order_amount,
      maximumDiscountAmount: row.maximum_discount_amount,
      usageLimit: row.usage_limit,
      usageCount: row.usage_count,
      perCustomerLimit: row.per_customer_limit,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return this.assertCouponApplicable({
      coupon,
      subtotal: params.subtotal,
      identity: params.identity,
      now: params.now ?? new Date(),
      usageCount: coupon.usageCount,
      client: tx,
    });
  }

  /**
   * Coupons are a plan feature. A store whose current plan does not include
   * them (e.g. after a downgrade to Starter) keeps its coupons, but none can be
   * redeemed — every code gets the same refusal, so codes cannot be probed.
   */
  private async assertCouponsIncluded(storeId: string, db: Tx | PrismaService) {
    if (await this.entitlements.storeHasFeature(storeId, 'coupons', db)) return;
    throw new UnprocessableEntityException({
      message: 'Coupons are not available at this store.',
      error: PLAN_UPGRADE_REQUIRED,
    });
  }

  async countIdentityUsages(
    client: Tx | PrismaService,
    couponId: string,
    storeId: string,
    identity?: CouponCustomerIdentity,
  ): Promise<number> {
    // SF-02: redemptions on cancelled orders were released and do not count.
    if (identity?.customerId) {
      return client.couponUsage.count({
        where: {
          couponId,
          customerId: identity.customerId,
          order: { status: { not: OrderStatus.CANCELLED } },
        },
      });
    }
    const email = identity?.email?.trim().toLowerCase();
    if (!email) {
      return 0;
    }
    return client.couponUsage.count({
      where: {
        couponId,
        order: {
          storeId,
          status: { not: OrderStatus.CANCELLED },
          addresses: {
            some: {
              email: { equals: email, mode: 'insensitive' },
            },
          },
        },
      },
    });
  }

  private async assertCouponApplicable(params: {
    coupon: Coupon;
    subtotal: Prisma.Decimal;
    identity?: CouponCustomerIdentity;
    now: Date;
    usageCount: number;
    client: Tx | PrismaService;
  }): Promise<CouponDiscountResult> {
    const { coupon } = params;

    if (!coupon.active) {
      throw new UnprocessableEntityException('Coupon is not valid');
    }
    if (!isSupportedCouponType(coupon.type)) {
      throw new UnprocessableEntityException('Coupon type is not supported');
    }
    if (coupon.value.lte(0)) {
      throw new UnprocessableEntityException('Coupon is not valid');
    }
    if (coupon.type === CouponType.PERCENTAGE && coupon.value.gt(100)) {
      throw new UnprocessableEntityException('Coupon is not valid');
    }

    if (coupon.startsAt && params.now < coupon.startsAt) {
      throw new UnprocessableEntityException('Coupon is not yet active');
    }
    if (coupon.expiresAt && params.now > coupon.expiresAt) {
      throw new UnprocessableEntityException('Coupon has expired');
    }

    if (
      coupon.usageLimit != null &&
      params.usageCount >= coupon.usageLimit
    ) {
      throw new UnprocessableEntityException('Coupon usage limit reached');
    }

    if (coupon.perCustomerLimit != null && coupon.perCustomerLimit > 0) {
      const used = await this.countIdentityUsages(
        params.client,
        coupon.id,
        coupon.storeId,
        params.identity,
      );
      if (used >= coupon.perCustomerLimit) {
        throw new UnprocessableEntityException(
          'Coupon per-customer limit reached',
        );
      }
    }

    if (
      coupon.minimumOrderAmount &&
      params.subtotal.lt(coupon.minimumOrderAmount)
    ) {
      throw new UnprocessableEntityException(
        'Order does not meet the coupon minimum subtotal',
      );
    }

    const discount = calculateCouponDiscount(coupon, params.subtotal);
    if (discount.lte(0)) {
      throw new UnprocessableEntityException('Coupon produces no discount');
    }

    return {
      coupon,
      code: normalizeCouponCode(coupon.code),
      discount,
      subtotal: params.subtotal,
      finalSubtotal: params.subtotal.sub(discount),
    };
  }

  async requireCoupon(storeId: string, couponId: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: couponId, storeId },
    });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return coupon;
  }
}
