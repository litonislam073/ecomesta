import { ShipmentStatus } from '@prisma/client';

/**
 * Steadfast `delivery_status` values, as listed by Steadfast's own packages
 * (steadfast-it/SteadFast-Courier-Laravel-Package, SteadFast Courier LTD's
 * WordPress plugin). Mapping is deliberately conservative: Steadfast does not
 * say when a parcel is picked up or in transit, so an accepted parcel stays
 * LABEL_CREATED until Steadfast reports it delivered or cancelled. Anything
 * not listed — or with no safe equivalent (hold, partial delivery, unknown) —
 * maps to null and leaves the shipment status unchanged; it never becomes
 * DELIVERED by default.
 */
const STEADFAST_STATUSES: Record<string, { status: ShipmentStatus | null; label: string }> = {
  in_review: { status: ShipmentStatus.LABEL_CREATED, label: 'Placed, waiting for Steadfast review' },
  pending: { status: ShipmentStatus.LABEL_CREATED, label: 'Booked, not delivered yet' },
  hold: { status: null, label: 'On hold at Steadfast' },
  delivered_approval_pending: { status: ShipmentStatus.DELIVERED, label: 'Delivered (awaiting Steadfast approval)' },
  delivered: { status: ShipmentStatus.DELIVERED, label: 'Delivered' },
  partial_delivered_approval_pending: { status: null, label: 'Partially delivered (awaiting Steadfast approval) — review in Steadfast' },
  partial_delivered: { status: null, label: 'Partially delivered — review in Steadfast' },
  cancelled_approval_pending: { status: ShipmentStatus.CANCELLED, label: 'Cancelled (awaiting Steadfast approval)' },
  cancelled: { status: ShipmentStatus.CANCELLED, label: 'Cancelled' },
  unknown_approval_pending: { status: null, label: 'Unknown (awaiting Steadfast approval) — contact Steadfast' },
  unknown: { status: null, label: 'Unknown — contact Steadfast' },
};

export function mapSteadfastStatus(raw: string): { status: ShipmentStatus | null; label: string } {
  const key = raw.trim().toLowerCase();
  return STEADFAST_STATUSES[key] ?? { status: null, label: `Unrecognised Steadfast status "${key.slice(0, 60)}"` };
}
