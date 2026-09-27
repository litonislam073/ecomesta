import {
  FulfillmentStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';
import { customerCancellationBlock } from '../src/modules/orders/customer-cancellation';

const eligible = {
  enabled: true,
  status: OrderStatus.PENDING,
  paymentStatus: PaymentStatus.PENDING,
  fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
  payments: [] as { provider: PaymentProvider; status: PaymentStatus }[],
  shipmentCount: 0,
};

describe('customerCancellationBlock', () => {
  it('allows unpaid, unfulfilled PENDING and CONFIRMED orders', () => {
    expect(customerCancellationBlock(eligible)).toBeNull();
    expect(
      customerCancellationBlock({ ...eligible, status: OrderStatus.CONFIRMED }),
    ).toBeNull();
    expect(
      customerCancellationBlock({
        ...eligible,
        payments: [{ provider: PaymentProvider.COD, status: PaymentStatus.PENDING }],
      }),
    ).toBeNull();
  });

  it('blocks when the store setting is off', () => {
    expect(customerCancellationBlock({ ...eligible, enabled: false })).toBe('DISABLED');
  });

  it.each([OrderStatus.PROCESSING, OrderStatus.CANCELLED, OrderStatus.COMPLETED])(
    'blocks orders in status %s',
    (status) => {
      expect(customerCancellationBlock({ ...eligible, status })).toBe('ORDER_STATUS');
    },
  );

  it('blocks fulfilled, paid, shipped and online-paid orders', () => {
    expect(
      customerCancellationBlock({
        ...eligible,
        fulfillmentStatus: FulfillmentStatus.PARTIALLY_FULFILLED,
      }),
    ).toBe('FULFILLMENT');
    expect(
      customerCancellationBlock({ ...eligible, paymentStatus: PaymentStatus.PAID }),
    ).toBe('PAYMENT');
    expect(customerCancellationBlock({ ...eligible, shipmentCount: 1 })).toBe('SHIPMENT');
    expect(
      customerCancellationBlock({
        ...eligible,
        payments: [{ provider: PaymentProvider.STRIPE, status: PaymentStatus.PENDING }],
      }),
    ).toBe('ONLINE_PAYMENT');
    expect(
      customerCancellationBlock({
        ...eligible,
        payments: [{ provider: PaymentProvider.SSL_COMMERZ, status: PaymentStatus.AUTHORIZED }],
      }),
    ).toBe('ONLINE_PAYMENT');
  });
});
