import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShipmentStatus, ShippingProvider } from '@prisma/client';
import { courierErrors } from '../../courier-errors';
import type {
  CourierBooking,
  CourierCredentials,
  CourierField,
  CourierOption,
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
  statusKey,
  unknownStatus,
  wholeTaka,
  wholeTakaCod,
  type CourierHttpResponse,
} from '../../courier.http';

/** eCourier merchant API v5.1, live base URL. Sandbox: https://staging.ecourier.com.bd/api */
export const ECOURIER_DEFAULT_BASE_URL = 'https://backoffice.ecourier.com.bd/api';
const NAME = 'eCourier';
/** eCourier's `product_id` (used to find a parcel by our reference) is at most 20 characters. */
const PRODUCT_ID_MAX = 20;

/**
 * eCourier tracking status names (API document v5.1, 2.2). Conservative:
 * anything unknown maps to null and leaves the shipment unchanged.
 */
const ECOURIER_STATUSES: Record<string, { status: ShipmentStatus | null; label: string }> = {
  initiated: { status: ShipmentStatus.LABEL_CREATED, label: 'Booked, waiting for pickup' },
  'initiated api': { status: ShipmentStatus.LABEL_CREATED, label: 'Booked, waiting for pickup' },
  'picked up': { status: ShipmentStatus.SHIPPED, label: 'Picked up by eCourier' },
  'in source branch': { status: ShipmentStatus.IN_TRANSIT, label: 'At the pickup branch' },
  'in transit': { status: ShipmentStatus.IN_TRANSIT, label: 'In transit' },
  'in destination branch': { status: ShipmentStatus.IN_TRANSIT, label: 'At the delivery branch' },
  'on the way to delivery': { status: ShipmentStatus.IN_TRANSIT, label: 'Out for delivery' },
  delivered: { status: ShipmentStatus.DELIVERED, label: 'Delivered' },
  'partial delivered': { status: null, label: 'Partially delivered — review in eCourier' },
  returned: { status: ShipmentStatus.RETURNED, label: 'Returned' },
  'return to merchant': { status: ShipmentStatus.RETURNED, label: 'Returned to you' },
  cancelled: { status: ShipmentStatus.CANCELLED, label: 'Cancelled' },
  hold: { status: null, label: 'On hold at eCourier' },
};

/**
 * eCourier merchant API v5.1 (headers `USER-ID`, `API-KEY`, `API-SECRET`; every call is POST):
 * - /packages → [{package_name, package_code, shipping_charge, coverage}] (also checks the keys)
 * - /city-list, /thana-list {city}, /postcode-list {city, thana}, /area-list {postcode}
 * - /order-place {recipient_name, recipient_mobile, recipient_city, recipient_thana, recipient_area,
 *   recipient_address, recipient_zip, package_code, product_price, payment_method, …}
 *   → {response_code: 200, ID: "ECR…"}
 * - /track {ecr | product_id} → {query_data: [{status: [[name, note, time], …newest first]}]}
 * The merchant picks the package, city, thana, post code and area when booking.
 */
@Injectable()
export class ECourierCourierProvider implements CourierProvider {
  readonly code = ShippingProvider.ECOURIER;
  readonly displayName = NAME;
  readonly supportsCancellation = false;
  readonly fields = [
    { key: 'userId', label: 'User ID', secret: false, required: true },
    { key: 'apiKey', label: 'API key', secret: true, required: true },
    { key: 'apiSecret', label: 'API secret', secret: true, required: true },
  ] as const satisfies readonly CourierField[];
  readonly connectHelp = 'Ask eCourier merchant support for API access: they give you the user ID, API key and API secret.';
  readonly locationSteps = [
    { key: 'package', label: 'eCourier package' },
    { key: 'city', label: 'City' },
    { key: 'thana', label: 'Thana' },
    { key: 'postcode', label: 'Post code' },
    { key: 'area', label: 'Area' },
  ];
  private readonly baseUrl: string;

