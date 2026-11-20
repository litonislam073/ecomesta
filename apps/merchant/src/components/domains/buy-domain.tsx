'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  DomainOrder,
  DomainOrderStatus,
  DomainRegistrant,
  DomainSearchResponse,
  DomainSearchResult,
  ManualPaymentAccount,
  RegisteredDomainItem,
  StoreDomainSales,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { formatBdt } from '@ecomesta/utils';
import { ManualPaymentPanel } from '@/components/billing/manual-payment';
import { PaymentDialog } from '@/components/billing/payment-dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { humanApiError } from '@/lib/catalog-utils';

const STATUS_LABELS: Record<DomainOrderStatus, { label: string; className: string }> = {
  PENDING: { label: 'Waiting for payment check', className: 'bg-[#fff6e0] text-[#8a5a00]' },
  PROCESSING: { label: 'Registering', className: 'bg-[#eaf1fa] text-[#0f54a6]' },
  FAILED: { label: 'In progress', className: 'bg-[#eaf1fa] text-[#0f54a6]' },
  COMPLETED: { label: 'Done', className: 'bg-[#e7f6ee] text-[#1f7a4d]' },
  REJECTED: { label: 'Payment rejected', className: 'bg-[#fdf3ee] text-[#a3441f]' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

type Checkout =
  | { kind: 'register'; domain: string; perYear: number; renewBdt: number | null }
  | { kind: 'renew'; domain: RegisteredDomainItem; perYear: number };

/**
 * Buy a new domain through Ecomesta, renew the ones bought here and follow
 * their orders. Paid by mobile wallet; our team registers the domain in the
 * merchant's name and connects it to the store after checking the payment.
 */
export function BuyDomain({ storeId, canBuy, onConnected }: { storeId: string; canBuy: boolean; onConnected: () => void }) {
  const { pushToast } = useToast();
  const [sales, setSales] = useState<StoreDomainSales | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<DomainSearchResponse | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const completedRef = useRef<number | null>(null);
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ success: true; data: StoreDomainSales }>(`/stores/${storeId}/domain-sales`);
      setSales(result.data);
      const completed = result.data.orders.filter((o) => o.status === 'COMPLETED').length;
      if (completedRef.current !== null && completed > completedRef.current) onConnectedRef.current();
      completedRef.current = completed;
    } catch {
      setSales(null);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = useCallback(async (value: string) => {
    const q = value.trim();
    if (q.length < 2) {
      setSearchError('Type at least 2 letters');
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const result = await api.get<{ success: true; data: DomainSearchResponse }>(
        `/public/domains/search?q=${encodeURIComponent(q)}`,
      );
      setResults(result.data);
    } catch (err) {
      setResults(null);
      setSearchError(humanApiError(err, 'Could not search right now. Please try again.'));
    } finally {
      setSearching(false);
    }
  }, []);

  // Coming from the website's domain search: /dashboard/domains?buy=amarshop.com
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('buy');
    if (wanted) {
      setQuery(wanted);
      void search(wanted);
    }
  }, [search]);

  if (sales && !sales.enabled && sales.domains.length === 0) return null;

  const openOrders = (sales?.orders ?? []).filter((o) => o.status !== 'COMPLETED' || Date.now() - new Date(o.createdAt).getTime() < 7 * 86_400_000);

  return (
    <section aria-labelledby="buy-domain-heading" className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div>
        <h2 id="buy-domain-heading" className="text-base font-semibold">
          Buy a domain
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Search a name, pay with bKash, Nagad, Rocket or Upay. We register it in your name and connect it to your store — no DNS
          setup needed.
        </p>
      </div>

      {sales?.enabled !== false ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void search(query);
          }}
        >
          <label className="min-w-[16rem] flex-1 space-y-1 text-sm">
            <span>Domain name</span>
            <Input
              name="domain-search"
              value={query}
              placeholder="amarshop or amarshop.com"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </Button>
        </form>
      ) : null}
      {searchError ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {searchError}
        </p>
      ) : null}

      {results ? (
        <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]" aria-label="Search results">
          {results.results.map((r) => (
            <SearchRow
              key={r.domain}
              result={r}
              canBuy={canBuy}
              onBuy={() => setCheckout({ kind: 'register', domain: r.domain, perYear: r.priceBdt!, renewBdt: r.renewBdt })}
            />
          ))}
        </ul>
      ) : null}

      {sales && sales.domains.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Your domains</h3>
          <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
            {sales.domains.map((d) => {
              const left = daysLeft(d.expiresAt);
              const renewing = sales.orders.some((o) => o.kind === 'RENEW' && o.domain === d.name && ['PENDING', 'PROCESSING', 'FAILED'].includes(o.status));
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-mono font-medium">{d.name}</p>
                    <p className={`text-xs ${left <= 30 ? 'text-[var(--color-danger)]' : 'text-[var(--color-muted)]'}`}>
                      {left > 0 ? `Expires ${formatDate(d.expiresAt)} · ${left} days left` : `Expired on ${formatDate(d.expiresAt)}`}
                    </p>
                  </div>
                  {renewing ? (
                    <span className="text-xs text-[var(--color-muted)]">Renewal waiting for review</span>
                  ) : canBuy && d.renewBdt ? (
                    <Button variant="secondary" onClick={() => setCheckout({ kind: 'renew', domain: d, perYear: d.renewBdt! })}>
                      Renew · {formatBdt(d.renewBdt)}/year
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {openOrders.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Domain orders</h3>
          <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
            {openOrders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        </div>
      ) : null}

      {checkout ? (
        <DomainCheckoutDialog
          storeId={storeId}
          checkout={checkout}
          maxYears={results?.maxYears ?? sales?.maxYears ?? 5}
          onClose={() => setCheckout(null)}
          onSubmitted={() => {
            setCheckout(null);
            setResults(null);
            pushToast('Payment submitted. We will register the domain once it is confirmed.', 'success');
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

function SearchRow({ result, canBuy, onBuy }: { result: DomainSearchResult; canBuy: boolean; onBuy: () => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
      <div>
        <p className="font-mono font-medium">{result.domain}</p>
        <p className="text-xs text-[var(--color-muted)]">
          {result.error
            ? 'Could not check right now'
            : result.available
              ? `Available${result.renewBdt ? ` · renews at ${formatBdt(result.renewBdt)}/year` : ''}`
              : result.premium
                ? 'Premium name — not sold here'
                : 'Already taken'}
        </p>
      </div>
      {result.available && result.priceBdt ? (
        <div className="flex items-center gap-3">
          <span className="font-semibold">{formatBdt(result.priceBdt)}/year</span>
          {canBuy ? <Button onClick={onBuy}>Buy</Button> : null}
        </div>
      ) : null}
    </li>
  );
}

function OrderRow({ order }: { order: DomainOrder }) {
  const status = STATUS_LABELS[order.status];
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
      <div>
        <p className="font-mono font-medium">
          {order.domain}{' '}
          <span className="font-sans text-xs font-normal text-[var(--color-muted)]">
            {order.kind === 'RENEW' ? 'Renewal' : 'New'} · {order.years} {order.years === 1 ? 'year' : 'years'} · {formatBdt(Number(order.amount))}
          </span>
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          {formatDate(order.createdAt)} · Trx {order.transactionId}
          {order.status === 'REJECTED' && order.rejectionReason ? ` · ${order.rejectionReason}` : ''}
        </p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
    </li>
  );
}

const EMPTY_REGISTRANT: DomainRegistrant = { name: '', email: '', phone: '', address: '', city: '', postcode: '' };

function DomainCheckoutDialog({
  storeId,
  checkout,
  maxYears,
  onClose,
  onSubmitted,
}: {
  storeId: string;
  checkout: Checkout;
  maxYears: number;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { user } = useAuth();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [years, setYears] = useState(1);
  const [step, setStep] = useState<'details' | 'pay'>(checkout.kind === 'renew' ? 'pay' : 'details');
  const [registrant, setRegistrant] = useState<DomainRegistrant>(() => ({
    ...EMPTY_REGISTRANT,
    name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    email: user?.email ?? '',
  }));
  const [formError, setFormError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<ManualPaymentAccount[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
    let cancelled = false;
    api
      .get<{ success: true; data: ManualPaymentAccount[] }>('/billing/payment-accounts')
      .then((r) => !cancelled && setAccounts(r.data))
      .catch((err: unknown) => !cancelled && setAccountsError(humanApiError(err, 'Could not load the payment numbers')));
    return () => {
      cancelled = true;
    };
  }, []);

  const name = checkout.kind === 'register' ? checkout.domain : checkout.domain.name;
  const amount = checkout.perYear * years;
  const field = (key: keyof DomainRegistrant, label: string, props: { type?: string; placeholder?: string; autoComplete?: string } = {}) => (
    <label className="space-y-1 text-sm">
      <span>{label}</span>
      <Input
        name={`registrant-${key}`}
        value={registrant[key] ?? ''}
        required
        {...props}
        onChange={(event) => setRegistrant((prev) => ({ ...prev, [key]: event.target.value }))}
      />
    </label>
  );

  function continueToPay(event: FormEvent) {
    event.preventDefault();
    const missing = (Object.keys(EMPTY_REGISTRANT) as (keyof DomainRegistrant)[]).filter((k) => !String(registrant[k] ?? '').trim());
    if (missing.length > 0) {
      setFormError('Please fill in every field. The registry needs these details.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(registrant.email)) {
      setFormError('Enter a valid email address.');
      return;
    }
    setFormError(null);
    setStep('pay');
  }

  return (
    <PaymentDialog
      active
      title={checkout.kind === 'register' ? `Buy ${name}` : `Renew ${name}`}
      subtitle={
        checkout.kind === 'register'
          ? 'Registered in your name. We connect it to your store as soon as our team confirms the payment.'
          : `Currently expires ${formatDate(checkout.domain.expiresAt)}. The new period is added on top.`
      }
      headingRef={headingRef}
      onClose={onClose}
    >
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Period</span>
          <select
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            value={years}
            onChange={(event) => setYears(Number(event.target.value))}
          >
            {Array.from({ length: maxYears }, (_, i) => i + 1).map((y) => (
              <option key={y} value={y}>
                {y} {y === 1 ? 'year' : 'years'} · {formatBdt(checkout.perYear * y)}
              </option>
            ))}
          </select>
        </label>

        {step === 'details' ? (
          <form className="space-y-3" onSubmit={continueToPay} noValidate>
            <p className="text-sm font-medium">Owner details (registered with the domain)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {field('name', 'Full name', { autoComplete: 'name' })}
              {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
              {field('phone', 'Mobile number', { type: 'tel', placeholder: '01712345678', autoComplete: 'tel' })}
              {field('city', 'City', { placeholder: 'Dhaka', autoComplete: 'address-level2' })}
              {field('address', 'Address', { placeholder: 'House, road, area', autoComplete: 'street-address' })}
              {field('postcode', 'Postcode', { placeholder: '1207', autoComplete: 'postal-code' })}
            </div>
            {formError ? (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {formError}
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              Continue to payment · {formatBdt(amount)}
            </Button>
          </form>
        ) : accountsError ? (
          <p role="alert" className="rounded-lg border border-[#f1c9b8] bg-[#fdf3ee] px-3 py-2 text-sm text-[#a3441f]">
            {accountsError}
          </p>
        ) : accounts === null ? (
          <p className="py-6 text-center text-sm text-[var(--color-muted)]">Loading payment options…</p>
        ) : accounts.length === 0 ? (
          <p className="rounded-lg bg-[#f6faf8] px-3 py-2 text-sm">Wallet payments are not available right now. Please contact Ecomesta support.</p>
        ) : (
          <>
            {checkout.kind === 'register' ? (
              <button type="button" className="text-sm text-[var(--color-accent)] underline" onClick={() => setStep('details')}>
                ← Edit owner details
              </button>
            ) : null}
            <ManualPaymentPanel
              key={years}
              variant="compact"
              accounts={accounts}
              token={null}
              trialEndsAt={null}
              item={{
                name,
                detail: `${checkout.kind === 'register' ? 'Domain registration' : 'Domain renewal'} · ${years} ${years === 1 ? 'year' : 'years'}`,
                amount,
              }}
              note="Our team checks every payment, then registers the domain and connects it to your store."
              submitLabel={(price, wallet) => `Pay ${price} with ${wallet}`}
              onPay={async (payment) => {
                const wallet = { method: payment.method, senderNumber: payment.senderNumber, transactionId: payment.transactionId };
                try {
                  if (checkout.kind === 'register') {
                    await api.post(`/stores/${storeId}/domain-sales/orders`, { domain: name, years, registrant, ...wallet });
                  } else {
                    await api.post(`/stores/${storeId}/domain-sales/${checkout.domain.id}/renew`, { years, ...wallet });
                  }
                  onSubmitted();
                } catch (err) {
                  throw new Error(humanApiError(err, 'Could not submit your payment. Please try again.'));
                }
              }}
            />
          </>
        )}
      </div>
    </PaymentDialog>
  );
}
