import { FulfillmentStatus, OrderStatus, Prisma, ShipmentStatus } from '@prisma/client';

/** Shipments in these states no longer count against their order. */
export const CLOSED_SHIPMENT_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.CANCELLED,
  ShipmentStatus.RETURNED,
  ShipmentStatus.FAILED,
];

/** The parcel has left the store (or arrived). */
export function isShippedLike(status: ShipmentStatus): boolean {
  return (
    status === ShipmentStatus.SHIPPED ||
    status === ShipmentStatus.IN_TRANSIT ||
    status === ShipmentStatus.DELIVERED
  );
}

/**
 * The order's open courier booking (booked, in progress or unconfirmed), if any.
 * A courier booking has a provider reference; it stays active until it is
 * cancelled, returned or failed. Call it inside the transaction that locked the
 * order row so the answer cannot change before the caller acts on it.
 */
export function findActiveCourierShipment(
  tx: Prisma.TransactionClient,
  storeId: string,
  orderId: string,
) {
  return tx.shipment.findFirst({
    where: {
      storeId,
      orderId,
      providerReference: { not: null },
      status: { notIn: CLOSED_SHIPMENT_STATUSES },
    },
    select: { id: true, provider: true, status: true },
  });
}

/**
 * One-way shipment → order link: once a shipment is shipped-like, an
 * UNFULFILLED / PARTIALLY_FULFILLED order becomes FULFILLED. A cancelled order
 * is never marked fulfilled. Never touches the order or payment status.
 * @returns true when order fulfillment was advanced
 */
export async function syncOrderFulfillment(
  tx: Prisma.TransactionClient,
  storeId: string,
  orderId: string,
  shipmentStatus: ShipmentStatus,
): Promise<boolean> {
  if (!isShippedLike(shipmentStatus)) {
    return false;
  }
  const order = await tx.order.findFirst({
    where: { id: orderId, storeId },
    select: { status: true, fulfillmentStatus: true },
  });
  if (!order || order.status === OrderStatus.CANCELLED) return false;
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
