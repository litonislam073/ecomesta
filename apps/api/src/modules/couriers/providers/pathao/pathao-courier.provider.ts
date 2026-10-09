import { createHash } from 'node:crypto';
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
  statusKey,
  unknownStatus,
  wholeTakaCod,
  type CourierHttpResponse,
} from '../../courier.http';

/** Pathao Courier merchant API ("aladdin"), live host. Sandbox: https://courier-api-sandbox.pathao.com */
export const PATHAO_DEFAULT_BASE_URL = 'https://api-hermes.pathao.com';
const NAME = 'Pathao';
/** Pathao `delivery_type`: 48 = normal delivery. `item_type`: 2 = parcel. */
const NORMAL_DELIVERY = 48;
const PARCEL = 2;

type PathaoBody = {
  code?: number;
  type?: string;
  message?: string;
  errors?: unknown;
  access_token?: string;
  expires_in?: number;
  data?: unknown;
};

/**
 * Pathao order statuses (Pathao merchant panel and webhook events). Mapping is
 * conservative: anything with no safe equivalent (hold, partial delivery,
 * exchange, unknown) maps to null and leaves the shipment unchanged.
 */
const PATHAO_STATUSES: Record<string, { status: ShipmentStatus | null; label: string }> = {
  pending: { status: ShipmentStatus.LABEL_CREATED, label: 'Booked, waiting for pickup' },
  'pickup requested': { status: ShipmentStatus.LABEL_CREATED, label: 'Pickup requested' },
  'assigned for pickup': { status: ShipmentStatus.LABEL_CREATED, label: 'Assigned for pickup' },
  picked: { status: ShipmentStatus.SHIPPED, label: 'Picked up by Pathao' },
  'pickup failed': { status: null, label: 'Pickup failed — check Pathao' },
  'pickup cancelled': { status: ShipmentStatus.CANCELLED, label: 'Pickup cancelled' },
  'at the sorting hub': { status: ShipmentStatus.IN_TRANSIT, label: 'At the sorting hub' },
  'in transit': { status: ShipmentStatus.IN_TRANSIT, label: 'In transit' },
  'received at last mile hub': { status: ShipmentStatus.IN_TRANSIT, label: 'At the delivery hub' },
  'assigned for delivery': { status: ShipmentStatus.IN_TRANSIT, label: 'Out for delivery' },
  delivered: { status: ShipmentStatus.DELIVERED, label: 'Delivered' },
  'partial delivery': { status: null, label: 'Partially delivered — review in Pathao' },
  return: { status: ShipmentStatus.RETURNED, label: 'Returned' },
  'paid return': { status: ShipmentStatus.RETURNED, label: 'Returned (paid return)' },
  'delivery failed': { status: null, label: 'Delivery attempt failed — check Pathao' },
  'on hold': { status: null, label: 'On hold at Pathao' },
  'payment invoice': { status: null, label: 'Payment invoice issued' },
  exchange: { status: null, label: 'Exchange — review in Pathao' },
};

/**
 * Pathao Courier merchant API:
 * - POST /aladdin/api/v1/issue-token {client_id, client_secret, username, password, grant_type: password}
 *   → {access_token, expires_in}; later calls send `Authorization: Bearer <token>`
 * - GET /aladdin/api/v1/stores → {data: {data: [{store_id, store_name}]}} (checks the account)
 * - POST /aladdin/api/v1/orders {store_id, merchant_order_id, recipient_*, delivery_type, item_type,
 *   item_quantity, item_weight, amount_to_collect, item_description, special_instruction}
 *   → {data: {consignment_id, merchant_order_id, order_status}}. City, zone and area are optional:
 *   Pathao reads them from the address.
 * - GET /aladdin/api/v1/orders/{consignment_id} → {data: {order_status}}
 */
@Injectable()
export class PathaoCourierProvider implements CourierProvider {
  readonly code = ShippingProvider.PATHAO;
  readonly displayName = NAME;
  readonly supportsCancellation = false;
  readonly fields = [
    { key: 'clientId', label: 'Client ID', secret: false, required: true },
    { key: 'clientSecret', label: 'Client secret', secret: true, required: true },
    { key: 'username', label: 'Pathao login email', secret: false, required: true, placeholder: 'you@example.com' },
    { key: 'password', label: 'Pathao login password', secret: true, required: true },
    {
      key: 'storeId',
      label: 'Pathao store ID',
      secret: false,
      required: false,
      hint: 'The Pathao store parcels are picked up from. Leave empty to use your first Pathao store.',
    },
  ] as const satisfies readonly CourierField[];
  readonly connectHelp =
    'In the Pathao merchant panel open Developers API → Merchant API Credentials for the client ID and secret, and use your Pathao login email and password.';
  readonly locationSteps = [];
  private readonly baseUrl: string;
  private readonly tokens = new Map<string, { token: string; expiresAt: number }>();

