import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { moneyToString } from '../../common/utils/catalog.util';
import { CouponValidationService } from '../coupons/coupon-validation.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ShippingQuoteDto } from './dto/shipping-quote.dto';
import { ShippingCalculationService } from './shipping-calculation.service';

/**
 * Public shipping quote: server recalculates cart + optional coupon,
 * then lists zone-matched methods with computed amounts.
 */
@Injectable()
export class ShippingQuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculation: ShippingCalculationService,
    private readonly coupons: CouponValidationService,
  ) {}

  async quote(storeId: string, dto: ShippingQuoteDto) {
    const priced = await this.computeCartSubtotal(storeId, dto.items);
    let discount = new Prisma.Decimal(0);
    let couponCode: string | null = null;

    if (dto.couponCode?.trim()) {
      try {
        const applied = await this.coupons.validateForStore({
          storeId,
          code: dto.couponCode,
          subtotal: priced.subtotal,
        });
        discount = applied.discount;
        couponCode = applied.code;
      } catch (err) {
        if (
          err instanceof UnprocessableEntityException ||
          err instanceof BadRequestException ||
          err instanceof NotFoundException
        ) {
          throw err;
        }
        throw err;
      }
    }

    const subtotalAfterDiscount = priced.subtotal.sub(discount);
    if (subtotalAfterDiscount.isNegative()) {
      throw new BadRequestException('Discount cannot exceed subtotal');
    }

    const result = await this.calculation.quote({
      storeId,
      location: {
        divisionId: dto.divisionId,
        districtId: dto.districtId,
        upazilaId: dto.upazilaId,
      },
      items: dto.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
      })),
      orderSubtotalAfterDiscount: subtotalAfterDiscount,
    });

    return {
      success: true as const,
      data: {
        zone: result.zone,
        subtotal: moneyToString(priced.subtotal)!,
        discountTotal: moneyToString(discount)!,
        subtotalAfterDiscount: result.subtotalAfterDiscount,
        couponCode,
        methods: result.methods,
      },
    };
  }

  /**
   * Shared cart pricing for checkout free-threshold + quote.
   */
  async computeCartSubtotal(
    storeId: string,
    items: {
      productId: string;
      variantId?: string | null;
      quantity: number;
    }[],
  ): Promise<{ subtotal: Prisma.Decimal }> {
    let subtotal = new Prisma.Decimal(0);

    for (const line of items) {
      const product = await this.prisma.product.findFirst({
        where: { id: line.productId, storeId },
        select: {
          id: true,
          name: true,
          basePrice: true,
          status: true,
          _count: { select: { variants: true } },
        },
      });
      if (!product) {
        throw new NotFoundException(
          `Product ${line.productId} not found in this store`,
        );
      }
      if (product.status !== ProductStatus.ACTIVE) {
        throw new UnprocessableEntityException(
          `Product "${product.name}" is not available for purchase`,
        );
      }

      let unitPrice = product.basePrice;
      if (product._count.variants > 0) {
        if (!line.variantId) {
          throw new BadRequestException(
            `variantId is required for product "${product.name}"`,
          );
        }
        const variant = await this.prisma.productVariant.findFirst({
          where: {
            id: line.variantId,
            productId: product.id,
            storeId,
          },
          select: { price: true, status: true },
        });
        if (!variant) {
          throw new NotFoundException(
            `Variant ${line.variantId} not found in this store`,
          );
        }
        if (variant.status !== ProductStatus.ACTIVE) {
          throw new UnprocessableEntityException(
            `Variant for "${product.name}" is not available`,
          );
        }
        unitPrice = variant.price;
      }

      subtotal = subtotal.add(unitPrice.mul(line.quantity));
    }

    return { subtotal };
  }
}
