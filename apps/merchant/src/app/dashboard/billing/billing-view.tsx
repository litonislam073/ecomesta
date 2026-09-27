'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { MerchantSubscription } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { formatBdt, formatBillingDate, PAYMENT_GRACE_DAYS } from '@ecomesta/utils';
import { PlanPicker, defaultSelection } from '@/components/billing/plan-picker';
import {
  PaymentCta,
  cycleLabel,
  priceAfterTrial,
} from '@/components/billing/subscription-notices';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { readPlanSelection, type PlanSelection } from '@/lib/plan-selection';
import { usePublicPlans, useSubscription } from '@/lib/subscription-context';

type Sub = NonNullable<MerchantSubscription['subscription']>;

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-[var(--color-muted)]">{label}</dt>
      <dd className="font-semibold text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function StatusSummary({ data, sub }: { data: MerchantSubscription; sub: Sub }) {
  const dueBy = sub.paymentDueBy ? formatBillingDate(sub.paymentDueBy) : null;
  switch (sub.phase) {
    case 'TRIAL':
      return (
        <div className="space-y-2">
          <p className="inline-flex rounded-full bg-[#e3f1ec] px-3 py-1 text-sm font-semibold text-[var(--color-accent)]">
            {sub.plan.trialMonths} Months Free
          </p>
          {sub.trialEndsAt ? (
            <p>Your free trial ends on {formatBillingDate(sub.trialEndsAt)}.</p>
          ) : null}
          <p className="text-sm text-[var(--color-muted)]">
            No payment is needed today. {priceAfterTrial(sub)} after the trial, with a{' '}
            {PAYMENT_GRACE_DAYS}-day grace period to pay{dueBy ? ` (by ${dueBy})` : ''}.
          </p>
        </div>
      );
    case 'GRACE':
      return (
        <div className="space-y-3">
          <div>
            <p className="font-semibold">Your trial has ended</p>
            <p>Your store is currently in a {PAYMENT_GRACE_DAYS}-day payment grace period.</p>
            {dueBy ? <p className="font-semibold">Payment due by {dueBy}.</p> : null}
          </div>
          <PaymentCta label="Pay now" data={data} />
        </div>
      );
    case 'LAPSED':
    case 'SUSPENDED':
      return (
        <div className="space-y-3">
          <div>
            <p className="font-semibold">Your store is suspended</p>
            <p>
              Your {PAYMENT_GRACE_DAYS}-day payment grace period has ended. Complete your payment to
              reactivate your store.
            </p>
          </div>
          <PaymentCta label="Pay & Reactivate" data={data} />
        </div>
      );
    case 'ACTIVE':
      return (
        <p>
          Your subscription is active
          {sub.endsAt ? ` and paid through ${formatBillingDate(sub.endsAt)}` : ''}.
        </p>
      );
    default:
      return <p>This subscription has been cancelled. Contact Ecomesta support to restart it.</p>;
  }
}

export default function BillingView() {
  const { accessToken } = useAuth();
  const { data, loading, error, refresh, setData } = useSubscription();
  const { plans } = usePublicPlans();
  const searchParams = useSearchParams();
  const requested = readPlanSelection(searchParams);
  const [selection, setSelection] = useState<PlanSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const sub = data?.subscription ?? null;
  const canChangePlan =
    Boolean(data?.canManage) && (!sub || !['ACTIVE', 'CANCELLED'].includes(sub.status));

  useEffect(() => {
    if (!plans || selection) return;
    const current = sub ? { plan: sub.plan.slug, cycle: sub.billingCycle } : null;
    setSelection(defaultSelection(plans, requested ?? current));
  }, [plans, sub, requested, selection]);

  async function savePlan() {
    if (!selection || !accessToken) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.post<{ success: true; data: MerchantSubscription }>(
        '/billing/subscription',
        { planSlug: selection.plan, billingCycle: selection.cycle },
        { token: accessToken },
      );
      setData(result.data);
      setMessage({ tone: 'ok', text: sub ? 'Your plan has been updated.' : 'Your 2-month free trial has started.' });
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof ApiError ? err.message : 'Could not update your plan. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  const unchanged =
    sub && selection && sub.plan.slug === selection.plan && sub.billingCycle === selection.cycle;
  const trialOver = Boolean(sub && sub.phase !== 'TRIAL');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plan &amp; billing</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Your Ecomesta subscription. Prices are in BDT.
        </p>
      </div>

      {loading && !data ? <LoadingState label="Loading your subscription" /> : null}
      {error && !data ? (
        <ErrorState title="Could not load your subscription" message={error} onRetry={() => void refresh()} />
      ) : null}

      {data && sub ? (
        <Card title={`${sub.plan.name} Plan`} description={data.tenantName}>
          <div className="space-y-5">
            <StatusSummary data={data} sub={sub} />
            <dl className="grid gap-4 border-t border-[var(--color-border)] pt-4 sm:grid-cols-3">
              <Detail label="Billing cycle" value={cycleLabel(sub)} />
              <Detail
                label={sub.phase === 'ACTIVE' ? 'Price' : sub.phase === 'TRIAL' ? 'After trial' : 'Amount due'}
                value={sub.phase === 'TRIAL' ? priceAfterTrial(sub) : formatBdt(sub.amountDue)}
              />
              <Detail
                label="Started"
                value={formatBillingDate(sub.startsAt)}
              />
            </dl>
          </div>
        </Card>
      ) : null}

      {data && !sub ? (
        <Card title="Choose a plan" description="Every plan starts with 2 months free. No payment details needed.">
          <p className="text-sm text-[var(--color-muted)]">
            Your business account does not have a plan yet.
          </p>
        </Card>
      ) : null}

      {data && canChangePlan && plans && plans.length > 0 && selection ? (
        <Card
          title={sub ? 'Change plan' : 'Start your free trial'}
          description={
            !sub
              ? 'Nothing is charged today.'
              : trialOver
                ? 'Choose the plan and billing period you want to pay for.'
                : 'Changing plan does not restart or extend your trial.'
          }
        >
          <div className="space-y-4">
            <PlanPicker
              plans={plans}
              value={selection}
              onChange={setSelection}
              idPrefix="billing"
              trialOver={trialOver}
            />
            {message ? (
              <p
                role={message.tone === 'error' ? 'alert' : 'status'}
                className={`text-sm ${message.tone === 'error' ? 'text-[#a3441f]' : 'text-[var(--color-accent)]'}`}
              >
                {message.text}
              </p>
            ) : null}
            <Button
              type="button"
              className="h-10 rounded-lg px-5 font-semibold"
              disabled={saving || Boolean(unchanged)}
              onClick={() => void savePlan()}
            >
              {saving ? 'Saving…' : sub ? 'Update plan' : 'Start 2 Months Free'}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
