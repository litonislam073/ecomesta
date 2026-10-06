'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ManualPaymentAccount, MerchantBillingPayment, MerchantSubscription } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { formatBdt, formatBillingDate, PAYMENT_GRACE_DAYS } from '@ecomesta/utils';
import {
  ManualPaymentPanel,
  PaymentHistory,
  PendingPaymentNotice,
} from '@/components/billing/manual-payment';
import { CycleSwitch, PlanCards } from '@/components/billing/plan-cards';
import { defaultSelection } from '@/components/billing/plan-picker';
import { PaymentCta, cycleLabel, priceAfterTrial } from '@/components/billing/subscription-notices';
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
  const paying = Boolean(data.pendingPayment);
  switch (sub.phase) {
    case 'TRIAL':
      return (
        <div className="space-y-2">
          <p className="inline-flex rounded-full bg-[#e3f1ec] px-3 py-1 text-sm font-semibold text-[var(--color-accent)]">
            Free trial
          </p>
          {sub.trialEndsAt ? <p>Your free trial ends on {formatBillingDate(sub.trialEndsAt)}.</p> : null}
          <p className="text-sm text-[var(--color-muted)]">
            No payment is needed today. {priceAfterTrial(sub)} after the trial — pay any time before then to keep
            your store running, with a {PAYMENT_GRACE_DAYS}-day grace period{dueBy ? ` (until ${dueBy})` : ''}.
          </p>
        </div>
      );
    case 'GRACE':
      return (
        <div className="space-y-3">
          <div>
            <p className="font-semibold">Payment due</p>
            <p>Your store is in a {PAYMENT_GRACE_DAYS}-day payment grace period.</p>
            {dueBy ? <p className="font-semibold">Pay by {dueBy} to keep your store online.</p> : null}
          </div>
          {paying ? null : <PaymentCta label="Pay now" data={data} />}
        </div>
      );
    case 'LAPSED':
    case 'SUSPENDED':
      return (
        <div className="space-y-3">
          <div>
            <p className="font-semibold">Your store is suspended</p>
            <p>
              Your {PAYMENT_GRACE_DAYS}-day payment grace period has ended. Complete your payment to reactivate your
              store.
            </p>
          </div>
          {paying ? null : <PaymentCta label="Pay & Reactivate" data={data} />}
        </div>
      );
    case 'ACTIVE':
      return (
        <p>
          Your subscription is active
          {sub.endsAt ? ` and paid through ${formatBillingDate(sub.endsAt)}` : ''}. Renew any time below to add
          another period.
        </p>
      );
    default:
      return <p>This subscription has been cancelled. Choose a plan below and pay to restart it.</p>;
  }
}

