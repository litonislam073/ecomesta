import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.PENDING, OrderStatus.CANCELLED],
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.AUTHORIZED,
    PaymentStatus.PAID,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.AUTHORIZED]: [
    PaymentStatus.PAID,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.PAID]: [
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
  ],
  [PaymentStatus.PARTIALLY_PAID]: [
    PaymentStatus.PAID,
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.FAILED]: [PaymentStatus.PENDING, PaymentStatus.CANCELLED],
  [PaymentStatus.REFUNDED]: [],
  [PaymentStatus.PARTIALLY_REFUNDED]: [PaymentStatus.REFUNDED],
  [PaymentStatus.CANCELLED]: [],
};

const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  [FulfillmentStatus.UNFULFILLED]: [
    FulfillmentStatus.PARTIALLY_FULFILLED,
    FulfillmentStatus.FULFILLED,
    FulfillmentStatus.CANCELLED,
  ],
  [FulfillmentStatus.PARTIALLY_FULFILLED]: [
    FulfillmentStatus.FULFILLED,
    FulfillmentStatus.RETURNED,
    FulfillmentStatus.CANCELLED,
  ],
  [FulfillmentStatus.FULFILLED]: [FulfillmentStatus.RETURNED],
  [FulfillmentStatus.RETURNED]: [],
  [FulfillmentStatus.CANCELLED]: [],
};

function assertTransition<T extends string>(
  kind: string,
  from: T,
  to: T,
  map: Record<T, T[]>,
): void {
  if (from === to) {
    throw new BadRequestException(`${kind} is already ${from}`);
  }
  const allowed = map[from] ?? [];
  if (!allowed.includes(to)) {
    throw new UnprocessableEntityException(
      `Invalid ${kind} transition from ${from} to ${to}`,
    );
  }
}

export function assertOrderStatusTransition(from: OrderStatus, to: OrderStatus) {
  assertTransition('order status', from, to, ORDER_TRANSITIONS);
}

export function assertPaymentStatusTransition(
  from: PaymentStatus,
  to: PaymentStatus,
) {
  assertTransition('payment status', from, to, PAYMENT_TRANSITIONS);
}

export function assertFulfillmentStatusTransition(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
) {
  assertTransition('fulfillment status', from, to, FULFILLMENT_TRANSITIONS);
}

export function isCancellableStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status]?.includes(OrderStatus.CANCELLED) ?? false;
}
