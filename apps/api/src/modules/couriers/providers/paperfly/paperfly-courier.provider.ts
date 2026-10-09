import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShipmentStatus, ShippingProvider } from '@prisma/client';
import { courierErrors } from '../../courier-errors';
import type {
  CourierBooking,
  CourierCredentials,
  CourierField,
  CourierProvider,
  CourierShipmentInput,
  CourierShipmentRef,
  CourierStatusResult,
} from '../../courier-provider';
import {
  CourierHttp,
  courierCall,
  firstMessage,
  requireCredential,
  unknownStatus,
  wholeTakaCod,
  type CourierHttpResponse,
} from '../../courier.http';

/** Paperfly merchant API, live host. Sandbox: https://sandbox.paperfly-bd.com */
export const PAPERFLY_DEFAULT_BASE_URL = 'https://api.paperfly.com.bd';
const NAME = 'Paperfly';
/** Reference used only to check credentials: a tracking lookup that creates nothing. */
const CHECK_REFERENCE = 'ECOMESTA-CONNECTION-CHECK';

type PaperflyBody = { response_code?: number | string; success?: unknown; error?: unknown; message?: unknown };

/**
 * Paperfly reports progress as a set of milestone fields on the tracking
 * answer; the furthest one reached is the parcel's status. Conservative: an
 * answer with none of them leaves the shipment unchanged.
 */
const MILESTONES: { key: string; status: ShipmentStatus | null; label: string }[] = [
  { key: 'Pick', status: ShipmentStatus.SHIPPED, label: 'Picked up by Paperfly' },
  { key: 'inTransit', status: ShipmentStatus.IN_TRANSIT, label: 'In transit' },
  { key: 'ReceivedAtPoint', status: ShipmentStatus.IN_TRANSIT, label: 'At the delivery point' },
  { key: 'PickedForDelivery', status: ShipmentStatus.IN_TRANSIT, label: 'Out for delivery' },
  { key: 'Delivered', status: ShipmentStatus.DELIVERED, label: 'Delivered' },
  { key: 'Returned', status: ShipmentStatus.RETURNED, label: 'Returned' },
];

/**
 * Paperfly merchant API (HTTP Basic auth with the merchant username and
 * password, plus the `paperflykey` header):
 * - POST /OrderPlacement {merOrderRef, pickMerchant*, productSizeWeight, productBrief, packagePrice,
 *   deliveryOption, custname, custaddress, customerThana, customerDistrict, custPhone, max_weight}
 *   → {response_code: 200, success: {tracking_number, message}}
 * - POST /API-Order-Tracking {ReferenceNumber} → {success: {trackingStatus: [{Pick, inTransit, …}]}}
 * Customer thana and district come from the order's upazila and district.
 */
@Injectable()
export class PaperflyCourierProvider implements CourierProvider {
  readonly code = ShippingProvider.PAPERFLY;
  readonly displayName = NAME;
  readonly supportsCancellation = false;
  readonly fields = [
    { key: 'username', label: 'Paperfly username', secret: false, required: true },
    { key: 'password', label: 'Paperfly password', secret: true, required: true },
    { key: 'paperflyKey', label: 'Paperfly API key', secret: true, required: true },
    { key: 'pickupThana', label: 'Pickup thana', secret: false, required: true, placeholder: 'Dhanmondi' },
    { key: 'pickupDistrict', label: 'Pickup district', secret: false, required: true, placeholder: 'Dhaka' },
  ] as const satisfies readonly CourierField[];
  readonly connectHelp =
    'Ask Paperfly merchant support for API access: they give you the username, password and API key. Also fill in the pickup name, phone and address below.';
  readonly locationSteps = [];
  private readonly baseUrl: string;

