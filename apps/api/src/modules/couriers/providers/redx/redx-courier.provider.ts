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

/** RedX open API, live host. Sandbox: https://sandbox.redx.com.bd/v1.0.0-beta */
export const REDX_DEFAULT_BASE_URL = 'https://openapi.redx.com.bd/v1.0.0-beta';
const NAME = 'RedX';

type RedxArea = { id: string; name: string; district: string | null };

/**
 * RedX parcel statuses. Conservative: holds, area changes and anything unknown
 * map to null and leave the shipment unchanged.
 */
const REDX_STATUSES: Record<string, { status: ShipmentStatus | null; label: string }> = {
  'pickup pending': { status: ShipmentStatus.LABEL_CREATED, label: 'Booked, waiting for pickup' },
  'pickup in progress': { status: ShipmentStatus.LABEL_CREATED, label: 'Pickup in progress' },
  'ready for delivery': { status: ShipmentStatus.IN_TRANSIT, label: 'At the delivery hub' },
  'delivery in progress': { status: ShipmentStatus.IN_TRANSIT, label: 'Out for delivery' },
  'in transit': { status: ShipmentStatus.IN_TRANSIT, label: 'In transit' },
  delivered: { status: ShipmentStatus.DELIVERED, label: 'Delivered' },
  'agent hold': { status: null, label: 'On hold at RedX' },
  'agent returning': { status: null, label: 'Being returned — check RedX' },
  'agent area change': { status: null, label: 'Delivery area changed by RedX' },
  returned: { status: ShipmentStatus.RETURNED, label: 'Returned' },
  cancelled: { status: ShipmentStatus.CANCELLED, label: 'Cancelled' },
};

/**
 * RedX open API (header `API-ACCESS-TOKEN: Bearer <token>`):
 * - GET /areas → {areas: [{id, name, post_code, district_name, division_name}]} (also checks the token)
 * - POST /parcel {customer_name, customer_phone, delivery_area, delivery_area_id, customer_address,
 *   merchant_invoice_id, cash_collection_amount, parcel_weight (grams), instruction, value,
 *   pickup_store_id?} → {tracking_id}
 * - GET /parcel/info/{tracking_id} → {parcel: {tracking_id, status}}
 * The delivery area is picked by the merchant when booking (a RedX area ID is required).
 */
@Injectable()
export class RedxCourierProvider implements CourierProvider {
  readonly code = ShippingProvider.REDX;
  readonly displayName = NAME;
  readonly supportsCancellation = false;
  readonly fields = [
    { key: 'accessToken', label: 'API access token', secret: true, required: true },
    {
      key: 'pickupStoreId',
      label: 'RedX pickup store ID',
      secret: false,
      required: false,
      hint: 'Optional. Leave empty to use the default pickup store of your RedX account.',
    },
  ] as const satisfies readonly CourierField[];
  readonly connectHelp = 'Ask RedX merchant support (or the RedX developer page) for your Open API access token.';
  readonly locationSteps = [{ key: 'area', label: 'RedX delivery area' }];
  private readonly baseUrl: string;

