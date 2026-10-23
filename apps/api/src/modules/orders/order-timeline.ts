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
  | 'PAYMENT_REFUNDED'
  | 'PAYMENT_PARTIALLY_REFUNDED'
  | 'PROCESSING'
  | 'ORDER_COMPLETED'
  | 'FULFILLED'
  | 'SHIPMENT_CREATED'
  | 'SHIPPED'
  | 'IN_TRANSIT'
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
  PAYMENT_REFUNDED: {
    label: 'Payment refunded',
    description: 'Payment was fully refunded.',
  },
  PAYMENT_PARTIALLY_REFUNDED: {
    label: 'Partial refund',
    description: 'A partial refund was recorded.',
  },
  PROCESSING: {
    label: 'Processing',
    description: 'The store is preparing your order.',
  },
  ORDER_COMPLETED: {
    label: 'Order completed',
    description: 'The order was marked completed.',
  },
  FULFILLED: {
    label: 'Fulfilled',
    description: 'Fulfillment was marked complete.',
  },
  SHIPMENT_CREATED: {
    label: 'Shipment created',
    description: 'A shipment was created for your order.',
  },
  SHIPPED: {
    label: 'Shipped',
    description: 'Your order has been shipped.',
  },
  IN_TRANSIT: {
    label: 'In transit',
    description: 'Your shipment is in transit.',
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

function metaString(metadata: unknown, key: string): string | null {
  return metaStatus(metadata, key);
}

function refundDescription(metadata: unknown, full: boolean): string | null {
  const amount = metaString(metadata, 'amount');
  const currency = metaString(metadata, 'currency');
  const reason = metaString(metadata, 'reason');
  const parts: string[] = [];
  if (amount) {
    parts.push(
      full
        ? `Refunded ${currency ? `${currency} ` : ''}${amount}.`
        : `Partial refund of ${currency ? `${currency} ` : ''}${amount}.`,
    );
  }
  if (reason) {
    parts.push(reason);
  }
  return parts.length ? parts.join(' ') : null;
}

/**
 * Builds a customer-safe timeline from audit logs plus real order/payment/shipment state.
 * Never exposes user IDs, IPs, tenant IDs, or raw audit metadata.
 */
export function buildOrderTimeline(params: {
  order: TimelineOrder;
  payments: Array<
    Pick<Payment, 'status' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<Payment, 'amount' | 'currency'>>
  >;
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
        break;
      case 'ORDER_STATUS_CHANGED': {
        const status = metaStatus(audit.metadata, 'status');
        if (status === OrderStatus.CONFIRMED) add('ORDER_CONFIRMED', at);
        if (status === OrderStatus.PROCESSING) add('PROCESSING', at);
        if (status === OrderStatus.COMPLETED) add('ORDER_COMPLETED', at);
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
      case 'ORDER_FULFILLMENT_STATUS_CHANGED': {
        const fulfillment =
          metaStatus(audit.metadata, 'fulfillmentStatus') ??
          metaStatus(audit.metadata, 'status');
        if (fulfillment === FulfillmentStatus.FULFILLED) add('FULFILLED', at);
        break;
      }
      case 'ORDER_PAYMENT_STATUS_CHANGED':
      case 'PAYMENT_STATUS_CHANGED':
      case 'PAYMENT_REFUNDED': {
        const paymentStatus =
          metaStatus(audit.metadata, 'paymentStatus') ??
          metaStatus(audit.metadata, 'status');
        if (paymentStatus === PaymentStatus.PENDING) add('PAYMENT_PENDING', at);
        if (paymentStatus === PaymentStatus.PAID) add('PAYMENT_PAID', at);
        if (paymentStatus === PaymentStatus.FAILED) add('PAYMENT_FAILED', at);
        if (paymentStatus === PaymentStatus.REFUNDED) {
          add('PAYMENT_REFUNDED', at, refundDescription(audit.metadata, true));
        }
        if (paymentStatus === PaymentStatus.PARTIALLY_REFUNDED) {
          add(
            'PAYMENT_PARTIALLY_REFUNDED',
            at,
            refundDescription(audit.metadata, false),
          );
        }
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
        if (to === ShipmentStatus.SHIPPED) add('SHIPPED', at);
        if (to === ShipmentStatus.IN_TRANSIT) add('IN_TRANSIT', at);
        if (to === ShipmentStatus.DELIVERED) add('DELIVERED', at);
        break;
      }
      default:
        break;
    }
  }

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
  if (params.order.status === OrderStatus.COMPLETED) {
    if (!events.some((e) => e.type === 'ORDER_COMPLETED')) {
      add('ORDER_COMPLETED', params.order.createdAt);
    }
  }
  if (params.order.fulfillmentStatus === FulfillmentStatus.FULFILLED) {
    if (!events.some((e) => e.type === 'FULFILLED')) {
      add('FULFILLED', params.order.createdAt);
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
  if (params.order.paymentStatus === PaymentStatus.REFUNDED) {
    if (!events.some((e) => e.type === 'PAYMENT_REFUNDED')) {
      const refunded = params.payments.find((p) => p.status === PaymentStatus.REFUNDED);
      add(
        'PAYMENT_REFUNDED',
        refunded?.updatedAt ?? refunded?.createdAt ?? params.order.createdAt,
        refunded?.amount != null && refunded.currency
          ? `Refunded ${refunded.currency} ${refunded.amount.toString()}.`
          : null,
      );
    }
  }
  if (params.order.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED) {
    if (!events.some((e) => e.type === 'PAYMENT_PARTIALLY_REFUNDED')) {
      const partial = params.payments.find(
        (p) => p.status === PaymentStatus.PARTIALLY_REFUNDED,
      );
      add(
        'PAYMENT_PARTIALLY_REFUNDED',
        partial?.updatedAt ?? partial?.createdAt ?? params.order.createdAt,
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
    if (
      shipment.status === ShipmentStatus.IN_TRANSIT ||
      shipment.status === ShipmentStatus.DELIVERED
    ) {
      if (!events.some((e) => e.type === 'IN_TRANSIT')) {
        // Only gap-fill IN_TRANSIT when currently in transit (not for delivered-only).
        if (shipment.status === ShipmentStatus.IN_TRANSIT) {
          add('IN_TRANSIT', shipment.updatedAt ?? shipment.createdAt);
        }
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