  constructor(
    private readonly http: CourierHttp,
    config: ConfigService,
  ) {
    this.baseUrl = (config.get<string>('PATHAO_BASE_URL') || PATHAO_DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  async validateCredentials(credentials: CourierCredentials): Promise<CourierCredentials> {
    this.tokens.delete(this.tokenKey(credentials));
    const res = await this.authed('GET', '/aladdin/api/v1/stores', credentials);
    const stores = storesOf(res.body);
    if (res.status !== 200 || !stores) throw courierErrors.authFailed(NAME);
    if (stores.length === 0) {
      throw courierErrors.validation(NAME, 'create a pickup store in your Pathao account first', ['storeId']);
    }
    const wanted = credentials.storeId?.trim();
    if (wanted) {
      if (!stores.some((store) => store.id === wanted)) {
        throw courierErrors.validation(NAME, `no store with ID ${wanted.slice(0, 20)} in this Pathao account`, ['storeId']);
      }
      return { ...credentials, storeId: wanted };
    }
    return { ...credentials, storeId: stores[0]!.id };
  }

  async createShipment(credentials: CourierCredentials, input: CourierShipmentInput): Promise<CourierBooking> {
    const storeId = Number(requireCredential(credentials, 'storeId', NAME));
    const weight = Math.min(10, Math.max(0.5, input.weightKg ?? 0.5));
    const res = await this.authed('POST', '/aladdin/api/v1/orders', credentials, {
      store_id: storeId,
      merchant_order_id: input.reference,
      recipient_name: input.recipientName.slice(0, 100),
      recipient_phone: input.recipientPhone,
      recipient_address: input.recipientAddress.slice(0, 220),
      delivery_type: NORMAL_DELIVERY,
      item_type: PARCEL,
      item_quantity: Math.max(1, input.itemCount ?? 1),
      item_weight: weight,
      amount_to_collect: wholeTakaCod(NAME, input.codAmount),
      item_description: input.itemDescription?.slice(0, 250) ?? '',
      special_instruction: input.note ?? '',
    });
    const data = objectOf((res.body as PathaoBody | null)?.data);
    if (res.status === 200 && data && data.consignment_id !== undefined && data.consignment_id !== null) {
      const id = String(data.consignment_id);
      return {
        providerShipmentId: id,
        trackingCode: id,
        providerStatus: typeof data.order_status === 'string' ? data.order_status : null,
      };
    }
    throw this.failure(res);
  }

  async getShipmentStatus(credentials: CourierCredentials, ref: CourierShipmentRef): Promise<CourierStatusResult> {
    const id = ref.providerShipmentId ?? ref.trackingCode;
    // Pathao looks parcels up by consignment ID only.
    if (!id) throw courierErrors.notFound(NAME);
    const res = await this.authed('GET', `/aladdin/api/v1/orders/${encodeURIComponent(id)}`, credentials);
    const data = objectOf((res.body as PathaoBody | null)?.data);
    const status = data?.order_status ?? data?.order_status_slug;
    if (res.status === 200 && typeof status === 'string' && status.trim()) return this.describeStatus(status);
    if (res.status === 404) throw courierErrors.notFound(NAME);
    throw this.failure(res);
  }

  describeStatus(providerStatus: string): CourierStatusResult {
    const raw = providerStatus.trim();
    const key = statusKey(raw);
    return { providerStatus: raw, ...(PATHAO_STATUSES[key] ?? unknownStatus(NAME, key)) };
  }

  trackingUrl(): string | null {
    return null;
  }

  private tokenKey(credentials: CourierCredentials): string {
    return createHash('sha256')
      .update([credentials.clientId, credentials.clientSecret, credentials.username, credentials.password].join('\u0000'))
      .digest('hex');
  }

  private async token(credentials: CourierCredentials): Promise<string> {
    const key = this.tokenKey(credentials);
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    const res = await courierCall(this.http, NAME, {
      method: 'POST',
      url: `${this.baseUrl}/aladdin/api/v1/issue-token`,
      body: {
        client_id: requireCredential(credentials, 'clientId', NAME),
        client_secret: requireCredential(credentials, 'clientSecret', NAME),
        username: requireCredential(credentials, 'username', NAME),
        password: requireCredential(credentials, 'password', NAME),
        grant_type: 'password',
      },
    });
    const body = res.body as PathaoBody | null;
    if (res.status !== 200 || typeof body?.access_token !== 'string' || !body.access_token) {
      throw courierErrors.authFailed(NAME);
    }
    const seconds = typeof body.expires_in === 'number' && body.expires_in > 120 ? body.expires_in : 3600;
    // Renew a minute early so a token never expires mid-request.
    this.tokens.set(key, { token: body.access_token, expiresAt: Date.now() + (seconds - 60) * 1000 });
    return body.access_token;
  }

  private async authed(method: 'GET' | 'POST', path: string, credentials: CourierCredentials, body?: unknown) {
    const token = await this.token(credentials);
    try {
      return await courierCall(this.http, NAME, {
        method,
        url: `${this.baseUrl}${path}`,
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
    } catch (err) {
      // A token revoked early: forget it so the next call asks for a new one.
      this.tokens.delete(this.tokenKey(credentials));
      throw err;
    }
  }

  private failure(res: CourierHttpResponse) {
    const body = res.body as PathaoBody | null;
    if (res.status === 400 || res.status === 422) {
      const fields = body?.errors && typeof body.errors === 'object' && !Array.isArray(body.errors) ? Object.keys(body.errors) : [];
      return courierErrors.validation(NAME, firstMessage(body?.errors) ?? firstMessage(body?.message) ?? 'the parcel details were rejected', fields);
    }
    return courierErrors.badResponse(NAME);
  }
}

function objectOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Store IDs from the store list (`data.data` paginated, or `data` as a plain list). */
function storesOf(body: unknown): { id: string }[] | null {
  const data = objectOf(body)?.data;
  const list = Array.isArray(data) ? data : Array.isArray(objectOf(data)?.data) ? (objectOf(data)!.data as unknown[]) : null;
  if (!list) return null;
  return list
    .map((item) => objectOf(item)?.store_id)
    .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
    .map((id) => ({ id: String(id) }));
}
