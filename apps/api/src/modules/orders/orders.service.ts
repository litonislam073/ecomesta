import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  FulfillmentStatus,
  InventoryMovementType,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ShipmentStatus,
  StoreRole,
} from '@prisma/client';
import type { Request } from 'express';
import {
  moneyToString,
  normalizePagination,
  pageMeta,
} from '../../common/utils/catalog.util';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateOrderDto,
  ListOrdersQueryDto,
  OrderAddressInputDto,
  UpdateFulfillmentStatusDto,
  UpdateOrderStatusDto,
  UpdatePaymentStatusDto,
} from './dto/order.dto';
import { OrderPlacementService } from './order-placement.service';
import { OrderTimelineService } from './order-timeline.service';
import {
  assertFulfillmentStatusTransition,
  assertOrderStatusTransition,
  assertPaymentStatusTransition,
} from './order-transitions';
import {
  CUSTOMER_CANCELLATION_MESSAGES,
  customerCancellationBlock,
} from './customer-cancellation';
import { BangladeshLocationsService } from '../shipping/bangladesh-locations.service';
import { ShippingCalculationService } from '../shipping/shipping-calculation.service';
import { ShippingQuoteService } from '../shipping/shipping-quote.service';
import { CouponValidationService } from '../coupons/coupon-validation.service';

type LockedInventory = {
  id: string;
  quantity: number;
  reserved_quantity: number;
};

/** Order payment states where the customer's money is taken or held. */
const MONEY_HELD_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.PARTIALLY_PAID,
  PaymentStatus.AUTHORIZED,
];

