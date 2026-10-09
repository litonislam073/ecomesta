import { HttpException, HttpStatus } from '@nestjs/common';
import { PublicServiceUnavailableException } from '../../common/filters/public-service-unavailable.exception';

/**
 * Errors from a courier call, already safe for the merchant: they never carry
 * credentials, request headers or raw provider bodies.
 *
 * `outcome` tells the booking flow whether the courier may have acted:
 * - `rejected` (4xx): it certainly did not (validation, credentials, rate limit)
 * - `uncertain` (503): it may have (timeout, network, 5xx, unreadable response)
 */
export interface CourierFailure {
  readonly code: string;
  readonly outcome: 'rejected' | 'uncertain';
  /** Field-level validation errors reported by the courier, when any. */
  readonly fields: string[];
}

/** The courier refused the request; nothing was created. */
export class CourierError extends HttpException implements CourierFailure {
  readonly outcome = 'rejected' as const;
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
    readonly fields: string[] = [],
  ) {
    super({ message, error: code }, status);
  }
}

/** The courier's answer was lost or unreadable; it may have acted. Shown to the merchant as a 503. */
export class CourierUnavailableError extends PublicServiceUnavailableException implements CourierFailure {
  readonly outcome = 'uncertain' as const;
  readonly fields: string[] = [];
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message, code);
  }
}

export function courierFailure(err: unknown): CourierFailure | null {
  return err instanceof CourierError || err instanceof CourierUnavailableError ? err : null;
}

export const courierErrors = {
  authFailed: (courier: string) =>
    new CourierError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'COURIER_AUTH_FAILED',
      `${courier} rejected the API credentials. Check them in Settings → Couriers.`,
    ),
  validation: (courier: string, detail: string, fields: string[]) =>
    new CourierError(HttpStatus.UNPROCESSABLE_ENTITY, 'COURIER_VALIDATION_FAILED', `${courier} could not accept this parcel: ${detail}`, fields),
  rateLimited: (courier: string) =>
    new CourierError(HttpStatus.TOO_MANY_REQUESTS, 'COURIER_RATE_LIMITED', `${courier} is receiving too many requests. Wait a minute and try again.`),
  notFound: (courier: string) =>
    new CourierError(HttpStatus.NOT_FOUND, 'COURIER_SHIPMENT_NOT_FOUND', `${courier} has no parcel with this tracking reference.`),
  unavailable: (courier: string) =>
    new CourierUnavailableError(
      'COURIER_UNAVAILABLE',
      `${courier} did not respond. Try again — retrying will not create a duplicate parcel.`,
    ),
  badResponse: (courier: string) =>
    new CourierUnavailableError(
      'COURIER_BAD_RESPONSE',
      `${courier} sent a response Ecomesta could not read. Try again — retrying will not create a duplicate parcel.`,
    ),
};
