'use client';

import Link from 'next/link';
import type { MerchantSubscription } from '@ecomesta/types';
import {
  billingCycleDefinition,
  formatBdt,
  formatBillingDate,
  formatCyclePrice,
  PAYMENT_GRACE_DAYS,
} from '@ecomesta/utils';

type Sub = NonNullable<MerchantSubscription['subscription']>;

export function cycleLabel(sub: Pick<Sub, 'billingCycle'>): string {
  return billingCycleDefinition(sub.billingCycle).label;
}

export function priceAfterTrial(sub: Sub): string {
  return formatCyclePrice(sub.amountDue, sub.billingCycle);
}

/** Payment entry point: takes the owner to the bKash / Nagad / Rocket / Upay checkout. */
export function PaymentCta({
  label,
  data,
}: {
  label: 'Pay now' | 'Pay & Reactivate';
  data: MerchantSubscription;
}) {
  if (!data.canManage) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Only the account owner or an admin can complete the payment.
      </p>
    );
  }
  if (data.pendingPayment) {
    return (
      <p className="text-sm text-[var(--color-ink)]">
        Your payment is being checked. We will email you as soon as it is confirmed.
      </p>
    );
  }
  return (
    <Link
      href="/dashboard/billing#pay"
      className="inline-flex h-10 items-center rounded-lg bg-[var(--color-accent)] px-5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
    >
      {label}
    </Link>
  );
}

/** Slim banner at the top of the dashboard for awaiting-payment / trial / grace states. */
export function SubscriptionBanner({ data, showTrial }: { data: MerchantSubscription; showTrial: boolean }) {
  const sub = data.subscription;
  if (!sub && data.awaitingFirstPayment) {
    return (
      <section
        aria-labelledby="launch-banner-title"
        className="mb-6 rounded-lg border-2 border-[#d9a441] bg-[#fff8e8] px-4 py-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="launch-banner-title" className="font-semibold text-[var(--color-ink)]">
              Your store is not live yet
            </h2>
            <p className="text-sm text-[var(--color-ink)]">
              {data.pendingPayment
                ? 'We are confirming your payment. Your store goes live for customers as soon as it is confirmed — you can add products meanwhile.'
                : 'Pay for your plan to bring your store online. You can add products meanwhile.'}
            </p>
          </div>
          {data.pendingPayment ? null : <PaymentCta label="Pay now" data={data} />}
        </div>
      </section>
    );
  }
  if (!sub) return null;

  if (sub.phase === 'GRACE') {
    return (
      <section
        aria-labelledby="grace-banner-title"
        className="mb-6 rounded-lg border-2 border-[#d9a441] bg-[#fff8e8] px-4 py-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="grace-banner-title" className="font-semibold text-[var(--color-ink)]">
              Payment due
            </h2>
            <p className="text-sm text-[var(--color-ink)]">
              Your store is currently in a {PAYMENT_GRACE_DAYS}-day payment grace period.
              {sub.paymentDueBy ? <> Payment due by {formatBillingDate(sub.paymentDueBy)}.</> : null}
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              {sub.plan.name} plan · {cycleLabel(sub)} · Amount due {formatBdt(sub.amountDue)}
            </p>
          </div>
          <Link
            href="/dashboard/billing"
            className="inline-flex h-10 items-center rounded-lg bg-[var(--color-accent)] px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Pay now
          </Link>
        </div>
      </section>
    );
  }

  if (showTrial && sub.phase === 'TRIAL' && sub.trialEndsAt) {
    return (
      <p className="mb-6 rounded-lg border border-[var(--color-border)] bg-[#f1f8f5] px-4 py-2 text-sm text-[var(--color-ink)]">
        <span className="font-semibold">Free trial</span> · Your free trial ends on{' '}
        {formatBillingDate(sub.trialEndsAt)}.{' '}
        <Link href="/dashboard/billing" className="font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline">
          Plan &amp; billing
        </Link>
      </p>
    );
  }
  return null;
}

/** Replaces dashboard pages while the store is suspended for non-payment. */
export function SuspendedScreen({ data }: { data: MerchantSubscription }) {
  const sub = data.subscription;
  return (
    <section
      aria-labelledby="suspended-title"
      className="mx-auto max-w-2xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-[#a3441f]">Payment required</p>
      <h1 id="suspended-title" className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
        Your store is suspended
      </h1>
      <p className="mt-3 text-[var(--color-ink)]">
        Your {PAYMENT_GRACE_DAYS}-day payment grace period has ended. Complete your payment to
        reactivate your store.
      </p>
      {sub ? (
        <dl className="mt-5 grid gap-3 rounded-lg bg-[#f4f7f5] p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[var(--color-muted)]">Plan</dt>
            <dd className="font-semibold">{sub.plan.name}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Billing</dt>
            <dd className="font-semibold">{cycleLabel(sub)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Amount due</dt>
            <dd className="font-semibold">{formatBdt(sub.amountDue)}</dd>
          </div>
        </dl>
      ) : null}
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        Your products, orders, customers and settings are kept safe while the store is suspended.
      </p>
      <div className="mt-5 flex flex-wrap items-start gap-4">
        <PaymentCta label="Pay & Reactivate" data={data} />
        <Link
          href="/dashboard/billing"
          className="inline-flex h-10 items-center rounded-lg border border-[var(--color-border)] px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Plan &amp; billing
        </Link>
      </div>
    </section>
  );
}
