import type { ShipmentStatus, ShippingProvider } from '@prisma/client';

/**
 * Courier integrations (Steadfast now; Pathao, RedX, Paperfly later) implement
 * this. Provider-specific URLs, payloads and status names stay inside the
 * provider; the rest of the app only sees these shapes.
 */
export interface CourierProvider {
  readonly code: ShippingProvider;
  readonly displayName: string;
  /** False when the courier's API has no cancellation: the UI must not offer it. */
  readonly supportsCancellation: boolean;

  /** Read-only call proving the credentials work (never creates anything). */
  validateCredentials(credentials: CourierCredentials): Promise<void>;
  createShipment(credentials: CourierCredentials, input: CourierShipmentInput): Promise<CourierBooking>;
  getShipmentStatus(credentials: CourierCredentials, ref: CourierShipmentRef): Promise<CourierStatusResult>;
  /** Ecomesta meaning of a raw courier status (null status = no safe equivalent). */
  describeStatus(providerStatus: string): CourierStatusResult;
  /** Public tracking page for the parcel, or null when the courier documents none. */
  trackingUrl(ref: CourierShipmentRef): string | null;
}

export type CourierCredentials = Record<string, string>;

export interface CourierShipmentInput {
  /** Our reference for the parcel, unique per courier account (Steadfast `invoice`). */
  reference: string;
  recipientName: string;
  /** Bangladeshi mobile number, 11 digits starting with 0. */
  recipientPhone: string;
  recipientAddress: string;
  /** Cash to collect on delivery; 0 for prepaid orders. */
  codAmount: string;
  note?: string;
}

export interface CourierShipmentRef {
  providerShipmentId: string | null;
  reference: string | null;
  trackingCode: string | null;
}

export interface CourierBooking {
  providerShipmentId: string | null;
  trackingCode: string | null;
  providerStatus: string | null;
}

export interface CourierStatusResult {
  providerStatus: string;
  /** Null when the courier status has no safe Ecomesta equivalent (unknown, partial, hold). */
  status: ShipmentStatus | null;
  /** Human label for the raw courier status. */
  label: string;
}
