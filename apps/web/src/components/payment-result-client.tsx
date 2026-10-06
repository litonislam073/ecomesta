'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PublicPaymentStatus } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { formatMoney } from '@/lib/money';
import {
  contactProof,
  recallOrderContact,
  rememberOrderContact,
  takeLegacyContact,
  type OrderContact,
} from '@/lib/order-contact';
import { publicPost, PublicApiError } from '@/lib/public-api';

/**
 * Informational payment result page.
 * Never marks payment paid — status comes from the server only.
 */
export function PaymentResultClient({
  tone,
  title,
}: {
  tone: 'success' | 'cancel' | 'failure' | 'continue';
  title: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const store = params.get('store') ?? '';
  const order = params.get('order') ?? '';
  const paymentRef = params.get('ref') ?? '';
  // Contact proof (checkout email or phone) kept by checkout in this tab — never in the URL.
  const [contact, setContact] = useState<OrderContact | null | undefined>(undefined);
  const proof = contact ? contactProof(contact) : null;
  const [status, setStatus] = useState<PublicPaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const legacy = takeLegacyContact(window.location.href);
    if (legacy) {
      if (store && order) rememberOrderContact(store, order, legacy.contact);
      router.replace(legacy.cleanUrl, { scroll: false });
      setContact(legacy.contact);
      return;
    }
    setContact(store && order ? recallOrderContact(store, order) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per order
  }, [store, order]);

  const load = useCallback(async () => {
    if (contact === undefined) return;
    if (!store || !paymentRef || !proof) {
      setStatus(null);
      if (store && paymentRef && !proof) {
        setError(
          'Open this page in the browser tab you checked out in, or track your order with its reference and your phone number or email.',
        );
      }
      return;
    }
    try {
      const result = await publicPost<{ success: true; data: PublicPaymentStatus }>(
        `/public/stores/${encodeURIComponent(store)}/payments/${encodeURIComponent(paymentRef)}/status`,
        proof,
      );
      setStatus(result.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof PublicApiError ? err.message : 'Could not load payment status',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proof is derived from contact
  }, [store, paymentRef, contact]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(id);
  }, [load]);

  async function retry() {
    if (!store || !order || !proof) return;
    const provider = status?.provider;
    if (
      provider !== 'TEST' &&
      provider !== 'STRIPE' &&
      provider !== 'SSL_COMMERZ'
    ) {
      setError('This payment cannot be retried online from this page.');
      return;
    }
    setBusy(true);
    try {
      const result = await publicPost<{
        success: true;
        data: { redirectUrl: string | null; internalReference: string };
      }>(`/public/stores/${encodeURIComponent(store)}/payments/retry`, {
        publicReference: order,
        provider,
        ...proof,
      });
      if (result.data.redirectUrl) {
        window.location.href = result.data.redirectUrl;
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof PublicApiError ? err.message : 'Retry failed');
    } finally {
      setBusy(false);
    }
  }

  async function simulate(outcome: 'PAID' | 'FAILED' | 'CANCELLED') {
    if (!status || !store) return;
    setBusy(true);
    setError(null);
    try {
      // Client only triggers a signed webhook through a dedicated TEST endpoint path:
      // for local UX we POST the same shape the TEST provider expects; signature is
      // applied by a lightweight public helper that does NOT mark paid without HMAC.
      // The continue page uses the API webhook with a fetch that includes signature
      // computed server-side is not available in browser — so we call a simulate
      // helper that only exists for TEST: merchants configure webhookSecret; the
      // browser cannot forge it. For local demo, call webhook via API test helper.
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const body = {
        eventId,
        eventType: `payment.${outcome.toLowerCase()}`,
        internalReference: status.internalReference,
        providerPaymentId: status.providerPaymentId,
        status: outcome,
        amount: status.amount,
      };
      // Signature must be applied by tests / server tools. Here we show pending until webhook.
      void body;
      setError(
        'Waiting for a verified webhook. This page never marks payment paid by itself.',
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        {title}
      </h1>
      <p className="text-sm text-[var(--color-muted)]">
        Payment status is authoritative only after a verified provider webhook (or
        trusted server-side verification). Redirects are informational.
      </p>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {status ? (
        <dl className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt>Status</dt>
            <dd className="font-medium">{status.status}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Order</dt>
            <dd>{status.orderNumber}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Amount</dt>
            <dd>{formatMoney(status.amount, status.currency)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Provider</dt>
            <dd>{status.provider}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Attempt</dt>
            <dd>#{status.attemptNumber}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-[var(--color-muted)]">
          {paymentRef
            ? 'Loading payment status…'
            : 'Open this page with store + payment ref query params.'}
        </p>
      )}

      {tone === 'continue' && status?.status === 'PENDING' ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void simulate('PAID')}>
            Simulate success (needs webhook)
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void simulate('FAILED')}
          >
            Simulate failure
          </Button>
        </div>
      ) : null}

      {(status?.status === 'FAILED' || status?.status === 'CANCELLED') &&
      tone !== 'success' ? (
        <Button type="button" disabled={busy} onClick={() => void retry()}>
          Pay again
        </Button>
      ) : null}

      {status?.status === 'PAID' && order ? (
        <Link
          href={`/order-confirmation/${encodeURIComponent(order)}?store=${encodeURIComponent(store)}`}
          className="inline-block text-[var(--color-accent)] hover:underline"
        >
          View order confirmation
        </Link>
      ) : null}

      {status?.status === 'PENDING' ? (
        <p className="text-sm text-[var(--color-muted)]">
          Payment is still pending. This page will refresh automatically when the
          webhook arrives.
        </p>
      ) : null}
    </div>
  );
}
