import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * The shopper comes back from Stripe / SSLCommerz to these URLs. They must
 * carry exactly what the result page needs to read the payment status — the
 * store, the order's public reference and this attempt's opaque payment
 * reference — and nothing else: no email, phone, database IDs or secrets.
 */
export function expectSafeReturnUrl(
  url: string,
  expected: {
    path: '/payment/success' | '/payment/cancel' | '/payment/failure';
    storeSlug: string;
    publicReference: string;
    internalReference: string;
    forbidden: string[];
  },
) {
  const parsed = new URL(url);
  expect(parsed.pathname).toBe(expected.path);
  expect([...parsed.searchParams.keys()].sort()).toEqual(['order', 'ref', 'store']);
  expect(parsed.searchParams.get('store')).toBe(expected.storeSlug);
  expect(parsed.searchParams.get('order')).toBe(expected.publicReference);
  expect(parsed.searchParams.get('ref')).toBe(expected.internalReference);
  expect(expected.internalReference).toMatch(/^pay_[A-Za-z0-9_-]{24}$/);
  for (const value of expected.forbidden) {
    expect(url).not.toContain(value);
    expect(url).not.toContain(encodeURIComponent(value));
  }
}

/** What `/payment/success` does with the URL's `ref`: POST the status lookup with the tab's contact proof. */
export function paymentStatusFromReturnUrl(
  app: INestApplication,
  url: string,
  proof: { email?: string; phone?: string },
  storeSlug = new URL(url).searchParams.get('store')!,
) {
  const ref = new URL(url).searchParams.get('ref')!;
  return request(app.getHttpServer())
    .post(`/api/v1/public/stores/${storeSlug}/payments/${encodeURIComponent(ref)}/status`)
    .send(proof);
}
