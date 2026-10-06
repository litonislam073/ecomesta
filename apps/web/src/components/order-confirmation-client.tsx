'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicOrderConfirmationDetail } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { OrderTrackingView } from '@/components/order-tracking-view';
import {
  lookupPublicOrder,
  parseContactInput,
  recallOrderContact,
  rememberOrderContact,
  takeLegacyContact,
  type OrderContact,
} from '@/lib/order-contact';
import { PublicApiError } from '@/lib/public-api';

type State =
  | { kind: 'loading' }
  | { kind: 'verify'; error: string | null }
  | { kind: 'ready'; order: PublicOrderConfirmationDetail; contact: OrderContact };

const NOT_FOUND = 'We could not find this order with that phone number or email.';

/**
 * The order is loaded in the browser with the contact proof checkout kept in
 * this tab, so the URL never carries the customer's phone or email. Without
 * that proof (another browser, a shared link) the visitor must enter it and
 * the API checks it — a wrong one gets the same "not found" as a bad reference.
 */
export function OrderConfirmationClient({
  storeSlug,
  storeName,
  reference,
}: {
  storeSlug: string;
  storeName: string;
  reference: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [contactInput, setContactInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(contact: OrderContact): Promise<boolean> {
    try {
      const order = await lookupPublicOrder(storeSlug, reference, contact);
      rememberOrderContact(storeSlug, reference, contact);
      setState({ kind: 'ready', order, contact });
      return true;
    } catch (err) {
      const notFound = err instanceof PublicApiError && (err.status === 404 || err.status === 400);
      setState({
        kind: 'verify',
        error: notFound ? NOT_FOUND : 'Unable to load this order right now. Try again shortly.',
      });
      return false;
    }
  }

  useEffect(() => {
    // Old links carried the contact in the query: use it once, then drop it from the URL.
    const legacy = takeLegacyContact(window.location.href);
    if (legacy) router.replace(legacy.cleanUrl, { scroll: false });
    const contact = legacy?.contact ?? recallOrderContact(storeSlug, reference);
    if (contact) void load(contact);
    else setState({ kind: 'verify', error: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per order
  }, [storeSlug, reference]);

  async function onVerify(event: FormEvent) {
    event.preventDefault();
    const contact = parseContactInput(contactInput);
    if (!contact) {
      setState({ kind: 'verify', error: 'Enter the phone number or email used at checkout.' });
      return;
    }
    setBusy(true);
    await load(contact);
    setBusy(false);
  }

  if (state.kind === 'loading') {
    return (
      <p role="status" className="text-center text-sm text-[var(--color-muted)]">
        Loading your order…
      </p>
    );
  }

  if (state.kind === 'verify') {
    return (
      <form
        onSubmit={onVerify}
        className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      >
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
            View your order
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Enter the phone number or email you used at checkout to see this order.
          </p>
        </div>
        <label className="block space-y-1 text-sm">
          <span>Phone or email</span>
          <input
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
            value={contactInput}
            onChange={(e) => setContactInput(e.target.value)}
            placeholder="01XXXXXXXXX or you@example.com"
            autoComplete="tel"
            aria-label="Checkout phone or email"
          />
        </label>
        {state.error ? (
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'View order'}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-8 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-muted)]">
          Thank you
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl tracking-tight">
          Order confirmed
        </h1>
        <p className="mt-3 text-[var(--color-muted)]">
          {storeName} received your order. Save your reference for tracking.
        </p>
      </div>
      <OrderTrackingView storeSlug={storeSlug} initial={state.order} contact={state.contact} />
    </div>
  );
}
