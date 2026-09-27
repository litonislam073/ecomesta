import { CouponType, Prisma } from '@prisma/client';
import {
  calculateCouponDiscount,
  normalizeCouponCode,
} from '../src/modules/coupons/coupon-math';

describe('coupon-math', () => {
  describe('normalizeCouponCode', () => {
    it('trims and uppercases codes', () => {
      expect(normalizeCouponCode('  summer10  ')).toBe('SUMMER10');
      expect(normalizeCouponCode('SAVE5')).toBe('SAVE5');
    });
  });

  describe('calculateCouponDiscount', () => {
    const subtotal = new Prisma.Decimal('100.00');

    it('calculates percentage discounts', () => {
      const discount = calculateCouponDiscount(
        {
          type: CouponType.PERCENTAGE,
          value: new Prisma.Decimal('10'),
          maximumDiscountAmount: null,
        },
        subtotal,
      );
      expect(discount.toFixed(2)).toBe('10.00');
    });

    it('calculates fixed-amount discounts', () => {
      const discount = calculateCouponDiscount(
        {
          type: CouponType.FIXED_AMOUNT,
          value: new Prisma.Decimal('15.50'),
          maximumDiscountAmount: null,
        },
        subtotal,
      );
      expect(discount.toFixed(2)).toBe('15.50');
    });

    it('applies maximum discount cap', () => {
      const discount = calculateCouponDiscount(
        {
          type: CouponType.PERCENTAGE,
          value: new Prisma.Decimal('50'),
          maximumDiscountAmount: new Prisma.Decimal('20.00'),
        },
        subtotal,
      );
      expect(discount.toFixed(2)).toBe('20.00');
    });

    it('never exceeds the merchandise subtotal', () => {
      const discount = calculateCouponDiscount(
        {
          type: CouponType.FIXED_AMOUNT,
          value: new Prisma.Decimal('250.00'),
          maximumDiscountAmount: null,
        },
        subtotal,
      );
      expect(discount.toFixed(2)).toBe('100.00');
    });

    it('returns zero for non-positive subtotals', () => {
      const discount = calculateCouponDiscount(
        {
          type: CouponType.PERCENTAGE,
          value: new Prisma.Decimal('10'),
          maximumDiscountAmount: null,
        },
        new Prisma.Decimal('0'),
      );
      expect(discount.toFixed(2)).toBe('0.00');
    });
  });
});
