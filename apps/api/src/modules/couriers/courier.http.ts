import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CourierError, courierErrors } from './courier-errors';

export type CourierHttpResponse = { status: number; body: unknown };

/** Thrown when a courier could not be reached or did not answer in time. */
export class CourierTransportError extends Error {
  constructor(readonly kind: 'timeout' | 'network') {
    super(`Courier ${kind}`);
  }
}

const TIMEOUT_MS = 15_000;

/**
 * Thin JSON fetch wrapper shared by the courier providers. Injectable so tests
 * can replace the network. Never logs or rethrows request headers (they carry
 * the merchant's courier credentials) or bodies.
 */
@Injectable()
export class CourierHttp {
  async request(params: {
    method: 'GET' | 'POST';
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  }): Promise<CourierHttpResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(params.url, {
        method: params.method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...params.headers },
        body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
        signal: controller.signal,
      });
    } catch {
      throw new CourierTransportError(controller.signal.aborted ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text().catch(() => '');
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
    }
    return { status: res.status, body };
  }
}

/**
 * One courier call with the shared failure rules: transport problems and 5xx
 * may mean the courier acted (uncertain), 401/403 are bad credentials, 429 is
 * rate limiting. Other answers are returned for the provider to read.
 */
export async function courierCall(
  http: CourierHttp,
  courier: string,
  params: Parameters<CourierHttp['request']>[0],
): Promise<CourierHttpResponse> {
  let res: CourierHttpResponse;
  try {
    res = await http.request(params);
  } catch {
    throw courierErrors.unavailable(courier);
  }
  if (res.status === 401 || res.status === 403) throw courierErrors.authFailed(courier);
  if (res.status === 429) throw courierErrors.rateLimited(courier);
  if (res.status >= 500) throw courierErrors.unavailable(courier);
  return res;
}

/**
 * The cash-on-delivery amount as whole taka. Couriers collect whole taka, and
 * rounding would make the courier collect a different amount from the order
 * total, so a total with paisa is refused before anything is sent.
 */
export function wholeTakaCod(courier: string, codAmount: string): number {
  const amount = new Prisma.Decimal(codAmount);
  if (amount.isNegative() || !amount.isFinite()) throw new Error('COD amount must be a non-negative number');
  if (!amount.isInteger()) {
    throw new CourierError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'COURIER_COD_NOT_WHOLE_TAKA',
      `${courier} collects cash on delivery in whole taka only, and this order's total (BDT ${amount.toFixed(2)}) includes paisa. Ship this order manually instead.`,
    );
  }
  return amount.toNumber();
}

/** Whole taka for a value field (parcel value), rounded down; 0 when missing. */
export function wholeTaka(value: string | undefined): number {
  if (!value) return 0;
  const amount = new Prisma.Decimal(value);
  return amount.isFinite() && !amount.isNegative() ? amount.floor().toNumber() : 0;
}

/** A required credential, or an auth error naming the courier. */
export function requireCredential(credentials: Record<string, string>, key: string, courier: string): string {
  const value = credentials[key]?.trim();
  if (!value) throw courierErrors.authFailed(courier);
  return value;
}

/** First readable message in a courier error body (strings, arrays or field maps), trimmed. */
export function firstMessage(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() ? value.trim().slice(0, 200) : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstMessage(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = firstMessage(item);
      if (found) return found;
    }
  }
  return null;
}

/** Status with a fallback label for values the mapping does not know. */
export function unknownStatus(courier: string, raw: string): { status: null; label: string } {
  return { status: null, label: `Unrecognised ${courier} status "${raw.slice(0, 60)}"` };
}

/** Lowercase, single-spaced form of a courier status for table lookups. */
export function statusKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}
