import {
  FulfillmentStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';

const CANCELLABLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
];

/** Order-level payment states that mean no money has been taken. */
const UNPAID_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.FAILED,
  PaymentStatus.CANCELLED,
];

const ONLINE_PROVIDERS: PaymentProvider[] = [
  PaymentProvider.STRIPE,
  PaymentProvider.SSL_COMMERZ,
  PaymentProvider.TEST,
];

/** Online attempts that may still capture money (refunds are not automated). */
const LIVE_ONLINE_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.AUTHORIZED,
  PaymentStatus.PAID,
  PaymentStatus.PARTIALLY_PAID,
];

export type CustomerCancellationBlock =
  | 'DISABLED'
  | 'ORDER_STATUS'
  | 'FULFILLMENT'
  | 'PAYMENT'
  | 'ONLINE_PAYMENT'
  | 'SHIPMENT';

export const CUSTOMER_CANCELLATION_MESSAGES: Record<CustomerCancellationBlock, string> = {
  DISABLED: 'This store does not accept online cancellations. Please contact the store.',
  ORDER_STATUS: 'This order can no longer be cancelled online. Please contact the store.',
  FULFILLMENT: 'This order is already being fulfilled. Please contact the store.',
  PAYMENT: 'Paid orders cannot be cancelled online. Please contact the store.',
  ONLINE_PAYMENT:
    'This order has an online payment in progress and cannot be cancelled online. Please contact the store.',
  SHIPMENT: 'A shipment already exists for this order. Please contact the store.',
};

/**
 * Guest cancellation is limited to orders where nothing irreversible has
 * happened: not fulfilled, no shipment, and no money taken or in flight.
 */
export function customerCancellationBlock(input: {
  enabled: boolean;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  payments: { provider: PaymentProvider; status: PaymentStatus }[];
  shipmentCount: number;
}): CustomerCancellationBlock | null {
  if (!input.enabled) return 'DISABLED';
  if (!CANCELLABLE_ORDER_STATUSES.includes(input.status)) return 'ORDER_STATUS';
  if (input.fulfillmentStatus !== FulfillmentStatus.UNFULFILLED) return 'FULFILLMENT';
  if (!UNPAID_PAYMENT_STATUSES.includes(input.paymentStatus)) return 'PAYMENT';
  if (input.shipmentCount > 0) return 'SHIPMENT';
  const liveOnline = input.payments.some(
    (payment) =>
      ONLINE_PROVIDERS.includes(payment.provider) &&
      LIVE_ONLINE_PAYMENT_STATUSES.includes(payment.status),
  );
  if (liveOnline) return 'ONLINE_PAYMENT';
  return null;
}
