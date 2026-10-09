import type { ShipmentStatus, ShippingProvider } from '@prisma/client';

/**
 * Courier integrations (Steadfast, Pathao, RedX, Paperfly, eCourier) implement
 * this. Provider-specific URLs, payloads and status names stay inside the
 * provider; the rest of the app only sees these shapes.
 */
export interface CourierProvider {
  readonly code: ShippingProvider;
  readonly displayName: string;
  /** False when the courier's API has no cancellation: the UI must not offer it. */
  readonly supportsCancellation: boolean;
  /** What the merchant enters to connect (secret values are write-only). */
  readonly fields: readonly CourierField[];
  /** One line telling the merchant where these values come from. */
  readonly connectHelp: string;
  /**
   * Courier-side places the merchant picks when booking (e.g. RedX delivery
   * area, eCourier city → thana → post code → area), in order. Empty when the
   * courier works from the address alone.
   */
  readonly locationSteps: readonly CourierLocationStep[];

  /**
   * Read-only call proving the credentials work (never creates anything).
   * May return the credentials completed with a value read from the courier
   * (e.g. the Pathao store when none was given).
   */
  validateCredentials(credentials: CourierCredentials): Promise<CourierCredentials | void>;
  createShipment(credentials: CourierCredentials, input: CourierShipmentInput): Promise<CourierBooking>;
  getShipmentStatus(credentials: CourierCredentials, ref: CourierShipmentRef): Promise<CourierStatusResult>;
  /** Ecomesta meaning of a raw courier status (null status = no safe equivalent). */
  describeStatus(providerStatus: string): CourierStatusResult;
  /** Public tracking page for the parcel, or null when the courier documents none. */
  trackingUrl(ref: CourierShipmentRef): string | null;
  /** Choices for one location step, given the values picked in the earlier steps. */
  locationOptions?(credentials: CourierCredentials, step: string, picked: Record<string, string>): Promise<CourierOption[]>;
}

export interface CourierField {
  key: string;
  label: string;
  /** Secret values are never sent back to the browser. */
  secret: boolean;
  required: boolean;
  hint?: string;
  placeholder?: string;
}

export interface CourierLocationStep {
  key: string;
  label: string;
}

export interface CourierOption {
  value: string;
  label: string;
}

export type CourierCredentials = Record<string, string>;

export interface CourierShipmentInput {
  /** Our reference for the parcel, unique per courier account (Steadfast `invoice`). */
  reference: string;
  recipientName: string;
  /** Bangladeshi mobile number, 11 digits starting with 0. */
  recipientPhone: string;
  /** Full one-line delivery address. */
  recipientAddress: string;
  /** Street part only (house, road, area), for couriers with short address fields. */
  addressLine?: string;
  districtName?: string | null;
  upazilaName?: string | null;
  postalCode?: string | null;
  /** Cash to collect on delivery; 0 for prepaid orders. */
  codAmount: string;
  /** Order total (for couriers that record the parcel value). */
  orderTotal?: string;
  weightKg?: number | null;
  itemCount?: number;
  itemDescription?: string;
  note?: string;
  /** Values picked for `locationSteps`, by step key. */
  location?: Record<string, string>;
  /** The store's pickup details from Settings → Couriers. */
  pickup?: { name: string | null; phone: string | null; address: string | null };
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
