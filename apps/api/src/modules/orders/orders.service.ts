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
import {
  assertFulfillmentStatusTransition,
  assertOrderStatusTransition,
  assertPaymentStatusTransition,
} from './order-transitions';

type LockedInventory = {
  id: string;
  quantity: number;
  reserved_quantity: number;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly placement: OrderPlacementService,
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

    return { success: true as const, data: this.toDetailDto(result.order) };
  }

  /** Guest/public checkout — server prices, ACTIVE catalog only, forced PENDING payment. */
  async createPublicCheckout(
    storeId: string,
    input: {
      items: { productId: string; variantId?: string | null; quantity: number }[];
      shippingAddress: OrderAddressInputDto;
      billingAddress?: OrderAddressInputDto | null;
      customerNote?: string | null;
      paymentProvider: PaymentProvider;
      paymentMethod: PaymentMethod;
      idempotencyKey: string;
    },
    req?: Request,
  ) {
    const result = await this.placement.place({
      storeId,
      items: input.items,
      shippingAddress: input.shippingAddress,
      billingAddress: input.billingAddress,
      discountTotal: '0',
      shippingTotal: '0',
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
          itemCount: result.order.items.length,
          replayed: false,
        },
        req,
      });
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
    return { success: true as const, data: this.toDetailDto(order) };
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
        await this.restockOrderInventory(tx, storeId, locked.id, locked.order_number);
      }

      return tx.order.update({
        where: { id: locked.id },
        data: {
          status: dto.status,
          ...(dto.status === OrderStatus.CANCELLED
            ? {
                fulfillmentStatus: FulfillmentStatus.CANCELLED,
                paymentStatus:
                  locked.payment_status === PaymentStatus.PAID
                    ? locked.payment_status
                    : PaymentStatus.CANCELLED,
              }
            : {}),
        },
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
      metadata: { status: dto.status, orderNumber: updated.orderNumber },
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

    return { success: true as const, data: this.toDetailDto(updated) };
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

    return { success: true as const, data: this.toDetailDto(updated) };
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

    return { success: true as const, data: this.toDetailDto(updated) };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

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
      itemCount,
      customer: order.customer,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toDetailDto(
    order: Awaited<ReturnType<OrdersService['requireOrder']>>,
  ) {
    return {
      ...this.toListDto({
        ...order,
        items: order.items.map((i) => ({ id: i.id, quantity: i.quantity })),
      }),
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
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        provider: payment.provider,
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
    };
  }
}