export default function BillingView() {
  const { accessToken } = useAuth();
  const { data, loading, error, refresh, setData } = useSubscription();
  const { plans } = usePublicPlans();
  const searchParams = useSearchParams();
  const requested = readPlanSelection(searchParams);
  const [selection, setSelection] = useState<PlanSelection | null>(null);
  const [accounts, setAccounts] = useState<ManualPaymentAccount[] | null>(null);
  const [payments, setPayments] = useState<MerchantBillingPayment[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const sub = data?.subscription ?? null;
  const pending = data?.pendingPayment ?? null;
  const canManage = Boolean(data?.canManage);

  useEffect(() => {
    if (!plans || selection) return;
    const current = sub ? { plan: sub.plan.slug, cycle: sub.billingCycle } : null;
    setSelection(defaultSelection(plans, requested ?? current));
  }, [plans, sub, requested, selection]);

  const loadPayments = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [accountsRes, paymentsRes] = await Promise.all([
        api.get<{ success: true; data: ManualPaymentAccount[] }>('/billing/payment-accounts', { token: accessToken }),
        api.get<{ success: true; data: MerchantBillingPayment[] }>('/billing/payments', { token: accessToken }),
      ]);
      setAccounts(accountsRes.data);
      setPayments(paymentsRes.data);
    } catch {
      setAccounts([]);
    }
  }, [accessToken]);

  // Loaded once the subscription is known, also without a subscription: a new
  // store pays here (again, if its sign-up payment was rejected). Later updates
  // to `data` (e.g. a payment just submitted) must not reload over local state.
  const hasData = Boolean(data);
  useEffect(() => {
    if (hasData) void loadPayments();
  }, [hasData, loadPayments]);

  /** Plan switch without payment: only for businesses still in an earlier free trial. */
  async function switchDuringTrial() {
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
      setMessage({ tone: 'ok', text: 'Your plan has been updated.' });
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof ApiError ? err.message : 'Could not update your plan. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  function onPaymentSubmitted(payment: MerchantBillingPayment) {
    if (data) setData({ ...data, pendingPayment: payment });
    setPayments((current) => [payment, ...current]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const selectedPlan = plans?.find((plan) => plan.slug === selection?.plan) ?? null;
  const currentPlan = plans?.find((plan) => plan.slug === sub?.plan.slug) ?? null;
  const lastRejected = !pending && payments[0]?.status === 'REJECTED' ? payments[0] : null;
  // During the trial the same or a cheaper plan (or another billing period) is free to switch to.
  const freeSwitch =
    sub?.phase === 'TRIAL' &&
    selection !== null &&
    selectedPlan !== null &&
    currentPlan !== null &&
    selectedPlan.monthlyPrice <= currentPlan.monthlyPrice &&
    (selection.plan !== sub.plan.slug || selection.cycle !== sub.billingCycle);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plan &amp; billing</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Your Ecomesta subscription. Prices are in BDT.</p>
      </div>

      {loading && !data ? <LoadingState label="Loading your subscription" /> : null}
      {error && !data ? (
        <ErrorState title="Could not load your subscription" message={error} onRetry={() => void refresh()} />
      ) : null}

      {pending ? <PendingPaymentNotice payment={pending} /> : null}
      {lastRejected ? (
        <p role="status" className="rounded-xl border border-[#f1c9b8] bg-[#fdf3ee] px-4 py-3 text-sm text-[#a3441f]">
          We could not confirm your last payment ({formatBdt(lastRejected.amount)}, TrxID {lastRejected.transactionId})
          {lastRejected.rejectionReason ? `: ${lastRejected.rejectionReason}` : '.'} Please check the details and pay
          again below.
        </p>
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
              <Detail label="Started" value={formatBillingDate(sub.startsAt)} />
            </dl>
          </div>
        </Card>
      ) : null}

      {data && plans && plans.length > 0 && selection ? (
        <section aria-labelledby="choose-plan-title" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="choose-plan-title" className="text-lg font-semibold">
                Choose your plan
              </h2>
              <p className="text-sm text-[var(--color-muted)]">
                {sub
                  ? 'Pick a plan and billing period, then pay below. Plan changes take effect once your payment is confirmed.'
                  : 'Pick a plan and billing period, then pay below. Your store goes live as soon as we confirm the payment.'}
              </p>
            </div>
            <CycleSwitch
              value={selection.cycle}
              onChange={(cycle) => setSelection({ ...selection, cycle })}
              idPrefix="billing"
            />
          </div>
          <PlanCards
            plans={plans}
            cycle={selection.cycle}
            selected={selection.plan}
            currentSlug={sub?.plan.slug ?? null}
            onSelect={(plan) => setSelection({ ...selection, plan })}
            idPrefix="billing"
          />
          {message ? (
            <p
              role={message.tone === 'error' ? 'alert' : 'status'}
              className={`text-sm ${message.tone === 'error' ? 'text-[#a3441f]' : 'text-[var(--color-accent)]'}`}
            >
              {message.text}
            </p>
          ) : null}
          {canManage && freeSwitch ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#f4f7f5] px-4 py-3 text-sm">
              <span>Switching to {selectedPlan?.name} is free during your trial.</span>
              <Button
                type="button"
                variant="secondary"
                className="h-9 rounded-lg px-4 font-semibold"
                disabled={saving}
                onClick={() => void switchDuringTrial()}
              >
                {saving ? 'Switching…' : `Switch to ${selectedPlan?.name} now`}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {data && !canManage ? (
        <p className="text-sm text-[var(--color-muted)]">Only the account owner or an admin can pay for the plan.</p>
      ) : null}

      {data && canManage && !pending && selectedPlan && selection && accounts && accounts.length > 0 ? (
        <ManualPaymentPanel
          plan={selectedPlan}
          cycle={selection.cycle}
          accounts={accounts}
          token={accessToken}
          trialEndsAt={sub?.phase === 'TRIAL' ? sub.trialEndsAt : null}
          onSubmitted={onPaymentSubmitted}
        />
      ) : null}

      {data ? <PaymentHistory payments={payments} /> : null}
    </div>
  );
}
