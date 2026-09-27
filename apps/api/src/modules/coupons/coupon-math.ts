import { CouponType, Prisma, type Coupon } from '@prisma/client';

export type CouponCustomerIdentity = {
  customerId?: string | null;
  email?: string | null;
};

export type CouponDiscountResult = {
  coupon: Coupon;
  code: string;
  discount: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  finalSubtotal: Prisma.Decimal;
};

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isSupportedCouponType(type: CouponType): boolean {
  return type === CouponType.PERCENTAGE || type === CouponType.FIXED_AMOUNT;
}

/**
 * Calculates discount against eligible merchandise subtotal.
 * Never exceeds subtotal; never returns negative.
 */
export function calculateCouponDiscount(
  coupon: Pick<Coupon, 'type' | 'value' | 'maximumDiscountAmount'>,
  subtotal: Prisma.Decimal,
): Prisma.Decimal {
  const zero = new Prisma.Decimal(0);
  if (subtotal.lte(0)) {
    return zero;
  }

  let raw: Prisma.Decimal;
  if (coupon.type === CouponType.PERCENTAGE) {
    raw = subtotal.mul(coupon.value).div(100);
  } else if (coupon.type === CouponType.FIXED_AMOUNT) {
    raw = new Prisma.Decimal(coupon.value);
  } else {
    // FREE_SHIPPING and any unknown types: not supported in Phase 14 engine
    return zero;
  }

  if (coupon.maximumDiscountAmount && raw.gt(coupon.maximumDiscountAmount)) {
    raw = new Prisma.Decimal(coupon.maximumDiscountAmount);
  }

  if (raw.gt(subtotal)) {
    raw = subtotal;
  }
  if (raw.lt(0)) {
    return zero;
  }
  return new Prisma.Decimal(raw.toFixed(2));
}