  constructor(
    private readonly http: CourierHttp,
    config: ConfigService,
  ) {
    this.baseUrl = (config.get<string>('ECOURIER_BASE_URL') || ECOURIER_DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  async validateCredentials(credentials: CourierCredentials): Promise<void> {
    const res = await this.call('/packages', credentials, {});
    if (res.status !== 200 || !Array.isArray(res.body)) throw courierErrors.authFailed(NAME);
  }

  async locationOptions(credentials: CourierCredentials, step: string, picked: Record<string, string>): Promise<CourierOption[]> {
    if (step === 'package') {
      const res = await this.call('/packages', credentials, {});
      if (res.status !== 200 || !Array.isArray(res.body)) throw courierErrors.badResponse(NAME);
      return res.body.flatMap((item) => {
        const pkg = item as { package_code?: unknown; package_name?: unknown; coverage?: unknown; shipping_charge?: unknown };
        if (typeof pkg.package_code !== 'string') return [];
        const details = [pkg.coverage, pkg.shipping_charge !== undefined ? `৳${String(pkg.shipping_charge)}` : null].filter(Boolean).join(', ');
        return [{ value: pkg.package_code, label: `${String(pkg.package_name ?? pkg.package_code)}${details ? ` — ${details}` : ''}` }];
      });
    }
    const [path, body] =
      step === 'city'
        ? ['/city-list', {}]
        : step === 'thana' && picked.city
          ? ['/thana-list', { city: picked.city }]
          : step === 'postcode' && picked.city && picked.thana
            ? ['/postcode-list', { city: picked.city, thana: picked.thana }]
            : step === 'area' && picked.postcode
              ? ['/area-list', { postcode: picked.postcode }]
              : [null, null];
    if (!path) return [];
    const res = await this.call(path, credentials, body);
    if (res.status === 400) return [];
    if (res.status !== 200) throw courierErrors.badResponse(NAME);
    return namedValues(res.body);
  }

  async createShipment(credentials: CourierCredentials, input: CourierShipmentInput): Promise<CourierBooking> {
    const place = input.location ?? {};
    const missing = this.locationSteps.find((step) => !place[step.key]?.trim());
    if (missing) throw courierErrors.validation(NAME, `choose the ${missing.label.toLowerCase()}`, [missing.key]);
    const cod = wholeTakaCod(NAME, input.codAmount);
    const res = await this.call('/order-place', credentials, {
      recipient_name: input.recipientName.slice(0, 250),
      recipient_mobile: input.recipientPhone,
      recipient_city: place.city!.slice(0, 40),
      recipient_thana: place.thana!.slice(0, 40),
      recipient_area: place.area!.slice(0, 40),
      // eCourier allows 40 characters here; city, thana and area are sent separately.
      recipient_address: (input.addressLine || input.recipientAddress).slice(0, 40),
      recipient_zip: place.postcode,
      package_code: place.package,
      product_price: cod,
      // Cash on delivery when there is cash to collect; otherwise the order was paid online.
      payment_method: cod > 0 ? 'COD' : 'MPAY',
      parcel_type: 'BOX',
      number_of_item: Math.max(1, input.itemCount ?? 1),
      actual_product_price: wholeTaka(input.orderTotal),
      ...(input.reference.length <= PRODUCT_ID_MAX ? { product_id: input.reference } : {}),
      comments: input.note?.slice(0, 255) ?? '',
      special_instruction: input.itemDescription?.slice(0, 255) ?? '',
    });
    const body = res.body as { response_code?: unknown; ID?: unknown; errors?: unknown } | null;
    if (res.status === 200 && Number(body?.response_code) === 200 && typeof body?.ID === 'string' && body.ID.trim()) {
      return { providerShipmentId: body.ID, trackingCode: body.ID, providerStatus: 'Initiated' };
    }
    throw this.failure(res);
  }

  async getShipmentStatus(credentials: CourierCredentials, ref: CourierShipmentRef): Promise<CourierStatusResult> {
    const ecr = ref.providerShipmentId ?? ref.trackingCode;
    const productId = ref.reference && ref.reference.length <= PRODUCT_ID_MAX ? ref.reference : null;
    if (!ecr && !productId) throw courierErrors.notFound(NAME);
    const res = await this.call('/track', credentials, ecr ? { ecr } : { product_id: productId });
    const data = (res.body as { query_data?: unknown } | null)?.query_data;
    if (res.status === 200 && Array.isArray(data)) {
      const history = (data[0] as { status?: unknown } | undefined)?.status;
      const latest = Array.isArray(history) && Array.isArray(history[0]) ? history[0][0] : null;
      if (typeof latest === 'string' && latest.trim()) return this.describeStatus(latest);
    }
    if (res.status === 200) throw courierErrors.notFound(NAME);
    throw this.failure(res);
  }

  describeStatus(providerStatus: string): CourierStatusResult {
    const raw = providerStatus.trim();
    const key = statusKey(raw);
    return { providerStatus: raw, ...(ECOURIER_STATUSES[key] ?? unknownStatus(NAME, key)) };
  }

  trackingUrl(): string | null {
    return null;
  }

  private call(path: string, credentials: CourierCredentials, body: unknown) {
    return courierCall(this.http, NAME, {
      method: 'POST',
      url: `${this.baseUrl}${path}`,
      headers: {
        'USER-ID': requireCredential(credentials, 'userId', NAME),
        'API-KEY': requireCredential(credentials, 'apiKey', NAME),
        'API-SECRET': requireCredential(credentials, 'apiSecret', NAME),
      },
      body,
    });
  }

  private failure(res: CourierHttpResponse) {
    const body = res.body as { errors?: unknown; message?: unknown } | null;
    if (res.status === 400 || res.status === 422 || (res.status === 200 && body?.errors)) {
      // eCourier lists a generic "Invalid Request" first, then the actual reason.
      const errors = Array.isArray(body?.errors) ? body.errors.filter((e) => e !== 'Invalid Request') : body?.errors;
      return courierErrors.validation(NAME, firstMessage(errors) ?? firstMessage(body?.message) ?? 'the parcel details were rejected', []);
    }
    return courierErrors.badResponse(NAME);
  }
}

/** `[{name, value}]` lists, bare or wrapped as `{success, message: [...]}`. */
function namedValues(body: unknown): CourierOption[] {
  const list = Array.isArray(body) ? body : Array.isArray((body as { message?: unknown } | null)?.message) ? ((body as { message: unknown[] }).message) : [];
  return list.flatMap((item) => {
    const entry = item as { name?: unknown; value?: unknown };
    const value = typeof entry.value === 'string' || typeof entry.value === 'number' ? String(entry.value) : null;
    if (!value) return [];
    return [{ value, label: typeof entry.name === 'string' ? entry.name : value }];
  });
}
