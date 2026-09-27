import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  FulfillmentStatus,
  OrderStatus,
  Prisma,
  ShipmentStatus,
  ShippingProvider,
  StoreRole,
  type Shipment,
} from '@prisma/client';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { assertShipmentStatusTransition } from '../payments/payment-transitions';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShipmentDto, UpdateShipmentDto } from './dto/shipment.dto';

/**
 * Relationship (Phase 11):
 * - Shipment.status is the source of truth for parcel tracking.
 * - When a shipment reaches SHIPPED / IN_TRANSIT / DELIVERED, order.fulfillmentStatus
 *   is advanced to FULFILLED if it is still UNFULFILLED or PARTIALLY_FULFILLED.
 * - Updating order.fulfillmentStatus directly may still create a stub shipment
 *   (existing Phase 8 behavior) but will not overwrite an existing shipment status
 *   with a lower lifecycle value.
 * - No circular loops: shipment → order is one-way; order fulfillment stub create
 *   only runs when no shipment exists.
 */
@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async create(
    userId: string,
    storeId: string,
    orderId: string,
    dto: CreateShipmentDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const order = await this.requireOrder(storeId, orderId);
    if (order.status === OrderStatus.CANCELLED) {
      throw new UnprocessableEntityException(
        'Cannot create a shipment for a cancelled order',
      );
    }

    const status = dto.status ?? ShipmentStatus.PENDING;
    const now = new Date();
    const shipment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          storeId,
          orderId,
          provider: dto.provider ?? ShippingProvider.MANUAL,
          status,
          trackingNumber: dto.trackingNumber?.trim() || null,
          shippedAt: this.isShippedLike(status) ? now : null,
          deliveredAt: status === ShipmentStatus.DELIVERED ? now : null,
        },
      });
      const fulfillmentChanged = await this.syncOrderFulfillment(
        tx,
        storeId,
        orderId,
        status,
      );
      return { created, fulfillmentChanged };
    });

    await this.audit.log({
      action: 'SHIPMENT_CREATED',
      entityType: 'Shipment',
      entityId: shipment.created.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        orderId,
        orderNumber: order.orderNumber,
        status: shipment.created.status,
      },
      req,
    });

    if (shipment.fulfillmentChanged) {
      await this.audit.log({
        action: 'FULFILLMENT_STATUS_CHANGED',
        entityType: 'Order',
        entityId: orderId,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: {
          fulfillmentStatus: FulfillmentStatus.FULFILLED,
          source: 'shipment',
        },
        req,
      });
    }

    return { success: true as const, data: this.toDto(shipment.created) };
  }

  async list(userId: string, storeId: string, orderId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireOrder(storeId, orderId);

    const items = await this.prisma.shipment.findMany({
      where: { storeId, orderId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true as const,
      data: items.map((item) => this.toDto(item)),
    };
  }

  async update(
    userId: string,
    storeId: string,
    orderId: string,
    shipmentId: string,
    dto: UpdateShipmentDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    await this.requireOrder(storeId, orderId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { id: string; status: ShipmentStatus; tracking_number: string | null }[]
      >`
        SELECT id, status, tracking_number
        FROM shipments
        WHERE id = ${shipmentId}::uuid
          AND store_id = ${storeId}::uuid
          AND order_id = ${orderId}::uuid
        FOR UPDATE
      `;
      const row = locked[0];
      if (!row) {
        throw new NotFoundException('Shipment not found');
      }

      const data: Prisma.ShipmentUpdateInput = {};
      let trackingChanged = false;
      if (dto.trackingNumber !== undefined) {
        const next =
          dto.trackingNumber === null
            ? null
            : dto.trackingNumber.trim() || null;
        if (next !== row.tracking_number) {
          trackingChanged = true;
        }
        data.trackingNumber = next;
      }
      if (dto.provider !== undefined) {
        data.provider = dto.provider;
      }

      if (dto.status !== undefined) {
        assertShipmentStatusTransition(row.status, dto.status);
        data.status = dto.status;
        const now = new Date();
        if (this.isShippedLike(dto.status) && !this.isShippedLike(row.status)) {
          data.shippedAt = now;
        }
        if (dto.status === ShipmentStatus.DELIVERED) {
          data.deliveredAt = now;
          if (!this.isShippedLike(row.status)) {
            data.shippedAt = now;
          }
        }
      }

      const shipment = await tx.shipment.update({
        where: { id: row.id },
        data,
      });

      let fulfillmentChanged = false;
      if (dto.status !== undefined) {
        fulfillmentChanged = await this.syncOrderFulfillment(
          tx,
          storeId,
          orderId,
          dto.status,
        );
      }

      return {
        shipment,
        previousStatus: row.status,
        trackingChanged,
        fulfillmentChanged,
      };
    });

    if (updated.trackingChanged) {
      await this.audit.log({
        action: 'TRACKING_NUMBER_UPDATED',
        entityType: 'Shipment',
        entityId: updated.shipment.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: {
          orderId,
          trackingNumber: updated.shipment.trackingNumber,
        },
        req,
      });
    }

    if (dto.status !== undefined) {
      await this.audit.log({
        action: 'SHIPMENT_STATUS_CHANGED',
        entityType: 'Shipment',
        entityId: updated.shipment.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: {
          orderId,
          from: updated.previousStatus,
          to: dto.status,
          trackingNumber: updated.shipment.trackingNumber,
        },
        req,
      });
    }

    if (updated.fulfillmentChanged) {
      await this.audit.log({
        action: 'FULFILLMENT_STATUS_CHANGED',
        entityType: 'Order',
        entityId: orderId,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: {
          fulfillmentStatus: FulfillmentStatus.FULFILLED,
          source: 'shipment',
        },
        req,
      });
    }

    return { success: true as const, data: this.toDto(updated.shipment) };
  }

  private isShippedLike(status: ShipmentStatus): boolean {
    return (
      status === ShipmentStatus.SHIPPED ||
      status === ShipmentStatus.IN_TRANSIT ||
      status === ShipmentStatus.DELIVERED
    );
  }

  /** @returns true when order fulfillment was advanced */
  private async syncOrderFulfillment(
    tx: Prisma.TransactionClient,
    storeId: string,
    orderId: string,
    shipmentStatus: ShipmentStatus,
  ): Promise<boolean> {
    if (!this.isShippedLike(shipmentStatus)) {
      return false;
    }
    const order = await tx.order.findFirst({
      where: { id: orderId, storeId },
      select: { fulfillmentStatus: true },
    });
    if (!order) return false;
    if (
      order.fulfillmentStatus === FulfillmentStatus.UNFULFILLED ||
      order.fulfillmentStatus === FulfillmentStatus.PARTIALLY_FULFILLED
    ) {
      await tx.order.update({
        where: { id: orderId },
        data: { fulfillmentStatus: FulfillmentStatus.FULFILLED },
      });
      return true;
    }
    return false;
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, tenantId: true },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }

  private async requireOrder(storeId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      select: { id: true, orderNumber: true, status: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private toDto(shipment: Shipment) {
    return {
      id: shipment.id,
      storeId: shipment.storeId,
      orderId: shipment.orderId,
      provider: shipment.provider,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      shippedAt: shipment.shippedAt,
      deliveredAt: shipment.deliveredAt,
      metadata: shipment.metadata,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    };
  }
}
