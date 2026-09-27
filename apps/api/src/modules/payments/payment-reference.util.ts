import { randomBytes } from 'node:crypto';

/** Opaque payment attempt reference — never reuse order number or UUID. */
export function generatePaymentInternalReference(): string {
  return `pay_${randomBytes(18).toString('base64url')}`;
}
