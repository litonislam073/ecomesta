'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PublicPaymentStatus } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { formatMoney } from '@/lib/money';
import { contactProof, contactQuery } from '@/lib/order-contact';
import { publicGet, publicPost, PublicApiError } from '@/lib/public-api';

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
  const params = useSearchParams();
  const store = params.get('store') ?? '';
  const order = params.get('order') ?? '';
  const paymentRef = params.get('ref') ?? '';
  // Contact proof: the checkout email, or the phone when the order has no email.
  const email = params.get('email') ?? '';
  const phone = params.get('phone') ?? '';
  const proofQuery = contactQuery({ email, phone });
  const [status, setStatus] = useState<PublicPaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!store || !paymentRef || !proofQuery) {
      setStatus(null);
      if (store && paymentRef && !proofQuery) {
        setError('The checkout phone number or email is required to view payment status.');
      }
      return;
    }
    try {
      const qs = `?${proofQuery}`;
      const result = await publicGet<{ success: true; data: PublicPaymentStatus }>(
        `/public/stores/${encodeURIComponent(store)}/payments/${encodeURIComponent(paymentRef)}${qs}`,
      );
      setStatus(result.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof PublicApiError ? err.message : 'Could not load payment status',
      );
    }
  }, [store, paymentRef, proofQuery]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(id);
  }, [load]);

  async function retry() {
    if (!store || !order || !proofQuery) return;
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
        ...contactProof({ email, phone }),
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
