'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminSubscription, SubscriptionStatus } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
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

export default function AdminSubscriptionDetailPage() {
  const params = useParams<{ subscriptionId: string }>();
  const subscriptionId = params.subscriptionId;
  const { pushToast } = useToast();

  const [subscription, setSubscription] = useState<AdminSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SubscriptionStatus | ''>('');
  const [pending, setPending] = useState<SubscriptionStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: AdminSubscription }>(
        `/admin/subscriptions/${subscriptionId}`,
      );
      setSubscription(result.data);
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

  const transitions = subscription
    ? allowedSubscriptionTransitions(subscription.status)
    : [];

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
                <dd>{subscription.plan.trialMonths > 0 ? `${subscription.plan.trialMonths} months` : 'None'}</dd>
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
    </div>
  );
}
