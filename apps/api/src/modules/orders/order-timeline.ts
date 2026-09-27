import {
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  ShipmentStatus,
  type AuditLog,
  type Payment,
  type Shipment,
} from '@prisma/client';

/** Customer/merchant-safe timeline event types (no inventing beyond real state). */
export type OrderTimelineEventType =
  | 'ORDER_CREATED'
  | 'ORDER_CONFIRMED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_PAID'
  | 'PAYMENT_FAILED'
  | 'PROCESSING'
  | 'SHIPMENT_CREATED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type OrderTimelineEvent = {
  type: OrderTimelineEventType;
  label: string;
  description: string;
  occurredAt: string;
};

type TimelineOrder = {
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  cancelReason: string | null;
  createdAt: Date;
};

type AuditRow = Pick<AuditLog, 'action' | 'entityType' | 'entityId' | 'metadata' | 'createdAt'>;

const LABELS: Record<OrderTimelineEventType, { label: string; description: string }> = {
  ORDER_CREATED: {
    label: 'Order placed',
    description: 'Your order was received.',
  },
  ORDER_CONFIRMED: {
    label: 'Order confirmed',
    description: 'The store confirmed your order.',
  },
  PAYMENT_PENDING: {
    label: 'Payment pending',
    description: 'Payment has not been completed yet.',
  },
  PAYMENT_PAID: {
    label: 'Payment received',
    description: 'Payment was recorded successfully.',
  },
  PAYMENT_FAILED: {
    label: 'Payment failed',
    description: 'A payment attempt did not succeed.',
  },
  PROCESSING: {
    label: 'Processing',
    description: 'The store is preparing your order.',
  },
  SHIPMENT_CREATED: {
    label: 'Shipment created',
    description: 'A shipment was created for your order.',
  },
  SHIPPED: {
    label: 'Shipped',
    description: 'Your order is on the way.',
  },
  DELIVERED: {
    label: 'Delivered',
    description: 'Your shipment was marked delivered.',
  },
  CANCELLED: {
    label: 'Cancelled',
    description: 'This order was cancelled.',
  },
};

function pushEvent(
  events: OrderTimelineEvent[],
  type: OrderTimelineEventType,
  occurredAt: Date,
  descriptionOverride?: string | null,
) {
  const base = LABELS[type];
  events.push({
    type,
    label: base.label,
    description: descriptionOverride?.trim() || base.description,
    occurredAt: occurredAt.toISOString(),
  });
}

