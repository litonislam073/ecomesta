'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PublicOrderConfirmationDetail } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { OrderTrackingView } from '@/components/order-tracking-view';
import { publicGet, PublicApiError } from '@/lib/public-api';

export function TrackOrderForm({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reference, setReference] = useState(searchParams.get('ref') ?? '');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<PublicOrderConfirmationDetail | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setOrder(null);

    const ref = reference.trim();
    const mail = email.trim().toLowerCase();
    if (!ref || ref.length < 16) {
      setError('Enter the full order reference from your confirmation.');
      return;
    }
    if (!mail || !mail.includes('@')) {
      setError('Enter the email used at checkout.');
      return;
    }

    setBusy(true);
    try {
      const result = await publicGet<{
        success: true;
        data: PublicOrderConfirmationDetail;
      }>(
        `/public/stores/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(ref)}?email=${encodeURIComponent(mail)}`,
      );
      setOrder(result.data);
      router.replace(
        `/track-order?store=${encodeURIComponent(storeSlug)}&ref=${encodeURIComponent(ref)}`,
        { scroll: false },
      );
    } catch (err) {
      if (err instanceof PublicApiError && (err.status === 404 || err.status === 400)) {
        // Same message whether reference or email is wrong — no enumeration.
        setError('We could not find an order with that reference and email.');
      } else {
        setError('Unable to look up this order right now. Try again shortly.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
          Track your order
        </h1>
        <p className="mt-3 text-[var(--color-muted)]">
          Enter the order reference from your confirmation and the email used at
          checkout. No account required.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      >
        <label className="block space-y-1 text-sm">
          <span>Order reference</span>
          <input
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Order reference"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Email</span>
          <input
            type="email"
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Checkout email"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Looking up…' : 'Track order'}
        </Button>
      </form>

      {order ? (
        <OrderTrackingView
          storeSlug={storeSlug}
          initial={order}
          email={email.trim().toLowerCase()}
        />
      ) : null}
    </div>
  );
}
