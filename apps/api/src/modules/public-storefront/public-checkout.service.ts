import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerAddressType } from '@prisma/client';
import type { Request } from 'express';
import { moneyToString } from '../../common/utils/catalog.util';
import { RedisRateLimitService } from '../../common/rate-limit/redis-rate-limit.service';
import { OrdersService } from '../orders/orders.service';
import type { OrderAddressInputDto } from '../orders/dto/order.dto';
import {
  PublicCheckoutDto,
  PublicOrderLookupQueryDto,
} from './dto/public-checkout.dto';
import { PublicStorefrontService } from './public-storefront.service';

const CHECKOUT_LIMIT = 30;
const CHECKOUT_WINDOW_SECONDS = 60;

@Injectable()
export class PublicCheckoutService {
  constructor(
    private readonly storefront: PublicStorefrontService,
    private readonly orders: OrdersService,
    private readonly rateLimit: RedisRateLimitService,
  ) {}

  async checkout(storeSlug: string, dto: PublicCheckoutDto, req: Request) {
    const store = await this.storefront.requireActiveStore(storeSlug);
    await this.assertRateLimit(store.id, req);

    const idempotencyKey = this.readIdempotencyKey(req);
    if (!idempotencyKey) {
      throw new BadRequestException(
        'Idempotency-Key header is required for checkout',
      );
    }
    if (idempotencyKey.length > 128) {
      throw new BadRequestException('Idempotency-Key is too long');
    }

    const shippingAddress = this.toOrderAddress(dto.shippingAddress, dto.customer);
    const useShippingForBilling =
      dto.billingSameAsShipping !== false && !dto.billingAddress;
    const billingAddress = useShippingForBilling
      ? shippingAddress
      : this.toOrderAddress(
          dto.billingAddress ?? dto.shippingAddress,
          dto.customer,
        );

    const { order, replayed } = await this.orders.createPublicCheckout(
      store.id,
      {
        items: dto.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
        })),
        shippingAddress,
        billingAddress,
        customerNote: dto.customerNote,
        paymentProvider: dto.paymentProvider,
        paymentMethod: dto.paymentMethod,
        idempotencyKey,
      },
      req,
    );

    return {
      success: true as const,
      data: this.toConfirmationDto(order),
      meta: { replayed },
    };
  }

  async getOrder(
    storeSlug: string,
    publicReference: string,
    query: PublicOrderLookupQueryDto,
  ) {
    const store = await this.storefront.requireActiveStore(storeSlug);
    const order = await this.orders.getPublicOrder(store.id, publicReference);

    if (query.email) {
      const email = query.email.trim().toLowerCase();
      const matches = order.addresses.some(
        (a) => a.email?.toLowerCase() === email,
      );
      if (!matches) {
        throw new NotFoundException('Order not found');
      }
    }

    return {
      success: true as const,
      data: this.toPublicOrderDetail(order),
    };
  }

  private async assertRateLimit(storeId: string, req: Request) {
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.ip ||
      'unknown';
    const allowed = await this.rateLimit.consume(
      `checkout:${storeId}:${ip}`,
      CHECKOUT_LIMIT,
      CHECKOUT_WINDOW_SECONDS,
    );
    if (!allowed) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many checkout attempts. Please try again shortly.',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private readIdempotencyKey(req: Request): string | null {
    const raw = req.headers['idempotency-key'];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    if (Array.isArray(raw) && raw[0]?.trim()) {
      return raw[0].trim();
    }
    return null;
  }

  private toOrderAddress(
    address: PublicCheckoutDto['shippingAddress'],
    customer: PublicCheckoutDto['customer'],
  ): OrderAddressInputDto {
    return {
      name: address.name,
      phone: address.phone ?? customer.phone,
      email: address.email ?? customer.email,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    };
  }

  private toConfirmationDto(
    order: Awaited<ReturnType<OrdersService['getPublicOrder']>>,
  ) {
    const payment = order.payments[0];
    return {
      orderNumber: order.orderNumber,
      publicReference: order.publicReference!,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentProvider: payment?.provider ?? null,
      paymentMethod: payment?.method ?? null,
      currency: order.currency,
      subtotal: moneyToString(order.subtotal)!,
      shippingTotal: moneyToString(order.shippingTotal)!,
      discountTotal: moneyToString(order.discountTotal)!,
      taxTotal: moneyToString(order.taxTotal)!,
      total: moneyToString(order.grandTotal)!,
    };
  }

  private toPublicOrderDetail(
    order: Awaited<ReturnType<OrdersService['getPublicOrder']>>,
  ) {
    const payment = order.payments[0];
    const shipping = order.addresses.find(
      (a) => a.type === CustomerAddressType.SHIPPING,
    );
    const billing = order.addresses.find(
      (a) => a.type === CustomerAddressType.BILLING,
    );

    return {
      orderNumber: order.orderNumber,
      publicReference: order.publicReference!,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentProvider: payment?.provider ?? null,
      paymentMethod: payment?.method ?? null,
      currency: order.currency,
      subtotal: moneyToString(order.subtotal)!,
      shippingTotal: moneyToString(order.shippingTotal)!,
      discountTotal: moneyToString(order.discountTotal)!,
      taxTotal: moneyToString(order.taxTotal)!,
      total: moneyToString(order.grandTotal)!,
      customerNote: order.customerNote,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: moneyToString(item.unitPrice)!,
        totalPrice: moneyToString(item.totalPrice)!,
      })),
      shippingAddress: shipping
        ? {
            name: [shipping.firstName, shipping.lastName]
              .filter(Boolean)
              .join(' '),
            phone: shipping.phone,
            email: shipping.email,
            addressLine1: shipping.addressLine1,
            addressLine2: shipping.addressLine2,
            city: shipping.city,
            state: shipping.state,
            postalCode: shipping.postalCode,
            country: shipping.country,
          }
        : null,
      billingAddress: billing
        ? {
            name: [billing.firstName, billing.lastName]
              .filter(Boolean)
              .join(' '),
            phone: billing.phone,
            email: billing.email,
            addressLine1: billing.addressLine1,
            addressLine2: billing.addressLine2,
            city: billing.city,
            state: billing.state,
            postalCode: billing.postalCode,
            country: billing.country,
          }
        : null,
    };
  }
}
