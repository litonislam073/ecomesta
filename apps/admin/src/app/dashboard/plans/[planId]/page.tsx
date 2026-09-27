'use client';

import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { SubscriptionPlan } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import {
  PlanFormFields,
  emptyPlanForm,
  planFormFromPlan,
  type PlanFormState,
} from '@/components/plans/plan-form-fields';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import {
  formatDateTime,
  humanApiError,
  isNonNegativeMoney,
  normalizeSlug,
} from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

export default function EditPlanPage() {
  const params = useParams<{ planId: string }>();
  const planId = params.planId;
  const { pushToast } = useToast();

  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [form, setForm] = useState<PlanFormState>(emptyPlanForm());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingActive, setPendingActive] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: SubscriptionPlan }>(
        `/admin/plans/${planId}`,
      );
      setPlan(result.data);
      setForm(planFormFromPlan(result.data));
    } catch (err) {
      setError(humanApiError(err, 'Failed to load plan'));
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!planId) return;
    setFormError(null);

    const slug = normalizeSlug(form.slug);
    if (form.name.trim().length < 2) {
      setFormError('Plan name must be at least 2 characters.');
      return;
    }
    if (slug.length < 2) {
      setFormError('Plan slug must be at least 2 characters.');
      return;
    }
    if (!isNonNegativeMoney(form.monthlyPrice)) {
      setFormError('Monthly price must be a non-negative amount such as 999.');
      return;
    }

    setBusy(true);
    try {
      await api.patch(`/admin/plans/${planId}`, {
        name: form.name.trim(),
        slug,
        description: form.description.trim() || null,
        monthlyPrice: form.monthlyPrice.trim(),
      });
      pushToast('Plan updated', 'success');
      await load();
    } catch (err) {
      const message = humanApiError(err, 'Could not save the plan');
      setFormError(message);
      pushToast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function applyActive() {
    if (pendingActive === null || !planId) return;
    setBusy(true);
    try {
      await api.patch(`/admin/plans/${planId}/status`, { active: pendingActive });
      pushToast(pendingActive ? 'Plan activated' : 'Plan deactivated', 'success');
      setPendingActive(null);
      await load();
    } catch (err) {
      const message = humanApiError(err, 'Could not update the plan');
      setFormError(message);
      pushToast(message, 'error');
      setPendingActive(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={plan?.name ?? 'Plan'}
        description={plan ? `Updated ${formatDateTime(plan.updatedAt)}` : undefined}
        backHref="/dashboard/plans"
        backLabel="Plans"
        actions={
          plan ? (
            <Badge tone={plan.active ? 'success' : 'neutral'}>
              {plan.active ? 'Active' : 'Inactive'}
            </Badge>
          ) : null
        }
      />

      {loading ? <LoadingState label="Loading plan" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && plan ? (
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <PlanFormFields form={form} setForm={setForm} />

          {formError ? (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            {plan.active ? (
              <Button
                type="button"
                variant="danger"
                disabled={busy}
                onClick={() => setPendingActive(false)}
              >
                Deactivate plan
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setPendingActive(true)}
              >
                Activate plan
              </Button>
            )}
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={pendingActive !== null}
        busy={busy}
        danger={pendingActive === false}
        title={pendingActive === false ? 'Deactivate this plan?' : 'Activate this plan?'}
        description={
          pendingActive === false
            ? 'The plan can no longer be assigned to new subscriptions. Existing subscriptions keep running on it.'
            : 'The plan becomes assignable to new subscriptions again.'
        }
        confirmLabel={pendingActive === false ? 'Deactivate' : 'Activate'}
        onConfirm={() => void applyActive()}
        onCancel={() => setPendingActive(null)}
      />
    </div>
  );
}