  constructor(
    private readonly http: CourierHttp,
    config: ConfigService,
  ) {
    this.baseUrl = (config.get<string>('PAPERFLY_BASE_URL') || PAPERFLY_DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  async validateCredentials(credentials: CourierCredentials): Promise<void> {
    // A tracking lookup for a reference that does not exist: answered without 401 when the keys work.
    const res = await this.call('/API-Order-Tracking', credentials, { ReferenceNumber: CHECK_REFERENCE });
    if (res.status === 401 || res.status === 403 || res.body === null) throw courierErrors.authFailed(NAME);
  }

  async createShipment(credentials: CourierCredentials, input: CourierShipmentInput): Promise<CourierBooking> {
    const pickup = input.pickup;
    if (!pickup?.name || !pickup.phone || !pickup.address) {
      throw courierErrors.validation(NAME, 'add the pickup name, phone and address in Settings → Couriers', ['pickup']);
    }
    if (!input.upazilaName || !input.districtName) {
      throw courierErrors.validation(NAME, 'the delivery address needs a district and upazila (thana)', ['customerThana']);
    }
    const res = await this.call('/OrderPlacement', credentials, {
      merOrderRef: input.reference,
      pickMerchantName: pickup.name,
      pickMerchantAddress: pickup.address,
      pickMerchantThana: requireCredential(credentials, 'pickupThana', NAME),
      pickMerchantDistrict: requireCredential(credentials, 'pickupDistrict', NAME),
      pickupMerchantPhone: pickup.phone,
      productSizeWeight: 'standard',
      productBrief: input.itemDescription?.slice(0, 200) ?? '',
      packagePrice: String(wholeTakaCod(NAME, input.codAmount)),
      deliveryOption: 'regular',
      custname: input.recipientName.slice(0, 100),
      custaddress: input.recipientAddress.slice(0, 250),
      customerThana: input.upazilaName,
      customerDistrict: input.districtName,
      custPhone: input.recipientPhone,
      max_weight: String(Math.min(100, Math.max(0.1, input.weightKg ?? 0.5))),
    });
    const body = res.body as PaperflyBody | null;
    const success = objectOf(body?.success);
    if (res.status === 200 && success && Number(body?.response_code ?? 200) === 200) {
      const tracking = success.tracking_number ?? success.trackingNumber;
      const id = typeof tracking === 'string' || typeof tracking === 'number' ? String(tracking) : null;
      // Paperfly finds the parcel by our reference too, so a missing tracking number is still a booking.
      return { providerShipmentId: id, trackingCode: id, providerStatus: null };
    }
    throw this.failure(res);
  }

  async getShipmentStatus(credentials: CourierCredentials, ref: CourierShipmentRef): Promise<CourierStatusResult> {
    const reference = ref.reference ?? ref.providerShipmentId;
    if (!reference) throw courierErrors.notFound(NAME);
    const res = await this.call('/API-Order-Tracking', credentials, { ReferenceNumber: reference });
    const success = objectOf((res.body as PaperflyBody | null)?.success);
    const steps = success?.trackingStatus;
    const latest = Array.isArray(steps) ? objectOf(steps[0]) : objectOf(steps);
    if (res.status === 200 && latest) {
      const reached = [...MILESTONES].reverse().find((m) => isReached(latest[m.key]));
      return reached
        ? { providerStatus: reached.key, status: reached.status, label: reached.label }
        : { providerStatus: 'booked', status: ShipmentStatus.LABEL_CREATED, label: 'Booked, waiting for pickup' };
    }
    if (res.status === 200 || res.status === 404) throw courierErrors.notFound(NAME);
    throw this.failure(res);
  }

  describeStatus(providerStatus: string): CourierStatusResult {
    const raw = providerStatus.trim();
    const milestone = MILESTONES.find((m) => m.key.toLowerCase() === raw.toLowerCase());
    if (milestone) return { providerStatus: milestone.key, status: milestone.status, label: milestone.label };
    if (raw.toLowerCase() === 'booked') return { providerStatus: 'booked', status: ShipmentStatus.LABEL_CREATED, label: 'Booked, waiting for pickup' };
    return { providerStatus: raw, ...unknownStatus(NAME, raw) };
  }

  trackingUrl(): string | null {
    return null;
  }

  private call(path: string, credentials: CourierCredentials, body: unknown) {
    const username = requireCredential(credentials, 'username', NAME);
    const password = requireCredential(credentials, 'password', NAME);
    return courierCall(this.http, NAME, {
      method: 'POST',
      url: `${this.baseUrl}${path}`,
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        paperflykey: requireCredential(credentials, 'paperflyKey', NAME),
      },
      body,
    });
  }

  private failure(res: CourierHttpResponse) {
    const body = res.body as PaperflyBody | null;
    if (res.status === 400 || res.status === 422 || (res.status === 200 && (body?.error || body?.message))) {
      return courierErrors.validation(NAME, firstMessage(body?.error) ?? firstMessage(body?.message) ?? 'the parcel details were rejected', []);
    }
    return courierErrors.badResponse(NAME);
  }
}

function objectOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** A milestone counts as reached when Paperfly gave it a value (a date or a yes). */
function isReached(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value !== 'string') return false;
  const text = value.trim().toLowerCase();
  return text !== '' && text !== 'no' && text !== 'false' && text !== '0' && text !== 'n/a';
}
