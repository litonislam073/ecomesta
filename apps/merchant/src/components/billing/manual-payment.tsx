'use client';

import { useId, useState, type FormEvent } from 'react';
import type {
  ManualPaymentAccount,
  ManualPaymentMethod,
  MerchantBillingPayment,
  PublicPlan,
} from '@ecomesta/types';
import { billingCycleDefinition, formatBdt, formatBillingDate, type BillingCycleCode } from '@ecomesta/utils';
import { api, ApiError } from '@/lib/api-client';

/** Wallet brand colours, used for tiles and the instruction card. */
export const WALLET_BRANDS: Record<ManualPaymentMethod, { color: string; tint: string; mark: string }> = {
  BKASH: { color: '#E2136E', tint: '#fdeef5', mark: 'b' },
  NAGAD: { color: '#EE4023', tint: '#fef0eb', mark: 'N' },
  ROCKET: { color: '#8C3494', tint: '#f6eef8', mark: 'R' },
  UPAY: { color: '#0F54A6', tint: '#eaf1fa', mark: 'U' },
};

export const METHOD_LABELS: Record<ManualPaymentMethod, string> = {
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  ROCKET: 'Rocket',
  UPAY: 'Upay',
};

function WalletMark({ method, size = 'md' }: { method: ManualPaymentMethod; size?: 'sm' | 'md' }) {
  const brand = WALLET_BRANDS[method];
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-sm ${
        size === 'sm' ? 'h-7 w-7 text-sm' : 'h-11 w-11 text-lg'
      }`}
      style={{ backgroundColor: brand.color }}
    >
      {brand.mark}
    </span>
  );
}

function CopyRow({ label, value, display }: { label: string; value: string; display?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
        <p className="mt-0.5 truncate font-mono text-lg font-semibold tracking-wide text-[var(--color-ink)]">
          {display ?? value}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-ink)] hover:bg-[#f4f7f5]"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <h3 className="flex items-center gap-2.5 text-sm font-semibold text-[var(--color-ink)]">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs text-white">
        {n}
      </span>
      {title}
    </h3>
  );
}

/**
 * Pay for a plan with bKash / Nagad / Rocket / Upay: the merchant sends the
 * money to Ecomesta's number, then reports their number and the transaction ID.
 * The plan activates when Ecomesta confirms the payment.
 */
export function ManualPaymentPanel({
  plan,
  cycle,
  accounts,
  token,
  trialEndsAt,
  onSubmitted,
}: {
  plan: PublicPlan;
  cycle: BillingCycleCode;
  accounts: ManualPaymentAccount[];
  token: string | null;
  /** While trialing, the paid period starts when the trial ends. */
  trialEndsAt: string | null;
  onSubmitted: (payment: MerchantBillingPayment) => void;
}) {
  const formId = useId();
  const [method, setMethod] = useState<ManualPaymentMethod>(accounts[0]?.method ?? 'BKASH');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = accounts.find((item) => item.method === method) ?? accounts[0];
  const amount = plan.prices.find((price) => price.billingCycle === cycle)?.amount ?? plan.monthlyPrice;
  const period = billingCycleDefinition(cycle);
  const brand = WALLET_BRANDS[method];
  const label = METHOD_LABELS[method];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const digits = senderNumber.replace(/[\s\-()]/g, '').replace(/^\+?88/, '');
    if (!/^01[3-9]\d{8}$/.test(digits)) {
      setError(`Enter the 11-digit ${label} number you paid from, e.g. 01712345678.`);
      return;
    }
    if (!/^[A-Za-z0-9]{6,30}$/.test(transactionId.replace(/\s+/g, ''))) {
      setError('Enter the transaction ID from your payment confirmation message.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.post<{ success: true; data: MerchantBillingPayment }>(
        '/billing/payments',
        { planSlug: plan.slug, billingCycle: cycle, method, senderNumber: digits, transactionId },
        { token },
      );
      onSubmitted(result.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit your payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!account) return null;

  return (
    <section
      id="pay"
      aria-labelledby={`${formId}-title`}
      className="scroll-mt-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_8px_30px_rgba(16,40,32,0.06)]"
    >
      <header className="bg-gradient-to-r from-[#0f3d30] via-[#145240] to-[#1b6b53] px-5 py-5 text-white sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Secure checkout</p>
        <h2 id={`${formId}-title`} className="mt-1 text-xl font-semibold sm:text-2xl">
          Complete your payment
        </h2>
        <p className="mt-1 text-sm text-white/80">
          Pay with bKash, Nagad, Rocket or Upay. Your plan activates as soon as our team confirms it.
        </p>
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <aside className="border-b border-[var(--color-border)] bg-[#f6faf8] p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">You are paying for</p>
          <p className="mt-2 text-lg font-semibold text-[var(--color-ink)]">{plan.name} plan</p>
          <p className="text-sm text-[var(--color-muted)]">{period.label} billing</p>
          <p className="mt-5 text-4xl font-bold tracking-tight text-[var(--color-ink)]">{formatBdt(amount)}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {period.months === 1 ? 'for 1 month' : `for ${period.months} months`}
            {period.discountPercent > 0 ? ` · you save ${period.discountPercent}%` : ''}
          </p>
          {trialEndsAt ? (
            <p className="mt-4 rounded-lg bg-white px-3 py-2 text-sm text-[var(--color-ink)]">
              Your free trial continues. The paid period starts on {formatBillingDate(trialEndsAt)}.
            </p>
          ) : null}
          {plan.features.length > 0 ? (
            <ul className="mt-5 space-y-2 text-sm text-[var(--color-ink)]">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span aria-hidden="true" className="mt-0.5 text-[var(--color-accent)]">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-6 flex items-start gap-2 text-xs text-[var(--color-muted)]">
            <span aria-hidden="true">🔒</span>
            Every payment is checked by the Ecomesta team. You get an email as soon as it is confirmed.
          </p>
        </aside>

        <form onSubmit={onSubmit} noValidate className="space-y-7 p-5 sm:p-7">
          <fieldset className="space-y-3">
            <legend className="sr-only">Payment method</legend>
            <StepTitle n={1} title="Choose how you pay" />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {accounts.map((item) => {
                const checked = item.method === method;
                const itemBrand = WALLET_BRANDS[item.method];
                return (
                  <label
                    key={item.method}
                    className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 px-2 py-3 text-sm font-semibold transition-all has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)] ${
                      checked ? 'shadow-md' : 'border-[var(--color-border)] bg-white hover:border-[#c9d6d0]'
                    }`}
                    style={checked ? { borderColor: itemBrand.color, backgroundColor: itemBrand.tint } : undefined}
                  >
                    <input
                      type="radio"
                      name={`${formId}-method`}
                      className="sr-only"
                      checked={checked}
                      onChange={() => {
                        setMethod(item.method);
                        setError(null);
                      }}
                    />
                    <WalletMark method={item.method} />
                    <span className="text-[var(--color-ink)]">{item.label}</span>
                    {checked ? (
                      <span
                        aria-hidden="true"
                        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white"
                        style={{ backgroundColor: itemBrand.color }}
                      >
                        ✓
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-3">
            <StepTitle n={2} title={`Send money with ${label}`} />
            <div className="space-y-2.5 rounded-2xl p-3 sm:p-4" style={{ backgroundColor: brand.tint }}>
              <ol className="space-y-1 px-1 text-sm text-[var(--color-ink)]">
                <li>
                  Open your {label} app and choose <strong>{account.transferType}</strong>.
                </li>
                <li>Send the exact amount to the number below.</li>
                <li>Keep the confirmation message — you need its transaction ID.</li>
              </ol>
              <CopyRow label={`${label} number`} value={account.number} />
              <CopyRow label="Amount" value={String(amount)} display={formatBdt(amount)} />
            </div>
          </div>

          <div className="space-y-3">
            <StepTitle n={3} title="Tell us about your payment" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-[var(--color-ink)]">Your {label} number</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="01XXXXXXXXX"
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-[var(--color-ink)]">Transaction ID</span>
                <input
                  type="text"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="e.g. 9BK7XY12QZ"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                  className="h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 font-mono text-base uppercase tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                />
              </label>
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              You can find the transaction ID (TrxID) in the SMS or in your {label} app&apos;s transaction history.
            </p>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-[#f1c9b8] bg-[#fdf3ee] px-3 py-2 text-sm text-[#a3441f]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold text-white shadow-md transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: brand.color }}
          >
            {submitting ? 'Submitting…' : `Submit ${formatBdt(amount)} ${label} payment`}
          </button>
        </form>
      </div>
    </section>
  );
}

/** Shown while a payment waits for Ecomesta to confirm it. */
export function PendingPaymentNotice({ payment }: { payment: MerchantBillingPayment }) {
  return (
    <section
      aria-labelledby="pending-payment-title"
      className="overflow-hidden rounded-2xl border border-[#cfe3da] bg-gradient-to-br from-[#f1f9f5] to-white p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-xl text-white"
        >
          ⏳
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="pending-payment-title" className="text-lg font-semibold text-[var(--color-ink)]">
            Payment under review
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink)]">
            We are checking your {formatBdt(payment.amount)} {METHOD_LABELS[payment.method]} payment for the{' '}
            {payment.planName} plan. This usually takes a few hours — we will email you as soon as it is confirmed.
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt className="text-[var(--color-muted)]">Transaction ID</dt>
              <dd className="font-mono font-semibold">{payment.transactionId}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-[var(--color-muted)]">From</dt>
              <dd className="font-semibold">{payment.senderNumber}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-[var(--color-muted)]">Submitted</dt>
              <dd className="font-semibold">{formatBillingDate(payment.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

const STATUS_STYLES: Record<MerchantBillingPayment['status'], { label: string; className: string }> = {
  PENDING: { label: 'Under review', className: 'bg-[#fff6e0] text-[#8a5a00]' },
  APPROVED: { label: 'Confirmed', className: 'bg-[#e3f1ec] text-[#1b6b53]' },
  REJECTED: { label: 'Not confirmed', className: 'bg-[#fdeee8] text-[#a3441f]' },
};

export function PaymentHistory({ payments }: { payments: MerchantBillingPayment[] }) {
  if (payments.length === 0) return null;
  return (
    <section aria-labelledby="payment-history-title" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <h2 id="payment-history-title" className="border-b border-[var(--color-border)] px-5 py-4 text-base font-semibold">
        Payment history
      </h2>
      <ul className="divide-y divide-[var(--color-border)]">
        {payments.map((payment) => {
          const status = STATUS_STYLES[payment.status];
          return (
            <li key={payment.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <WalletMark method={payment.method} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-ink)]">
                  {payment.planName} · {billingCycleDefinition(payment.billingCycle).label}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {formatBillingDate(payment.createdAt)} · TrxID <span className="font-mono">{payment.transactionId}</span>
                </p>
                {payment.status === 'REJECTED' && payment.rejectionReason ? (
                  <p className="mt-1 text-xs text-[#a3441f]">{payment.rejectionReason}</p>
                ) : null}
              </div>
              <p className="text-sm font-semibold">{formatBdt(payment.amount)}</p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
