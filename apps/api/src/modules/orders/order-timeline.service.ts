import { Injectable } from '@nestjs/common';
import type {
  FulfillmentStatus,
  OrderStatus,
  Payment,
  PaymentStatus,
  Shipment,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildOrderTimeline,
  type OrderTimelineEvent,
} from './order-timeline';

@Injectable()
export class OrderTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async forOrder(params: {
    storeId: string;
    orderId: string;
    order: {
      id: string;
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      fulfillmentStatus: FulfillmentStatus;
      cancelReason: string | null;
      createdAt: Date;
    };
    payments: Pick<Payment, 'status' | 'createdAt' | 'updatedAt'>[];
    shipments: Pick<
      Shipment,
      | 'id'
      | 'status'
      | 'createdAt'
      | 'updatedAt'
      | 'shippedAt'
      | 'deliveredAt'
      | 'trackingNumber'
    >[];
  }): Promise<OrderTimelineEvent[]> {
    const shipmentIds = params.shipments.map((s) => s.id);
    const paymentRows = await this.prisma.payment.findMany({
      where: { storeId: params.storeId, orderId: params.orderId },
      select: { id: true },
    });
    const paymentIds = paymentRows.map((p) => p.id);

    const orFilters: Array<{
      entityType: string;
      entityId?: string | { in: string[] };
    }> = [{ entityType: 'Order', entityId: params.orderId }];
    if (shipmentIds.length) {
      orFilters.push({ entityType: 'Shipment', entityId: { in: shipmentIds } });
    }
    if (paymentIds.length) {
      orFilters.push({ entityType: 'Payment', entityId: { in: paymentIds } });
    }

    const audits = await this.prisma.auditLog.findMany({
      where: {
        storeId: params.storeId,
        OR: orFilters,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
      take: 200,
    });

    return buildOrderTimeline({
      order: params.order,
      payments: params.payments,
      shipments: params.shipments,
      audits,
    });
  }
}
