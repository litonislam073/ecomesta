import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ShippingProvider } from '@prisma/client';
import { CourierError, courierErrors } from '../../courier-errors';
import type {
  CourierBooking,
  CourierCredentials,
  CourierProvider,
  CourierShipmentInput,
  CourierShipmentRef,
  CourierStatusResult,
} from '../../courier-provider';
import { SteadfastHttp, type SteadfastHttpResponse } from './steadfast.http';
import { mapSteadfastStatus } from './steadfast-status';

/** Official base URL (Steadfast's own packages and WordPress plugin use it). */
export const STEADFAST_DEFAULT_BASE_URL = 'https://portal.packzy.com/api/v1';
const NAME = 'Steadfast';

type SteadfastBody = {
  status?: number | string;
  message?: string;
  errors?: Record<string, unknown>;
  consignment?: { consignment_id?: number | string; tracking_code?: string; status?: string };
  delivery_status?: string;
};

/**
 * Steadfast Courier (packzy) merchant API:
 * - auth: `Api-Key` + `Secret-Key` headers
 * - POST /create_order {invoice, recipient_name, recipient_phone, recipient_address, cod_amount, note}
 *   → {status: 200, consignment: {consignment_id, tracking_code, status, …}}
 *   → {status: 400, errors: {field: [message]}} on validation errors
 * - GET /status_by_cid/{id} | /status_by_invoice/{invoice} | /status_by_trackingcode/{code}
 *   → {status: 200, delivery_status}
 * - GET /get_balance → {status: 200, current_balance} (used to check credentials)
 * Steadfast documents no cancellation endpoint and no public tracking URL.
 */
/**
 * `cod_amount` as Steadfast documents it: an integer number of taka.
 *
 * Ecomesta keeps money as Decimal(12,2), so an order total can carry paisa.
 * Rounding would make the courier collect a different amount from the order
 * total (overcharging the customer or under-collecting for the merchant), so a
 * total with paisa is refused before anything is sent. Whole-taka amounts are
 * sent exactly. Only this payload value is converted; nothing stored changes.
 */
export function steadfastCodAmount(codAmount: string): number {
  const amount = new Prisma.Decimal(codAmount);
  if (amount.isNegative() || !amount.isFinite()) throw new Error('COD amount must be a non-negative number');
  if (!amount.isInteger()) {
    throw new CourierError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'COURIER_COD_NOT_WHOLE_TAKA',
      `${NAME} collects cash on delivery in whole taka only, and this order's total (BDT ${amount.toFixed(2)}) includes paisa. Ship this order manually instead.`,
    );
  }
  return amount.toNumber();
}

@Injectable()
export class SteadfastCourierProvider implements CourierProvider {
  readonly code = ShippingProvider.STEADFAST;
  readonly displayName = NAME;
  readonly supportsCancellation = false;
  private readonly baseUrl: string;

  constructor(
    private readonly http: SteadfastHttp,
    config: ConfigService,
  ) {
    this.baseUrl = (config.get<string>('STEADFAST_BASE_URL') || STEADFAST_DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  async validateCredentials(credentials: CourierCredentials): Promise<void> {
    const res = await this.call('GET', '/get_balance', credentials);
    if (statusOf(res) !== 200) {
      // Steadfast answers bad credentials without a 200 status (its own plugin treats it as unauthorized).
      throw courierErrors.authFailed(NAME);
    }
  }

  async createShipment(credentials: CourierCredentials, input: CourierShipmentInput): Promise<CourierBooking> {
    const res = await this.call('POST', '/create_order', credentials, {
      invoice: input.reference,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone,
      recipient_address: input.recipientAddress,
      cod_amount: steadfastCodAmount(input.codAmount),
      note: input.note ?? '',
    });
    const body = res.body as SteadfastBody | null;
    if (statusOf(res) === 200 && body?.consignment) {
      const id = body.consignment.consignment_id;
      return {
        providerShipmentId: id === undefined || id === null || id === '' ? null : String(id),
        trackingCode: body.consignment.tracking_code ? String(body.consignment.tracking_code) : null,
        providerStatus: body.consignment.status ? String(body.consignment.status) : null,
      };
    }
    throw this.failure(res);
  }

  async getShipmentStatus(credentials: CourierCredentials, ref: CourierShipmentRef): Promise<CourierStatusResult> {
    const path = ref.providerShipmentId
      ? `/status_by_cid/${encodeURIComponent(ref.providerShipmentId)}`
      : ref.reference
        ? `/status_by_invoice/${encodeURIComponent(ref.reference)}`
        : ref.trackingCode
          ? `/status_by_trackingcode/${encodeURIComponent(ref.trackingCode)}`
          : null;
    if (!path) throw courierErrors.notFound(NAME);
    const res = await this.call('GET', path, credentials);
    const body = res.body as SteadfastBody | null;
    if (statusOf(res) === 200 && typeof body?.delivery_status === 'string' && body.delivery_status.trim()) {
      return this.describeStatus(body.delivery_status);
    }
    if (statusOf(res) === 404 || res.status === 404) throw courierErrors.notFound(NAME);
    throw this.failure(res);
  }

  describeStatus(providerStatus: string): CourierStatusResult {
    const raw = providerStatus.trim().toLowerCase();
    return { providerStatus: raw, ...mapSteadfastStatus(raw) };
  }

  trackingUrl(): string | null {
    return null;
  }

  private async call(
    method: 'GET' | 'POST',
    path: string,
    credentials: CourierCredentials,
    body?: Record<string, unknown>,
  ): Promise<SteadfastHttpResponse> {
    const apiKey = credentials.apiKey;
    const secretKey = credentials.secretKey;
    if (!apiKey || !secretKey) throw courierErrors.authFailed(NAME);
    let res: SteadfastHttpResponse;
    try {
      res = await this.http.request({ method, url: `${this.baseUrl}${path}`, apiKey, secretKey, body });
    } catch {
      // SteadfastTransportError (timeout / network) or anything unexpected: the courier may have acted.
      throw courierErrors.unavailable(NAME);
    }
    if (res.status === 401 || res.status === 403) throw courierErrors.authFailed(NAME);
    if (res.status === 429) throw courierErrors.rateLimited(NAME);
    if (res.status >= 500) throw courierErrors.unavailable(NAME);
    return res;
  }

  /** Maps a non-success Steadfast answer to a safe merchant error. */
  private failure(res: SteadfastHttpResponse) {
    const body = res.body as SteadfastBody | null;
    const status = statusOf(res);
    if (status === 401 || status === 403) return courierErrors.authFailed(NAME);
    if (status === 429) return courierErrors.rateLimited(NAME);
    if ((status === 400 || status === 422 || res.status === 422 || res.status === 400) && body?.errors && typeof body.errors === 'object') {
      const fields = Object.keys(body.errors);
      const first = Object.values(body.errors).flat()[0];
      const detail = typeof first === 'string' && first.trim() ? first.trim().slice(0, 200) : 'the parcel details were rejected';
      return courierErrors.validation(NAME, detail, fields);
    }
    return courierErrors.badResponse(NAME);
  }
}

/** Steadfast reports its own status code in the body; fall back to the HTTP status. */
function statusOf(res: SteadfastHttpResponse): number {
  const body = res.body as SteadfastBody | null;
  const raw = body?.status;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : res.status;
}
