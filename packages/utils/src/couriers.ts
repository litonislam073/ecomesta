/**
 * Couriers a shipment can name. Steadfast can also be booked through its API
 * (Settings → Couriers); the others are recorded by hand with their tracking
 * number. Values match the `ShippingProvider` enum.
 */
export const SHIPMENT_COURIERS = [
  { code: 'MANUAL', name: 'Own delivery' },
  { code: 'PATHAO', name: 'Pathao Courier' },
  { code: 'STEADFAST', name: 'Steadfast' },
  { code: 'REDX', name: 'RedX' },
  { code: 'PAPERFLY', name: 'Paperfly' },
  { code: 'ECOURIER', name: 'eCourier' },
  { code: 'DELIVERY_TIGER', name: 'Delivery Tiger' },
  { code: 'CARRYBEE', name: 'CarryBee' },
  { code: 'KARATOA', name: 'Karatoa Courier' },
  { code: 'OTHER', name: 'Other courier' },
] as const;

export type ShipmentCourierCode = (typeof SHIPMENT_COURIERS)[number]['code'];

/** Display name of a shipment's courier; unknown codes are shown as they are. */
export function courierName(code: string): string {
  return SHIPMENT_COURIERS.find((courier) => courier.code === code)?.name ?? code;
}