/** Refund states a cancelled order keeps as its payment status. */
const MONEY_RETURNED_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.REFUNDED,
  PaymentStatus.PARTIALLY_REFUNDED,
];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly placement: OrderPlacementService,
    private readonly shippingCalc: ShippingCalculationService,
    private readonly shippingQuote: ShippingQuoteService,
    private readonly locations: BangladeshLocationsService,
    private readonly coupons: CouponValidationService,
    private readonly timeline: OrderTimelineService,
  ) {}

  async create(
    userId: string,
    storeId: string,
    dto: CreateOrderDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);

    const result = await this.placement.place({
      storeId,
      items: dto.items,
      shippingAddress: dto.shippingAddress,
      billingAddress: dto.billingAddress,
      shippingAddressId: dto.shippingAddressId,
      billingAddressId: dto.billingAddressId,
      customerId: dto.customerId,
      discountTotal: dto.discountTotal,
      shippingTotal: dto.shippingTotal,
      customerNote: dto.customerNote,
      internalNote: dto.internalNote,
      paymentProvider: dto.paymentProvider ?? PaymentProvider.COD,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
      paymentStatus: dto.paymentStatus ?? PaymentStatus.PENDING,
      requireActiveCatalog: false,
      idempotencyKey: null,
      generatePublicReference: true,
    });

    await this.audit.log({
      action: 'ORDER_CREATED',
      entityType: 'Order',
      entityId: result.order.id,
      userId,
      tenantId: result.tenantId,
      storeId,
      metadata: {
        orderNumber: result.order.orderNumber,
        grandTotal: moneyToString(result.order.grandTotal),
        itemCount: result.order.items.length,
      },
      req,
    });

    if (result.order.items.length > 0) {
      await this.audit.log({
        action: 'ORDER_INVENTORY_DEDUCTED',
        entityType: 'Order',
        entityId: result.order.id,
        userId,
        tenantId: result.tenantId,
        storeId,
        metadata: { orderNumber: result.order.orderNumber },
        req,
      });
    }

    return { success: true as const, data: await this.toDetailDto(result.order) };
  }

  /** Guest/public checkout — server prices, ACTIVE catalog only, forced PENDING payment. */
  async createPublicCheckout(
    storeId: string,
    input: {
      items: { productId: string; variantId?: string | null; quantity: number }[];
      shippingAddress: OrderAddressInputDto;
      billingAddress?: OrderAddressInputDto | null;
      customerNote?: string | null;
      shippingMethodId: string;
      paymentProvider: PaymentProvider;
      paymentMethod: PaymentMethod;
      idempotencyKey: string;
      couponCode?: string | null;
    },
    req?: Request,
  ) {
    const locationSnapshot = await this.locations.resolveSnapshotNames({
      divisionId: input.shippingAddress.divisionId,
      districtId: input.shippingAddress.districtId,
      upazilaId: input.shippingAddress.upazilaId,
    });
    const shippingAddress: OrderAddressInputDto = {
      ...input.shippingAddress,
      divisionId: locationSnapshot.divisionId ?? undefined,
      districtId: locationSnapshot.districtId ?? undefined,
      upazilaId: locationSnapshot.upazilaId ?? undefined,
      divisionName: locationSnapshot.divisionName ?? undefined,
      districtName: locationSnapshot.districtName ?? undefined,
      upazilaName: locationSnapshot.upazilaName ?? undefined,
      city:
        locationSnapshot.districtName ??
        input.shippingAddress.city ??
        locationSnapshot.upazilaName ??
        'N/A',
      state:
        locationSnapshot.divisionName ?? input.shippingAddress.state ?? undefined,
    };
    let billingAddress: OrderAddressInputDto | null | undefined =
      input.billingAddress;
    if (input.billingAddress) {
      const billingSnap = await this.locations.resolveSnapshotNames({
        divisionId: input.billingAddress.divisionId,
        districtId: input.billingAddress.districtId,
        upazilaId: input.billingAddress.upazilaId,
      });
      billingAddress = {
        ...input.billingAddress,
        divisionId: billingSnap.divisionId ?? undefined,
        districtId: billingSnap.districtId ?? undefined,
        upazilaId: billingSnap.upazilaId ?? undefined,
        divisionName: billingSnap.divisionName ?? undefined,
        districtName: billingSnap.districtName ?? undefined,
        upazilaName: billingSnap.upazilaName ?? undefined,
      };
    }

    // Server cart + coupon preview for free-shipping threshold (placement re-locks coupon).
    const { subtotal } = await this.shippingQuote.computeCartSubtotal(
      storeId,
      input.items,
    );
    let discountPreview = new Prisma.Decimal(0);
    if (input.couponCode?.trim()) {
      const applied = await this.coupons.validateForStore({
        storeId,
        code: input.couponCode,
        subtotal,
        identity: {
          email: shippingAddress.email ?? null,
        },
      });
      discountPreview = applied.discount;
    }
    const subtotalAfterDiscount = subtotal.sub(discountPreview);

    const shipping = await this.shippingCalc.calculate({
      storeId,
      shippingMethodId: input.shippingMethodId,
      items: input.items,
      location: {
        divisionId: locationSnapshot.divisionId,
        districtId: locationSnapshot.districtId,
        upazilaId: locationSnapshot.upazilaId,
      },
      address: {
        country: shippingAddress.country,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        city: shippingAddress.city,
      },
      orderSubtotalAfterDiscount: subtotalAfterDiscount,
      requireActive: true,
      requireCodAllowed: input.paymentProvider === PaymentProvider.COD,
    });

    const result = await this.placement.place({
      storeId,
      items: input.items,
      shippingAddress,
      billingAddress,
      discountTotal: '0',
      couponCode: input.couponCode ?? null,
      shippingTotal: shipping.amountString,
      shippingMethodName: shipping.name,
      shippingMethodType: shipping.type,
      shippingZoneName: shipping.zoneName,
      customerNote: input.customerNote,
      internalNote: null,
      paymentProvider: input.paymentProvider,
      paymentMethod: input.paymentMethod,
      paymentStatus: PaymentStatus.PENDING,
      requireActiveCatalog: true,
      idempotencyKey: input.idempotencyKey,
      generatePublicReference: true,
    });

    if (!result.replayed) {
      await this.audit.log({
        action: 'ORDER_CREATED',
        entityType: 'Order',
        entityId: result.order.id,
        tenantId: result.tenantId,
        storeId,
        metadata: {
          orderNumber: result.order.orderNumber,
          source: 'public_checkout',
          grandTotal: moneyToString(result.order.grandTotal),
          shippingTotal: moneyToString(result.order.shippingTotal),
          discountTotal: moneyToString(result.order.discountTotal),
          couponCode: result.appliedCoupon?.code ?? null,
          shippingMethodId: shipping.shippingMethodId,
          shippingMethodName: shipping.name,
          itemCount: result.order.items.length,
          replayed: false,
        },
        req,
      });

      if (result.appliedCoupon) {
        await this.audit.log({
          action: 'COUPON_USED',
          entityType: 'Coupon',
          entityId: result.appliedCoupon.coupon.id,
          tenantId: result.tenantId,
          storeId,
          metadata: {
            orderId: result.order.id,
            orderNumber: result.order.orderNumber,
            code: result.appliedCoupon.code,
            discount: moneyToString(result.appliedCoupon.discount),
          },
          req,
        });
      }
    }

    return { order: result.order, replayed: result.replayed };
  }

  async getPublicOrder(storeId: string, publicReference: string) {
    const order = await this.placement.findByPublicReference(
      storeId,
      publicReference,
    );
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async list(userId: string, storeId: string, query: ListOrdersQueryDto) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireStore(storeId);

    const { page, limit, skip } = normalizePagination(query);
    const where = this.buildWhere(storeId, query);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
          items: { select: { id: true, quantity: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: items.map((order) => this.toListDto(order)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getOne(userId: string, storeId: string, orderId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const order = await this.requireOrder(storeId, orderId);
    return { success: true as const, data: await this.toDetailDto(order) };
  }

  async updateStatus(
    userId: string,
    storeId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockOrderRow(tx, storeId, orderId);
      if (!locked) {
        throw new NotFoundException('Order not found');
      }

      assertOrderStatusTransition(locked.status, dto.status);

      if (dto.status === OrderStatus.CANCELLED) {
        return this.cancelLockedOrder(tx, storeId, locked, dto.reason);
      }

      return tx.order.update({
        where: { id: locked.id },
        data: { status: dto.status },
        include: this.detailInclude(),
      });
    });

    await this.audit.log({
      action:
        dto.status === OrderStatus.CANCELLED
          ? 'ORDER_CANCELLED'
          : 'ORDER_STATUS_CHANGED',
      entityType: 'Order',
      entityId: updated.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        status: dto.status,
        orderNumber: updated.orderNumber,
        ...(dto.status === OrderStatus.CANCELLED && dto.reason?.trim()
          ? { cancelReason: dto.reason.trim().slice(0, 500) }
          : {}),
      },
      req,
    });

    if (dto.status === OrderStatus.CANCELLED) {
      await this.audit.log({
        action: 'ORDER_INVENTORY_RESTORED',
        entityType: 'Order',
        entityId: updated.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { orderNumber: updated.orderNumber },
        req,
      });
    }

    return { success: true as const, data: await this.toDetailDto(updated) };
  }

  /**
   * Guest self-cancellation from order tracking. The caller has already proven
   * contact ownership; eligibility is re-checked under the order row lock.
   */
  async cancelByCustomer(
    storeId: string,
    orderId: string,
    input: { enabled: boolean; reason?: string | null },
    req?: Request,
  ) {
    const store = await this.requireStore(storeId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockOrderRow(tx, storeId, orderId);
      if (!locked) {
        throw new NotFoundException('Order not found');
      }
      const [payments, shipmentCount] = await Promise.all([
        tx.payment.findMany({
          where: { storeId, orderId: locked.id },
          select: { provider: true, status: true },
        }),
        tx.shipment.count({ where: { storeId, orderId: locked.id } }),
      ]);
      const block = customerCancellationBlock({
        enabled: input.enabled,
        status: locked.status,
        paymentStatus: locked.payment_status,
        fulfillmentStatus: locked.fulfillment_status,
        payments,
        shipmentCount,
      });
      if (block) {
        throw new UnprocessableEntityException(CUSTOMER_CANCELLATION_MESSAGES[block]);
      }
      const reason = input.reason?.trim();
      return this.cancelLockedOrder(
        tx,
        storeId,
        locked,
        reason ? `Cancelled by customer: ${reason}` : 'Cancelled by customer',
      );
    });

    await this.audit.log({
      action: 'ORDER_CANCELLED',
      entityType: 'Order',
      entityId: updated.id,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        status: OrderStatus.CANCELLED,
        orderNumber: updated.orderNumber,
        source: 'customer',
        ...(updated.cancelReason ? { cancelReason: updated.cancelReason } : {}),
      },
      req,
    });
    await this.audit.log({
      action: 'ORDER_INVENTORY_RESTORED',
      entityType: 'Order',
      entityId: updated.id,
      tenantId: store.tenantId,
      storeId,
      metadata: { orderNumber: updated.orderNumber, source: 'customer' },
      req,
    });

    return updated;
  }

  async updatePaymentStatus(
    userId: string,
    storeId: string,
    orderId: string,
    dto: UpdatePaymentStatusDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockOrderRow(tx, storeId, orderId);
      if (!locked) {
        throw new NotFoundException('Order not found');
      }
      if (locked.status === OrderStatus.CANCELLED) {
        throw new UnprocessableEntityException(
          'Cannot update payment status on a cancelled order',
        );
      }
      assertPaymentStatusTransition(locked.payment_status, dto.paymentStatus);

      const order = await tx.order.update({
        where: { id: locked.id },
        data: { paymentStatus: dto.paymentStatus },
      });

      const latestPayment = await tx.payment.findFirst({
        where: { orderId: locked.id, storeId },
        orderBy: { createdAt: 'desc' },
      });
      if (latestPayment) {
        await tx.payment.update({
          where: { id: latestPayment.id },
          data: { status: dto.paymentStatus },
        });
      }

      return tx.order.findFirstOrThrow({
        where: { id: order.id, storeId },
        include: this.detailInclude(),
      });
    });

    await this.audit.log({
      action: 'ORDER_PAYMENT_STATUS_CHANGED',
      entityType: 'Order',
      entityId: updated.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        paymentStatus: dto.paymentStatus,
        orderNumber: updated.orderNumber,
      },
      req,
    });

    return { success: true as const, data: await this.toDetailDto(updated) };
  }

  async updateFulfillmentStatus(
    userId: string,
    storeId: string,
    orderId: string,
    dto: UpdateFulfillmentStatusDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockOrderRow(tx, storeId, orderId);
      if (!locked) {
        throw new NotFoundException('Order not found');
      }
      if (locked.status === OrderStatus.CANCELLED) {
        throw new UnprocessableEntityException(
          'Cannot update fulfillment status on a cancelled order',
        );
      }
      assertFulfillmentStatusTransition(
        locked.fulfillment_status,
        dto.fulfillmentStatus,
      );

      const order = await tx.order.update({
        where: { id: locked.id },
        data: { fulfillmentStatus: dto.fulfillmentStatus },
      });

      if (
        dto.fulfillmentStatus === FulfillmentStatus.FULFILLED ||
        dto.fulfillmentStatus === FulfillmentStatus.PARTIALLY_FULFILLED
      ) {
        const existing = await tx.shipment.findFirst({
          where: { orderId: locked.id, storeId },
        });
        if (!existing) {
          await tx.shipment.create({
            data: {
              storeId,
              orderId: locked.id,
              status:
                dto.fulfillmentStatus === FulfillmentStatus.FULFILLED
                  ? ShipmentStatus.SHIPPED
                  : ShipmentStatus.PENDING,
              shippedAt:
                dto.fulfillmentStatus === FulfillmentStatus.FULFILLED
                  ? new Date()
                  : null,
            },
          });
        }
      }

      return tx.order.findFirstOrThrow({
        where: { id: order.id, storeId },
        include: this.detailInclude(),
      });
    });

    await this.audit.log({
      action: 'ORDER_FULFILLMENT_STATUS_CHANGED',
      entityType: 'Order',
      entityId: updated.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        fulfillmentStatus: dto.fulfillmentStatus,
        orderNumber: updated.orderNumber,
      },
      req,
    });

    return { success: true as const, data: await this.toDetailDto(updated) };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async cancelLockedOrder(
    tx: Prisma.TransactionClient,
    storeId: string,
    locked: NonNullable<Awaited<ReturnType<OrdersService['lockOrderRow']>>>,
    reason?: string | null,
  ) {
    // SF-01: an order holding captured or authorised money is never cancelled
    // into CANCELLED/PAID. The merchant records the refund (or voids the
    // authorisation) first; there is no automated refund.
    if (MONEY_HELD_PAYMENT_STATUSES.includes(locked.payment_status)) {
      throw new UnprocessableEntityException(
        'This order has a captured payment. Record the refund (or void the authorisation) before cancelling it.',
      );
    }
    const payments = await tx.$queryRaw<{ id: string; status: PaymentStatus }[]>`
      SELECT id, status
      FROM payments
      WHERE order_id = ${locked.id}::uuid AND store_id = ${storeId}::uuid
      FOR UPDATE
    `;
    if (payments.some((payment) => MONEY_HELD_PAYMENT_STATUSES.includes(payment.status))) {
      throw new UnprocessableEntityException(
        'This order has a captured payment. Record the refund (or void the authorisation) before cancelling it.',
      );
    }
    // Close open attempts so payment rows agree with the cancelled order; a
    // provider success that still arrives is handled as a late capture.
    const open = payments
      .filter((payment) => payment.status === PaymentStatus.PENDING)
      .map((payment) => payment.id);
    if (open.length > 0) {
      await tx.payment.updateMany({
        where: { id: { in: open }, storeId },
        data: { status: PaymentStatus.CANCELLED },
      });
    }

    await this.restockOrderInventory(tx, storeId, locked.id, locked.order_number);
    return tx.order.update({
      where: { id: locked.id },
      data: {
        status: OrderStatus.CANCELLED,
        fulfillmentStatus: FulfillmentStatus.CANCELLED,
        paymentStatus:
          MONEY_RETURNED_PAYMENT_STATUSES.includes(locked.payment_status)
            ? locked.payment_status
            : PaymentStatus.CANCELLED,
        cancelReason: reason?.trim() ? reason.trim().slice(0, 500) : null,
      },
      include: this.detailInclude(),
    });
  }

  private async restockOrderInventory(
    tx: Prisma.TransactionClient,
    storeId: string,
    orderId: string,
    orderNumber: string,
  ) {
    const alreadyRestored = await tx.inventoryMovement.findFirst({
      where: {
        storeId,
        referenceType: 'ORDER',
        referenceId: orderId,
        type: InventoryMovementType.RETURN,
      },
      select: { id: true },
    });
    if (alreadyRestored) {
      return;
    }

    const sales = await tx.inventoryMovement.findMany({
      where: {
        storeId,
        referenceType: 'ORDER',
        referenceId: orderId,
        type: InventoryMovementType.SALE,
      },
    });

    const sorted = [...sales].sort((a, b) =>
      `${a.productId}:${a.variantId ?? ''}`.localeCompare(
        `${b.productId}:${b.variantId ?? ''}`,
      ),
    );

    for (const sale of sorted) {
      const restoreQty = Math.abs(sale.quantity);
      let row = await this.lockInventoryRow(
        tx,
        storeId,
        sale.productId,
        sale.variantId,
      );
      if (!row) {
        const created = await tx.inventoryItem.create({
          data: {
            storeId,
            productId: sale.productId,
            variantId: sale.variantId,
            quantity: 0,
            reservedQuantity: 0,
          },
        });
        row = { id: created.id, quantity: 0, reserved_quantity: 0 };
      }

      await tx.inventoryItem.update({
        where: { id: row.id },
        data: { quantity: row.quantity + restoreQty },
      });

      await tx.inventoryMovement.create({
        data: {
          storeId,
          productId: sale.productId,
          variantId: sale.variantId,
          type: InventoryMovementType.RETURN,
          quantity: restoreQty,
          referenceType: 'ORDER',
          referenceId: orderId,
          note: `Cancel ${orderNumber}`,
        },
      });
    }
  }

  private async lockInventoryRow(
    tx: Prisma.TransactionClient,
    storeId: string,
    productId: string,
    variantId: string | null,
  ): Promise<LockedInventory | null> {
    if (variantId) {
      const rows = await tx.$queryRaw<LockedInventory[]>`
        SELECT id, quantity, reserved_quantity
        FROM inventory_items
        WHERE store_id = ${storeId}::uuid
          AND product_id = ${productId}::uuid
          AND variant_id = ${variantId}::uuid
        FOR UPDATE
      `;
      return rows[0] ?? null;
    }
    const rows = await tx.$queryRaw<LockedInventory[]>`
      SELECT id, quantity, reserved_quantity
      FROM inventory_items
      WHERE store_id = ${storeId}::uuid
        AND product_id = ${productId}::uuid
        AND variant_id IS NULL
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  private async lockOrderRow(
    tx: Prisma.TransactionClient,
    storeId: string,
    orderId: string,
  ) {
    const rows = await tx.$queryRaw<
      {
        id: string;
        status: OrderStatus;
        payment_status: PaymentStatus;
        fulfillment_status: FulfillmentStatus;
        order_number: string;
      }[]
    >`
      SELECT id, status, payment_status, fulfillment_status, order_number
      FROM orders
      WHERE id = ${orderId}::uuid AND store_id = ${storeId}::uuid
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  private buildWhere(
    storeId: string,
    query: ListOrdersQueryDto,
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = { storeId };

    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.fulfillmentStatus) {
      where.fulfillmentStatus = query.fulfillmentStatus;
    }
    if (query.shippingMethod?.trim()) {
      where.shippingMethodName = {
        contains: query.shippingMethod.trim(),
        mode: 'insensitive',
      };
    }
    if (query.customerId) where.customerId = query.customerId;

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) {
        const from = new Date(query.createdFrom);
        if (Number.isNaN(from.getTime())) {
          throw new BadRequestException('createdFrom is invalid');
        }
        where.createdAt.gte = from;
      }
      if (query.createdTo) {
        const to = new Date(query.createdTo);
        if (Number.isNaN(to.getTime())) {
          throw new BadRequestException('createdTo is invalid');
        }
        where.createdAt.lte = to;
      }
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { customer: { email: { contains: term, mode: 'insensitive' } } },
        { customer: { phone: { contains: term, mode: 'insensitive' } } },
        { customer: { firstName: { contains: term, mode: 'insensitive' } } },
        { customer: { lastName: { contains: term, mode: 'insensitive' } } },
        {
          addresses: {
            some: {
              OR: [
                { email: { contains: term, mode: 'insensitive' } },
                { phone: { contains: term, mode: 'insensitive' } },
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    return where;
  }

  private detailInclude() {
    return {
      customer: {
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      },
      items: { orderBy: { createdAt: 'asc' as const } },
      addresses: true,
      payments: { orderBy: { createdAt: 'desc' as const } },
      shipments: { orderBy: { createdAt: 'desc' as const } },
    };
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, tenantId: true, currency: true },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }

  private async requireOrder(storeId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: this.detailInclude(),
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private toListDto(
    order: {
      id: string;
      storeId: string;
      customerId: string | null;
      orderNumber: string;
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      fulfillmentStatus: FulfillmentStatus;
      currency: string;
      subtotal: Prisma.Decimal;
      discountTotal: Prisma.Decimal;
      shippingTotal: Prisma.Decimal;
      taxTotal: Prisma.Decimal;
      grandTotal: Prisma.Decimal;
      shippingMethodName?: string | null;
      shippingMethodType?: import('@prisma/client').ShippingMethodType | null;
      shippingZoneName?: string | null;
      couponCode?: string | null;
      createdAt: Date;
      updatedAt: Date;
      customer: {
        id: string;
        email: string | null;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
      } | null;
      items?: { id: string; quantity: number }[];
      _count?: { items: number };
    },
  ) {
    const itemCount =
      order._count?.items ??
      order.items?.reduce((sum, item) => sum + item.quantity, 0) ??
      0;
    return {
      id: order.id,
      storeId: order.storeId,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      currency: order.currency,
      subtotal: moneyToString(order.subtotal)!,
      discountTotal: moneyToString(order.discountTotal)!,
      shippingTotal: moneyToString(order.shippingTotal)!,
      taxTotal: moneyToString(order.taxTotal)!,
      grandTotal: moneyToString(order.grandTotal)!,
      shippingMethodName: order.shippingMethodName ?? null,
      shippingMethodType: order.shippingMethodType ?? null,
      shippingZoneName: order.shippingZoneName ?? null,
      couponCode: order.couponCode ?? null,
      itemCount,
      customer: order.customer,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private async toDetailDto(
    order: Awaited<ReturnType<OrdersService['requireOrder']>>,
  ) {
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
      ...this.toListDto({
        ...order,
        items: order.items.map((i) => ({ id: i.id, quantity: i.quantity })),
      }),
      publicReference: order.publicReference,
      cancelReason: order.cancelReason ?? null,
      customerNote: order.customerNote,
      internalNote: order.internalNote,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: moneyToString(item.unitPrice)!,
        totalPrice: moneyToString(item.totalPrice)!,
        createdAt: item.createdAt,
      })),
      addresses: order.addresses.map((address) => ({
        id: address.id,
        type: address.type,
        firstName: address.firstName,
        lastName: address.lastName,
        company: address.company,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        phone: address.phone,
        email: address.email,
        divisionId: address.divisionId,
        districtId: address.districtId,
        upazilaId: address.upazilaId,
        divisionName: address.divisionName,
        districtName: address.districtName,
        upazilaName: address.upazilaName,
        landmark: address.landmark,
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        providerPaymentId: payment.providerPaymentId,
        internalReference: payment.internalReference,
        attemptNumber: payment.attemptNumber,
        amount: moneyToString(payment.amount)!,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      })),
      shipments: order.shipments.map((shipment) => ({
        id: shipment.id,
        provider: shipment.provider,
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        shippedAt: shipment.shippedAt,
        deliveredAt: shipment.deliveredAt,
        createdAt: shipment.createdAt,
        updatedAt: shipment.updatedAt,
      })),
      timeline,
    };
  }
}
