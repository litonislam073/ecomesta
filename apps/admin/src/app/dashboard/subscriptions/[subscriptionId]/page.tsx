'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminSubscription, SubscriptionPlan, SubscriptionStatus } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import {
  allowedSubscriptionTransitions,
  billingCycleLabel,
  formatDateTime,
  formatPlanMoney,
  humanApiError,
  phaseTone,
  subscriptionPhaseLabel,
} from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

/** ISO → value for `<input type="datetime-local">` in local time. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(local: string): string | null {
  if (!local.trim()) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function AdminSubscriptionDetailPage() {
  const params = useParams<{ subscriptionId: string }>();
  const subscriptionId = params.subscriptionId;
  const { pushToast } = useToast();

  const [subscription, setSubscription] = useState<AdminSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SubscriptionStatus | ''>('');
  const [pending, setPending] = useState<SubscriptionStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const [planId, setPlanId] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [planBusy, setPlanBusy] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState(false);

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    setError(null);
    try {
      const [subResult, plansResult] = await Promise.all([
        api.get<{ success: true; data: AdminSubscription }>(
          `/admin/subscriptions/${subscriptionId}`,
        ),
        api.get<{ success: true; data: { items: SubscriptionPlan[] } }>(
          '/admin/plans?limit=100',
        ),
      ]);
      setSubscription(subResult.data);
      setPlans(plansResult.data.items);
      setPlanId(subResult.data.planId);
      setEndsAt(toLocalInput(subResult.data.endsAt));
      setTrialEndsAt(toLocalInput(subResult.data.trialEndsAt));
      setDraft('');
    } catch (err) {
      setError(humanApiError(err, 'Failed to load subscription'));
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyStatus() {
    if (!pending || !subscriptionId) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.patch(`/admin/subscriptions/${subscriptionId}/status`, {
        status: pending,
      });
      pushToast(`Subscription moved to ${pending}`, 'success');
      setPending(null);
      await load();
    } catch (err) {
      const message = humanApiError(err, 'Could not update the subscription');
      setActionError(message);
      pushToast(message, 'error');
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  async function applyPlan() {
    if (!subscriptionId || !planId || !subscription) return;
    setPlanBusy(true);
    setActionError(null);
    try {
      const body: {
        planId: string;
        endsAt?: string | null;
        trialEndsAt?: string | null;
      } = { planId };
      if (endsAt !== toLocalInput(subscription.endsAt)) {
        body.endsAt = fromLocalInput(endsAt);
      }
      if (trialEndsAt !== toLocalInput(subscription.trialEndsAt)) {
        body.trialEndsAt = fromLocalInput(trialEndsAt);
      }
      await api.patch(`/admin/subscriptions/${subscriptionId}/plan`, body);
      pushToast('Subscription plan updated', 'success');
      setConfirmPlan(false);
      await load();
    } catch (err) {
      const message = humanApiError(err, 'Could not update the plan');
      setActionError(message);
      pushToast(message, 'error');
      setConfirmPlan(false);
    } finally {
      setPlanBusy(false);
    }
  }

  const transitions = subscription
    ? allowedSubscriptionTransitions(subscription.status)
    : [];

  const planDirty =
    !!subscription &&
    (planId !== subscription.planId ||
      endsAt !== toLocalInput(subscription.endsAt) ||
      trialEndsAt !== toLocalInput(subscription.trialEndsAt));

  const selectedPlanName =
    plans.find((plan) => plan.id === planId)?.name ?? subscription?.plan.name ?? 'plan';

  // Include the current plan even if it was later deactivated.
  const planOptions =
    subscription && !plans.some((plan) => plan.id === subscription.planId)
      ? [
          {
            id: subscription.plan.id,
            name: `${subscription.plan.name} (current)`,
            active: subscription.plan.active,
          },
          ...plans,
        ]
      : plans;

  return (
    <div className="space-y-6">
      <PageHeader
        title={subscription ? `${subscription.tenant.name} subscription` : 'Subscription'}
        description={subscription?.plan.name}
        backHref="/dashboard/subscriptions"
        backLabel="Subscriptions"
      />

      {loading ? <LoadingState label="Loading subscription" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && subscription ? (
        <>
          {actionError ? <ErrorState message={actionError} /> : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Subscription">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-[var(--color-muted)]">Status</dt>
                <dd>
                  <StatusBadge status={subscription.status} />
                </dd>
                <dt className="text-[var(--color-muted)]">Lifecycle</dt>
                <dd>
                  <Badge tone={phaseTone(subscription.phase)}>
                    {subscriptionPhaseLabel(subscription.phase)}
                  </Badge>
                </dd>
                <dt className="text-[var(--color-muted)]">Tenant</dt>
                <dd>
                  <Link
                    className="text-[var(--color-accent)] hover:underline"
                    href={`/dashboard/tenants/${subscription.tenant.id}`}
                  >
                    {subscription.tenant.name}
                  </Link>
                </dd>
                <dt className="text-[var(--color-muted)]">Plan</dt>
                <dd>
                  <Link
                    className="text-[var(--color-accent)] hover:underline"
                    href={`/dashboard/plans/${subscription.plan.id}`}
                  >
                    {subscription.plan.name}
                  </Link>
                </dd>
                <dt className="text-[var(--color-muted)]">Billing cycle</dt>
                <dd>{billingCycleLabel(subscription.billingCycle)}</dd>
                <dt className="text-[var(--color-muted)]">Price per period</dt>
                <dd>{formatPlanMoney(subscription.amountDue)}</dd>
                <dt className="text-[var(--color-muted)]">Trial length</dt>
                <dd>{subscription.plan.trialDays > 0 ? `${subscription.plan.trialDays} days` : 'None'}</dd>
                <dt className="text-[var(--color-muted)]">Starts</dt>
                <dd>{formatDateTime(subscription.startsAt)}</dd>
                <dt className="text-[var(--color-muted)]">Ends</dt>
                <dd>{formatDateTime(subscription.endsAt)}</dd>
                <dt className="text-[var(--color-muted)]">Trial ends</dt>
                <dd>{formatDateTime(subscription.trialEndsAt)}</dd>
                <dt className="text-[var(--color-muted)]">Payment due by</dt>
                <dd>{formatDateTime(subscription.paymentDueBy)}</dd>
              </dl>
            </Card>

            <Card
              title="Lifecycle"
              description="Only transitions the API accepts from the current status are offered."
            >
              {transitions.length === 0 ? (
                <EmptyState
                  title="No transitions available"
                  description="This subscription is in a terminal state."
                />
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <label
                    className="block flex-1 space-y-1.5"
                    htmlFor="subscription-status"
                  >
                    <span className="text-sm font-medium">Move to status</span>
                    <Select
                      id="subscription-status"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value as SubscriptionStatus | '')}
                    >
                      <option value="">Select a status</option>
                      {transitions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <Button
                    variant={
                      draft === 'CANCELLED' || draft === 'EXPIRED' ? 'danger' : 'primary'
                    }
                    disabled={!draft}
                    onClick={() => draft && setPending(draft)}
                  >
                    Change status
                  </Button>
                </div>
              )}
            </Card>

            <Card
              title="Change plan"
              description="Override the plan and paid-through / trial end dates. Written to the audit log."
              className="lg:col-span-2"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block space-y-1.5 sm:col-span-2 lg:col-span-1" htmlFor="subscription-plan">
                  <span className="text-sm font-medium">Plan</span>
                  <Select
                    id="subscription-plan"
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                  >
                    {planOptions.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                        {'active' in plan && plan.active === false ? ' (inactive)' : ''}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block space-y-1.5" htmlFor="subscription-ends-at">
                  <span className="text-sm font-medium">Paid through (ends)</span>
                  <Input
                    id="subscription-ends-at"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </label>
                <label className="block space-y-1.5" htmlFor="subscription-trial-ends-at">
                  <span className="text-sm font-medium">Trial ends</span>
                  <Input
                    id="subscription-trial-ends-at"
                    type="datetime-local"
                    value={trialEndsAt}
                    onChange={(e) => setTrialEndsAt(e.target.value)}
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    disabled={!planDirty || !planId}
                    onClick={() => setConfirmPlan(true)}
                  >
                    Save plan changes
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        danger={pending === 'CANCELLED' || pending === 'EXPIRED'}
        title={`Move subscription to ${pending}?`}
        description={
          pending === 'CANCELLED'
            ? 'Cancelling ends billing for this tenant. Reactivation is the only way back out.'
            : pending === 'EXPIRED'
              ? "Expiring suspends the tenant's stores for non-payment. Store data is kept and the stores come back when the subscription is activated."
              : pending === 'ACTIVE'
                ? "Only activate after the tenant's payment has been confirmed. Stores suspended for non-payment are reactivated and the paid period starts."
                : 'The tenant billing lifecycle moves to the selected status and the change is written to the audit log.'
        }
        confirmLabel="Confirm status change"
        onConfirm={() => void applyStatus()}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        open={confirmPlan}
        busy={planBusy}
        title={`Change plan to ${selectedPlanName}?`}
        description="The subscription plan and dates are updated immediately. Entitlements follow the new plan, and the change is written to the audit log."
        confirmLabel="Confirm plan change"
        onConfirm={() => void applyPlan()}
        onCancel={() => setConfirmPlan(false)}
      />
    </div>
  );
}
