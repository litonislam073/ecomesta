import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PaymentStatus, ShipmentStatus } from '@prisma/client';

/**
 * Payment status transitions (authoritative for Payment records).
 * Mirrors order payment transitions used in Phase 8/10.
 */
export const PAYMENT_STATUS_TRANSITIONS: Record<
  PaymentStatus,
  PaymentStatus[]
> = {
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

/**
 * Shipment lifecycle (Phase 11 — manual fulfillment only).
 */
export const SHIPMENT_STATUS_TRANSITIONS: Record<
  ShipmentStatus,
  ShipmentStatus[]
> = {
  [ShipmentStatus.PENDING]: [
    ShipmentStatus.LABEL_CREATED,
    ShipmentStatus.SHIPPED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.LABEL_CREATED]: [
    ShipmentStatus.SHIPPED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.SHIPPED]: [
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.DELIVERED,
    ShipmentStatus.FAILED,
    ShipmentStatus.RETURNED,
  ],
  [ShipmentStatus.IN_TRANSIT]: [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.FAILED,
    ShipmentStatus.RETURNED,
  ],
  [ShipmentStatus.DELIVERED]: [ShipmentStatus.RETURNED],
  [ShipmentStatus.FAILED]: [ShipmentStatus.PENDING, ShipmentStatus.CANCELLED],
  [ShipmentStatus.RETURNED]: [],
  [ShipmentStatus.CANCELLED]: [],
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

export function assertPaymentRecordStatusTransition(
  from: PaymentStatus,
  to: PaymentStatus,
) {
  assertTransition('payment status', from, to, PAYMENT_STATUS_TRANSITIONS);
}

export function assertShipmentStatusTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
) {
  assertTransition('shipment status', from, to, SHIPMENT_STATUS_TRANSITIONS);
}