function metaStatus(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

/**
 * Builds a customer-safe timeline from audit logs plus real order/payment/shipment state.
 * Never exposes user IDs, IPs, tenant IDs, or raw audit metadata.
 */
export function buildOrderTimeline(params: {
  order: TimelineOrder;
  payments: Pick<Payment, 'status' | 'createdAt' | 'updatedAt'>[];
  shipments: Pick<
    Shipment,
    'status' | 'createdAt' | 'updatedAt' | 'shippedAt' | 'deliveredAt' | 'trackingNumber'
  >[];
  audits: AuditRow[];
}): OrderTimelineEvent[] {
  const events: OrderTimelineEvent[] = [];
  const seen = new Set<string>();

  const add = (
    type: OrderTimelineEventType,
    at: Date,
    description?: string | null,
  ) => {
    const key = `${type}:${at.toISOString()}`;
    if (seen.has(key)) return;
    seen.add(key);
    pushEvent(events, type, at, description);
  };

  add('ORDER_CREATED', params.order.createdAt);

  for (const audit of params.audits) {
    const at = audit.createdAt;
    switch (audit.action) {
      case 'ORDER_CREATED':
        // already added from order.createdAt
        break;
      case 'ORDER_STATUS_CHANGED': {
        const status = metaStatus(audit.metadata, 'status');
        if (status === OrderStatus.CONFIRMED) add('ORDER_CONFIRMED', at);
        if (status === OrderStatus.PROCESSING) add('PROCESSING', at);
        if (status === OrderStatus.CANCELLED) {
          add(
            'CANCELLED',
            at,
            params.order.cancelReason
              ? `This order was cancelled. ${params.order.cancelReason}`
              : null,
          );
        }
        break;
      }
      case 'ORDER_CANCELLED':
        add(
          'CANCELLED',
          at,
          params.order.cancelReason
            ? `This order was cancelled. ${params.order.cancelReason}`
            : null,
        );
        break;
      case 'ORDER_PAYMENT_STATUS_CHANGED':
      case 'PAYMENT_STATUS_CHANGED': {
        const paymentStatus =
          metaStatus(audit.metadata, 'paymentStatus') ??
          metaStatus(audit.metadata, 'status');
        if (paymentStatus === PaymentStatus.PENDING) add('PAYMENT_PENDING', at);
        if (paymentStatus === PaymentStatus.PAID) add('PAYMENT_PAID', at);
        if (paymentStatus === PaymentStatus.FAILED) add('PAYMENT_FAILED', at);
        break;
      }
      case 'PAYMENT_INITIATED':
        add('PAYMENT_PENDING', at);
        break;
      case 'SHIPMENT_CREATED':
        add('SHIPMENT_CREATED', at);
        break;
      case 'SHIPMENT_STATUS_CHANGED': {
        const to = metaStatus(audit.metadata, 'to');
        if (
          to === ShipmentStatus.SHIPPED ||
          to === ShipmentStatus.IN_TRANSIT
        ) {
          add('SHIPPED', at);
        }
        if (to === ShipmentStatus.DELIVERED) add('DELIVERED', at);
        break;
      }
      default:
        break;
    }
  }

  // Fill gaps from current entity state when audits are sparse (still real events).
  if (
    params.order.status === OrderStatus.CONFIRMED ||
    params.order.status === OrderStatus.PROCESSING ||
    params.order.status === OrderStatus.COMPLETED
  ) {
    if (!events.some((e) => e.type === 'ORDER_CONFIRMED')) {
      add('ORDER_CONFIRMED', params.order.createdAt);
    }
  }
  if (
    params.order.status === OrderStatus.PROCESSING ||
    params.order.status === OrderStatus.COMPLETED
  ) {
    if (!events.some((e) => e.type === 'PROCESSING')) {
      add('PROCESSING', params.order.createdAt);
    }
  }

  if (params.order.paymentStatus === PaymentStatus.PENDING) {
    if (!events.some((e) => e.type === 'PAYMENT_PENDING')) {
      const payment = params.payments[0];
      add('PAYMENT_PENDING', payment?.createdAt ?? params.order.createdAt);
    }
  }
  if (params.order.paymentStatus === PaymentStatus.PAID) {
    if (!events.some((e) => e.type === 'PAYMENT_PAID')) {
      const paid = params.payments.find((p) => p.status === PaymentStatus.PAID);
      add('PAYMENT_PAID', paid?.updatedAt ?? paid?.createdAt ?? params.order.createdAt);
    }
  }
  if (params.order.paymentStatus === PaymentStatus.FAILED) {
    if (!events.some((e) => e.type === 'PAYMENT_FAILED')) {
      const failed = params.payments.find((p) => p.status === PaymentStatus.FAILED);
      add(
        'PAYMENT_FAILED',
        failed?.updatedAt ?? failed?.createdAt ?? params.order.createdAt,
      );
    }
  }

  for (const shipment of params.shipments) {
    if (!events.some((e) => e.type === 'SHIPMENT_CREATED')) {
      add('SHIPMENT_CREATED', shipment.createdAt);
    }
    if (
      shipment.status === ShipmentStatus.SHIPPED ||
      shipment.status === ShipmentStatus.IN_TRANSIT ||
      shipment.status === ShipmentStatus.DELIVERED
    ) {
      if (!events.some((e) => e.type === 'SHIPPED')) {
        add('SHIPPED', shipment.shippedAt ?? shipment.createdAt);
      }
    }
    if (shipment.status === ShipmentStatus.DELIVERED) {
      if (!events.some((e) => e.type === 'DELIVERED')) {
        add('DELIVERED', shipment.deliveredAt ?? shipment.updatedAt ?? shipment.createdAt);
      }
    }
  }

  if (params.order.status === OrderStatus.CANCELLED) {
    if (!events.some((e) => e.type === 'CANCELLED')) {
      add(
        'CANCELLED',
        params.order.createdAt,
        params.order.cancelReason
          ? `This order was cancelled. ${params.order.cancelReason}`
          : null,
      );
    }
  }

  events.sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
  return events;
}