  constructor(
    private readonly http: CourierHttp,
    config: ConfigService,
  ) {
    this.baseUrl = (config.get<string>('REDX_BASE_URL') || REDX_DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  async validateCredentials(credentials: CourierCredentials): Promise<void> {
    const areas = await this.areas(credentials);
    if (!areas) throw courierErrors.authFailed(NAME);
  }

  async locationOptions(credentials: CourierCredentials, step: string): Promise<CourierOption[]> {
    if (step !== 'area') return [];
    const areas = await this.areas(credentials);
    if (!areas) throw courierErrors.badResponse(NAME);
    return areas
      .map((area) => ({ value: area.id, label: area.district ? `${area.name} (${area.district})` : area.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  async createShipment(credentials: CourierCredentials, input: CourierShipmentInput): Promise<CourierBooking> {
    const areaId = input.location?.area?.trim();
    if (!areaId) throw courierErrors.validation(NAME, 'choose the RedX delivery area', ['area']);
    // The area name comes from RedX's own list, never from the browser.
    const area = (await this.areas(credentials))?.find((item) => item.id === areaId);
    if (!area) throw courierErrors.validation(NAME, 'the chosen delivery area is not in your RedX area list', ['area']);
    const pickupStoreId = credentials.pickupStoreId?.trim();
    const res = await this.call('POST', '/parcel', credentials, {
      customer_name: input.recipientName.slice(0, 100),
      customer_phone: input.recipientPhone,
      delivery_area: area.name,
      delivery_area_id: Number(area.id),
      customer_address: input.recipientAddress.slice(0, 250),
      merchant_invoice_id: input.reference,
      cash_collection_amount: String(wholeTakaCod(NAME, input.codAmount)),
      parcel_weight: Math.round(Math.min(100, Math.max(0.1, input.weightKg ?? 0.5)) * 1000),
      instruction: input.note ?? '',
      value: wholeTaka(input.orderTotal),
      ...(pickupStoreId ? { pickup_store_id: Number(pickupStoreId) } : {}),
      parcel_details_json: [],
    });
    const body = res.body as { tracking_id?: string | number } | null;
    if ((res.status === 200 || res.status === 201) && body?.tracking_id !== undefined && body.tracking_id !== null && body.tracking_id !== '') {
      const id = String(body.tracking_id);
      return { providerShipmentId: id, trackingCode: id, providerStatus: null };
    }
    throw this.failure(res);
  }

  async getShipmentStatus(credentials: CourierCredentials, ref: CourierShipmentRef): Promise<CourierStatusResult> {
    const id = ref.providerShipmentId ?? ref.trackingCode;
    if (!id) throw courierErrors.notFound(NAME);
    const res = await this.call('GET', `/parcel/info/${encodeURIComponent(id)}`, credentials);
    const parcel = (res.body as { parcel?: { status?: unknown } } | null)?.parcel;
    if (res.status === 200 && typeof parcel?.status === 'string' && parcel.status.trim()) return this.describeStatus(parcel.status);
    if (res.status === 404) throw courierErrors.notFound(NAME);
    throw this.failure(res);
  }

  describeStatus(providerStatus: string): CourierStatusResult {
    const raw = providerStatus.trim();
    const key = statusKey(raw);
    return { providerStatus: raw, ...(REDX_STATUSES[key] ?? unknownStatus(NAME, key)) };
  }

  trackingUrl(): string | null {
    return null;
  }

  /** RedX's delivery areas, or null when the token is not accepted. */
  private async areas(credentials: CourierCredentials): Promise<RedxArea[] | null> {
    const res = await this.call('GET', '/areas', credentials);
    const list = (res.body as { areas?: unknown } | null)?.areas;
    if (res.status !== 200 || !Array.isArray(list)) return null;
    return list.flatMap((item) => {
      const area = item as { id?: unknown; name?: unknown; district_name?: unknown };
      if ((typeof area.id !== 'number' && typeof area.id !== 'string') || typeof area.name !== 'string') return [];
      return [{ id: String(area.id), name: area.name, district: typeof area.district_name === 'string' ? area.district_name : null }];
    });
  }

  private call(method: 'GET' | 'POST', path: string, credentials: CourierCredentials, body?: unknown) {
    return courierCall(this.http, NAME, {
      method,
      url: `${this.baseUrl}${path}`,
      headers: { 'API-ACCESS-TOKEN': `Bearer ${requireCredential(credentials, 'accessToken', NAME)}` },
      body,
    });
  }

  private failure(res: CourierHttpResponse) {
    const body = res.body as { message?: unknown; errors?: unknown; validation_errors?: unknown } | null;
    if (res.status === 400 || res.status === 422) {
      const detail = firstMessage(body?.validation_errors) ?? firstMessage(body?.errors) ?? firstMessage(body?.message);
      return courierErrors.validation(NAME, detail ?? 'the parcel details were rejected', []);
    }
    return courierErrors.badResponse(NAME);
  }
}
