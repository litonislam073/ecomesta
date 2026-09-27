import { OrderStatus, PaymentStatus, FulfillmentStatus, ShipmentStatus } from '@prisma/client';
import { buildOrderTimeline } from '../src/modules/orders/order-timeline';

describe('buildOrderTimeline', () => {
  const baseOrder = {
    id: 'ord-1',
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
    cancelReason: null,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
  };

  it('includes order created and payment pending from state', () => {
    const events = buildOrderTimeline({
      order: baseOrder,
      payments: [
        {
          status: PaymentStatus.PENDING,
          createdAt: new Date('2026-01-01T10:00:01.000Z'),
          updatedAt: new Date('2026-01-01T10:00:01.000Z'),
        },
      ],
      shipments: [],
      audits: [
        {
          action: 'ORDER_CREATED',
          entityType: 'Order',
          entityId: 'ord-1',
          metadata: null,
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
      ],
    });

    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['ORDER_CREATED', 'PAYMENT_PENDING']),
    );
    expect(events.every((e) => e.label && e.description && e.occurredAt)).toBe(
      true,
    );
  });

  it('maps audit status changes without inventing undelivered events', () => {
    const events = buildOrderTimeline({
      order: {
        ...baseOrder,
        status: OrderStatus.PROCESSING,
        paymentStatus: PaymentStatus.PAID,
      },
      payments: [
        {
          status: PaymentStatus.PAID,
          createdAt: new Date('2026-01-01T10:00:01.000Z'),
          updatedAt: new Date('2026-01-01T10:05:00.000Z'),
        },
      ],
      shipments: [
        {
          status: ShipmentStatus.SHIPPED,
          createdAt: new Date('2026-01-01T11:00:00.000Z'),
          updatedAt: new Date('2026-01-01T12:00:00.000Z'),
          shippedAt: new Date('2026-01-01T12:00:00.000Z'),
          deliveredAt: null,
          trackingNumber: 'TRK-1',
        },
      ],
      audits: [
        {
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'Order',
          entityId: 'ord-1',
          metadata: { status: 'CONFIRMED' },
          createdAt: new Date('2026-01-01T10:10:00.000Z'),
        },
        {
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'Order',
          entityId: 'ord-1',
          metadata: { status: 'PROCESSING' },
          createdAt: new Date('2026-01-01T10:20:00.000Z'),
        },
        {
          action: 'ORDER_PAYMENT_STATUS_CHANGED',
          entityType: 'Order',
          entityId: 'ord-1',
          metadata: { paymentStatus: 'PAID' },
          createdAt: new Date('2026-01-01T10:05:00.000Z'),
        },
        {
          action: 'SHIPMENT_CREATED',
          entityType: 'Shipment',
          entityId: 'ship-1',
          metadata: { orderId: 'ord-1' },
          createdAt: new Date('2026-01-01T11:00:00.000Z'),
        },
        {
          action: 'SHIPMENT_STATUS_CHANGED',
          entityType: 'Shipment',
          entityId: 'ship-1',
          metadata: { to: 'SHIPPED' },
          createdAt: new Date('2026-01-01T12:00:00.000Z'),
        },
      ],
    });

    const types = events.map((e) => e.type);
    expect(types).toContain('ORDER_CONFIRMED');
    expect(types).toContain('PROCESSING');
    expect(types).toContain('PAYMENT_PAID');
    expect(types).toContain('SHIPMENT_CREATED');
    expect(types).toContain('SHIPPED');
    expect(types).not.toContain('DELIVERED');
    expect(types).not.toContain('CANCELLED');
  });

  it('exposes cancel reason in cancelled description', () => {
    const events = buildOrderTimeline({
      order: {
        ...baseOrder,
        status: OrderStatus.CANCELLED,
        cancelReason: 'Out of stock',
      },
      payments: [],
      shipments: [],
      audits: [
        {
          action: 'ORDER_CANCELLED',
          entityType: 'Order',
          entityId: 'ord-1',
          metadata: { status: 'CANCELLED' },
          createdAt: new Date('2026-01-01T13:00:00.000Z'),
        },
      ],
    });

    const cancelled = events.find((e) => e.type === 'CANCELLED');
    expect(cancelled?.description).toContain('Out of stock');
  });
});
