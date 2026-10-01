import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CustomerAddressType, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { moneyToString, parseMoney } from '../../common/utils/catalog.util';
import { RedisRateLimitService } from '../../common/rate-limit/redis-rate-limit.service';
import { clientIp } from '../../common/utils/request-host.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CouponValidationService } from '../coupons/coupon-validation.service';
import { OrdersService } from '../orders/orders.service';
import { OrderTimelineService } from '../orders/order-timeline.service';
import type { OrderAddressInputDto } from '../orders/dto/order.dto';
import { customerCancellationBlock } from '../orders/customer-cancellation';
import { BangladeshLocationsService } from '../shipping/bangladesh-locations.service';
import { ShippingCalculationService } from '../shipping/shipping-calculation.service';
import {
  ShippingQuoteService,
  type PricedCartLine,
} from '../shipping/shipping-quote.service';
import {
  CancelPublicOrderDto,
  PublicCheckoutDto,
  PublicCheckoutQuoteDto,
  PublicOrderLookupQueryDto,
} from './dto/public-checkout.dto';
import { PublicStorefrontService } from './public-storefront.service';

const CHECKOUT_LIMIT = 30;
const CHECKOUT_WINDOW_SECONDS = 60;
const QUOTE_LIMIT = 120;
const QUOTE_WINDOW_SECONDS = 60;
const LOOKUP_LIMIT = 60;
const LOOKUP_WINDOW_SECONDS = 60;
const CANCEL_LIMIT = 10;
const CANCEL_WINDOW_SECONDS = 60;

@Injectable()
export class PublicCheckoutService {
  constructor(
    private readonly storefront: PublicStorefrontService,
    private readonly orders: OrdersService,
    private readonly timeline: OrderTimelineService,
    private readonly rateLimit: RedisRateLimitService,
    private readonly prisma: PrismaService,
    private readonly shippingQuote: ShippingQuoteService,
    private readonly shippingCalc: ShippingCalculationService,
    private readonly coupons: CouponValidationService,
    private readonly locations: BangladeshLocationsService,
  ) {}

