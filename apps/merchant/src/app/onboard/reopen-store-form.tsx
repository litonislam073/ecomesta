'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@ecomesta/ui';
import { Input } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useStoreContext } from '@/lib/store-context';
import { cleanStoreSlugInput, isValidStoreSlug, suggestStoreSlug } from '@/lib/store-slug';
import { storefrontPreviewUrl } from '@/lib/storefront-url';

export interface ReusableBusiness {
  name: string;
  planName: string | null;
  planActive: boolean;
  awaitingPayment: boolean;
}

/**
 * Shown instead of the sign-up form when the merchant's store was deleted: the
 * new store opens in the same business and keeps its plan, so there is no
 * payment step.
 */
export function ReopenStoreForm({ business }: { business: ReusableBusiness }) {
  const { reloadProfile } = useAuth();
  const { refreshStores } = useStoreContext();
  const [storeName, setStoreName] = useState('');
  const [slugInput, setSlugInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const slug = slugInput ?? suggestStoreSlug(storeName);
  const preview = storefrontPreviewUrl(slug || 'yourstore');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const finalSlug = slug.replace(/-+$/, '');
    if (storeName.trim().length < 2) {
      setError('Enter a store name of at least 2 characters.');
      return;
    }
    if (!isValidStoreSlug(finalSlug)) {
      setError('The store address needs 2–63 letters or numbers (a hyphen may join words).');
      return;
    }
    setBusy(true);
    try {
      await api.post('/onboarding/reopen-store', { storeName: storeName.trim(), storeSlug: finalSlug });
      try {
        await reloadProfile();
        await refreshStores();
        window.location.assign('/dashboard');
      } catch {
        window.location.assign('/dashboard');
      }
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 409) {
        setError('This store address is already taken. Try another one.');
      } else if (err instanceof ApiError && err.status < 500 && err.message) {
        setError(err.message);
      } else {
        setError('We could not create your store. Please try again.');
      }
    }
  }

  const plan = business.planName ? `${business.planName} plan` : 'plan';
  const planLine = business.planActive
    ? `Your ${plan} carries over, so there is nothing to pay.`
    : business.awaitingPayment
      ? `Your ${plan} payment is still being checked. The store goes live once it is confirmed.`
      : 'Your plan is not running right now. The store goes live once you renew it from Plan & billing.';

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-[0_1px_2px_rgba(2,40,87,0.05),0_12px_32px_-12px_rgba(2,40,87,0.16)] sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-accent)]">{business.name}</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">Open your new store</h1>
      <p className="mt-3 text-[var(--color-muted)]">
        Your previous store was removed. Open a new one for the same business. {planLine}
      </p>
      <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4" noValidate>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Store name</span>
          <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Amar Shop" autoFocus />
        </label>
        <div className="space-y-1 text-sm">
          <label className="block space-y-1">
            <span className="font-medium">Store address</span>
            <Input
              value={slug}
              aria-describedby="reopen-slug-preview"
              onChange={(e) => setSlugInput(cleanStoreSlugInput(e.target.value))}
              placeholder="amarshop"
            />
          </label>
          {preview ? (
            <p id="reopen-slug-preview" className="break-all text-xs text-[var(--color-muted)]">
              Your store will be at <span className="font-semibold text-[var(--color-ink)]">{preview}</span>
            </p>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Creating your store…' : 'Create store'}
        </Button>
      </form>
    </div>
  );
}
