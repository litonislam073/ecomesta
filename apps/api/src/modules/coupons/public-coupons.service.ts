import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, ProductStatus, StoreStatus } from '@prisma/client';
import { moneyToString } from '../../common/utils/catalog.util';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { CouponValidationService } from './coupon-validation.service';
import { PublicValidateCouponDto } from './dto/public-coupon.dto';

@Injectable()
export class PublicCouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: CouponValidationService,
    private readonly billingAccess: BillingAccessService,
  ) {}

  async validate(storeSlug: string, dto: PublicValidateCouponDto) {
    const store = await this.requireActiveStore(storeSlug);
    const subtotal = await this.calculateSubtotal(store.id, dto.items);
    const result = await this.validation.validateForStore({
      storeId: store.id,
      code: dto.code,
      subtotal,
      identity: { email: dto.email ?? null },
    });

    return {
      success: true as const,
      data: {
        valid: true as const,
        code: result.code,
        discount: moneyToString(result.discount)!,
        subtotal: moneyToString(result.subtotal)!,
        finalSubtotal: moneyToString(result.finalSubtotal)!,
        currency: store.currency,
      },
    };
  }

  private async requireActiveStore(storeSlug: string) {
    const store = await this.prisma.store.findFirst({
      where: { slug: storeSlug, status: StoreStatus.ACTIVE },
      select: { id: true, tenantId: true, currency: true },
    });
    if (!store) {
      await this.billingAccess.throwIfSuspended({ slug: storeSlug });
      throw new NotFoundException('Store not found');
    }
    await this.billingAccess.assertTenantInGoodStanding(store.tenantId);
    return store;
  }

  private async calculateSubtotal(
    storeId: string,
    items: PublicValidateCouponDto['items'],
  ): Promise<Prisma.Decimal> {
    if (!items?.length) {
      throw new BadRequestException('At least one item is required');
    }

    let subtotal = new Prisma.Decimal(0);
    for (const item of items) {
      const product = await this.prisma.product.findFirst({
        where: {
          id: item.productId,
          storeId,
          status: ProductStatus.ACTIVE,
        },
      });
      if (!product) {
        throw new UnprocessableEntityException('Product is not available');
      }

      let unitPrice = product.basePrice;
      if (item.variantId) {
        const variant = await this.prisma.productVariant.findFirst({
          where: {
            id: item.variantId,
            productId: product.id,
            status: ProductStatus.ACTIVE,
          },
        });
        if (!variant) {
          throw new UnprocessableEntityException('Variant is not available');
        }
        unitPrice = variant.price;
      }

      subtotal = subtotal.add(unitPrice.mul(item.quantity));
    }
    return subtotal;
  }
}