  async checkout(storeSlug: string, dto: PublicCheckoutDto, req: Request) {
    const store = await this.storefront.requireActiveStore(storeSlug);
    await this.assertRateLimit(
      `checkout:${store.id}`,
      req,
      CHECKOUT_LIMIT,
      CHECKOUT_WINDOW_SECONDS,
    );

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
    // Email is optional, so the phone number is how the customer is reached and
    // how they look the order up later: every storefront order needs one.
    if (!shippingAddress.phone?.trim()) {
      throw new BadRequestException('A phone number is required to place this order');
    }
    const customerNote = store.checkoutAllowOrderNotes ? dto.customerNote : undefined;
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
        customerNote,
        shippingMethodId: dto.shippingMethodId,
        paymentProvider: dto.paymentProvider,
        paymentMethod: dto.paymentMethod,
        idempotencyKey,
        couponCode: dto.couponCode ?? null,
        expectedTotal: dto.expectedTotal
          ? parseMoney(dto.expectedTotal, 'expectedTotal')
          : null,
      },
      req,
    );

    return {
      success: true as const,
      data: this.toConfirmationDto(order),
      meta: { replayed },
    };
  }

  /**
   * SF-03: display-only checkout summary priced from the live catalog, coupon
   * rules and shipping setup — the same services checkout uses. Read-only: no
   * order, inventory, coupon usage or payment is written. Checkout still
   * re-prices everything and refuses a total that differs from this quote.
   */
  async quote(storeSlug: string, dto: PublicCheckoutQuoteDto, req: Request) {
    const store = await this.storefront.requireActiveStore(storeSlug);
    await this.assertRateLimit(
      `checkout-quote:${store.id}`,
      req,
      QUOTE_LIMIT,
      QUOTE_WINDOW_SECONDS,
    );

    const items = dto.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
    }));
    const priced = await this.shippingQuote.computeCartSubtotal(store.id, items);
    await this.assertStockAvailable(store.id, priced.lines);

    let discount = new Prisma.Decimal(0);
    let couponCode: string | null = null;
    let couponError: string | null = null;
    if (dto.couponCode?.trim()) {
      try {
        const applied = await this.coupons.validateForStore({
          storeId: store.id,
          code: dto.couponCode,
          subtotal: priced.subtotal,
          identity: { email: dto.email?.trim().toLowerCase() || null },
        });
        discount = applied.discount;
        couponCode = applied.code;
      } catch (err) {
        // An invalid/expired coupon must not hide the rest of the summary.
        if (!(err instanceof HttpException) || err.getStatus() >= 500) {
          throw err;
        }
        couponError = err.message;
      }
    }
    const subtotalAfterDiscount = priced.subtotal.sub(discount);

    // Same location normalization as checkout, so zones resolve identically.
    const location = await this.locations.resolveSnapshotNames({
      divisionId: dto.divisionId,
      districtId: dto.districtId,
      upazilaId: dto.upazilaId,
    });
    const shipping = await this.shippingCalc.quote({
      storeId: store.id,
      location: {
        divisionId: location.divisionId,
        districtId: location.districtId,
        upazilaId: location.upazilaId,
      },
      items,
      orderSubtotalAfterDiscount: subtotalAfterDiscount,
    });
    const selected =
      shipping.methods.find((m) => m.id === dto.shippingMethodId) ??
      shipping.methods[0] ??
      null;
    const shippingTotal = new Prisma.Decimal(selected?.amount ?? 0);
    const taxTotal = new Prisma.Decimal(0);

    return {
      success: true as const,
      data: {
        currency: store.currency,
        lines: priced.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          productName: line.productName,
          variantName: line.variantName,
          quantity: line.quantity,
          unitPrice: moneyToString(line.unitPrice)!,
          lineTotal: moneyToString(line.lineTotal)!,
        })),
        subtotal: moneyToString(priced.subtotal)!,
        couponCode,
        couponError,
        discountTotal: moneyToString(discount)!,
        zone: shipping.zone,
        shippingMethods: shipping.methods,
        shippingMethodId: selected?.id ?? null,
        shippingTotal: moneyToString(shippingTotal)!,
        taxTotal: moneyToString(taxTotal)!,
        total: moneyToString(
          subtotalAfterDiscount.add(shippingTotal).add(taxTotal),
        )!,
      },
    };
  }

  /**
   * Unlocked stock check for the quote, mirroring placement: lines are merged
   * per product/variant, a missing inventory row means zero, backorders pass.
   * Placement re-checks under row locks.
   */
  private async assertStockAvailable(storeId: string, lines: PricedCartLine[]) {
    const needs = new Map<string, { line: PricedCartLine; quantity: number }>();
    for (const line of lines) {
      if (!line.trackInventory || line.allowBackorder) continue;
      const key = `${line.productId}:${line.variantId ?? 'null'}`;
      const existing = needs.get(key);
      if (existing) {
        existing.quantity += line.quantity;
      } else {
        needs.set(key, { line, quantity: line.quantity });
      }
    }

    for (const { line, quantity } of needs.values()) {
      const row = await this.prisma.inventoryItem.findFirst({
        where: { storeId, productId: line.productId, variantId: line.variantId },
        select: { quantity: true, reservedQuantity: true },
      });
      const available = Math.max(
        0,
        (row?.quantity ?? 0) - (row?.reservedQuantity ?? 0),
      );
      if (available < quantity) {
        const label = line.variantName
          ? `${line.productName} / ${line.variantName}`
          : line.productName;
        throw new UnprocessableEntityException({
          message: `Insufficient stock for ${label}. Available: ${available}, requested: ${quantity}`,
          error: 'INSUFFICIENT_STOCK',
        });
      }
    }
  }

  async getOrder(
    storeSlug: string,
    publicReference: string,
    query: PublicOrderLookupQueryDto,
    req?: Request,
  ) {
    const store = await this.storefront.requireActiveStore(storeSlug);
    if (req) {
      await this.assertRateLimit(
        `order-lookup:${store.id}`,
        req,
        LOOKUP_LIMIT,
        LOOKUP_WINDOW_SECONDS,
      );
    }

    const order = await this.requireVerifiedOrder(store.id, publicReference, query);

    return {
      success: true as const,
      data: await this.toPublicOrderDetail(order, store.allowCustomerCancellation),
    };
  }

  /** Guest cancellation — same contact proof as order tracking, store setting must allow it. */
  async cancelOrder(
    storeSlug: string,
    publicReference: string,
    dto: CancelPublicOrderDto,
    req: Request,
  ) {
    const store = await this.storefront.requireActiveStore(storeSlug);
    await this.assertRateLimit(
      `order-cancel:${store.id}`,
      req,
      CANCEL_LIMIT,
      CANCEL_WINDOW_SECONDS,
    );
    const order = await this.requireVerifiedOrder(store.id, publicReference, dto);

    await this.orders.cancelByCustomer(
      store.id,
      order.id,
      { enabled: store.allowCustomerCancellation, reason: dto.reason },
      req,
    );

    const refreshed = await this.orders.getPublicOrder(store.id, order.publicReference!);
    return {
      success: true as const,
      data: await this.toPublicOrderDetail(refreshed, store.allowCustomerCancellation),
    };
  }

  private async requireVerifiedOrder(
    storeId: string,
    publicReference: string,
    proof: { email?: string; phone?: string },
  ) {
    // Reject obvious non-references early (sequential order numbers, UUIDs used as auth).
    const ref = publicReference?.trim() ?? '';
    if (!ref || ref.length < 16 || ref.length > 128) {
      throw new NotFoundException('Order not found');
    }

    // Contact proof required: email and/or phone. Missing/wrong → 404 (no enumeration).
    const hasEmail = Boolean(proof.email?.trim());
    const hasPhone = Boolean(proof.phone?.trim());
    if (!hasEmail && !hasPhone) {
      throw new NotFoundException('Order not found');
    }

    const order = await this.orders.getPublicOrder(storeId, ref);

    if (proof.email) {
      const email = proof.email.trim().toLowerCase();
      const matches = order.addresses.some(
        (a) => a.email?.toLowerCase() === email,
      );
      if (!matches) {
        throw new NotFoundException('Order not found');
      }
    }

    if (proof.phone) {
      const phone = this.normalizePhone(proof.phone);
      const matches = order.addresses.some(
        (a) => a.phone && this.normalizePhone(a.phone) === phone,
      );
      if (!matches) {
        throw new NotFoundException('Order not found');
      }
    }

    return order;
  }

  private normalizePhone(value: string): string {
    return value.replace(/[^\d+]/g, '');
  }

  private async assertRateLimit(
    prefix: string,
    req: Request,
    limit: number,
    windowSeconds: number,
  ) {
    const ip = clientIp(req) ?? 'unknown';
    const allowed = await this.rateLimit.consume(
      `${prefix}:${ip}`,
      limit,
      windowSeconds,
    );
    if (!allowed) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again shortly.',
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
      divisionId: address.divisionId,
      districtId: address.districtId,
      upazilaId: address.upazilaId,
      landmark: address.landmark,
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
      fulfillmentStatus: order.fulfillmentStatus,
      paymentProvider: payment?.provider ?? null,
      paymentMethod: payment?.method ?? null,
      currency: order.currency,
      subtotal: moneyToString(order.subtotal)!,
      shippingTotal: moneyToString(order.shippingTotal)!,
      shippingMethodName: order.shippingMethodName,
      shippingMethodType: order.shippingMethodType,
      discountTotal: moneyToString(order.discountTotal)!,
      taxTotal: moneyToString(order.taxTotal)!,
      total: moneyToString(order.grandTotal)!,
      couponCode: order.couponCode ?? null,
      cancelReason: order.cancelReason ?? null,
    };
  }

  private async toPublicOrderDetail(
    order: Awaited<ReturnType<OrdersService['getPublicOrder']>>,
    allowCustomerCancellation: boolean,
  ) {
    const payment = order.payments[0];
    const shipping = order.addresses.find(
      (a) => a.type === CustomerAddressType.SHIPPING,
    );
    const billing = order.addresses.find(
      (a) => a.type === CustomerAddressType.BILLING,
    );

    const timeline = await this.timeline.forOrder({
      storeId: order.storeId,
      orderId: order.id,
      order: {
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        cancelReason: order.cancelReason ?? null,
        createdAt: order.createdAt,
      },
      payments: order.payments,
      shipments: order.shipments,
    });

    return {
      orderNumber: order.orderNumber,
      publicReference: order.publicReference!,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentProvider: payment?.provider ?? null,
      paymentMethod: payment?.method ?? null,
      currency: order.currency,
      subtotal: moneyToString(order.subtotal)!,
      shippingTotal: moneyToString(order.shippingTotal)!,
      shippingMethodName: order.shippingMethodName,
      shippingMethodType: order.shippingMethodType,
      discountTotal: moneyToString(order.discountTotal)!,
      taxTotal: moneyToString(order.taxTotal)!,
      total: moneyToString(order.grandTotal)!,
      couponCode: order.couponCode ?? null,
      customerNote: order.customerNote,
      cancelReason:
        order.status === 'CANCELLED' ? order.cancelReason ?? null : null,
      canCancel:
        customerCancellationBlock({
          enabled: allowCustomerCancellation,
          status: order.status,
          paymentStatus: order.paymentStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          payments: order.payments,
          shipmentCount: order.shipments.length,
        }) === null,
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
      shipments: order.shipments.map((shipment) => ({
        status: shipment.status,
        trackingNumber: shipment.trackingNumber,
        provider: shipment.provider,
        shippedAt: shipment.shippedAt,
        deliveredAt: shipment.deliveredAt,
      })),
      timeline,
    };
  }
}
