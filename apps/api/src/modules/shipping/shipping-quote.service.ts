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
   * Shared cart pricing for checkout free-threshold + quote. Prices always come
   * from the live catalog; `lines` carries them for checkout display (SF-03).
   */
  async computeCartSubtotal(
    storeId: string,
    items: {
      productId: string;
      variantId?: string | null;
      quantity: number;
    }[],
  ): Promise<{ subtotal: Prisma.Decimal; lines: PricedCartLine[] }> {
    let subtotal = new Prisma.Decimal(0);
    const lines: PricedCartLine[] = [];

    for (const line of items) {
      const product = await this.prisma.product.findFirst({
        where: { id: line.productId, storeId },
        select: {
          id: true,
          name: true,
          basePrice: true,
          status: true,
          trackInventory: true,
          allowBackorder: true,
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
      let variantName: string | null = null;
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
          select: { name: true, price: true, status: true },
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
        variantName = variant.name;
      } else if (line.variantId) {
        // The cart still points at a variant the merchant has since removed.
        throw new UnprocessableEntityException(
          `The selected option for "${product.name}" is no longer available`,
        );
      }

      const lineTotal = unitPrice.mul(line.quantity);
      subtotal = subtotal.add(lineTotal);
      lines.push({
        productId: product.id,
        variantId: line.variantId ?? null,
        productName: product.name,
        variantName,
        quantity: line.quantity,
        unitPrice,
        lineTotal,
        trackInventory: product.trackInventory,
        allowBackorder: product.allowBackorder,
      });
    }

    return { subtotal, lines };
  }
}

export type PricedCartLine = {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  trackInventory: boolean;
  allowBackorder: boolean;
};
