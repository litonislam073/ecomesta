'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import type { SubscriptionPlan } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import {
  PlanFormFields,
  emptyPlanForm,
  type PlanFormState,
} from '@/components/plans/plan-form-fields';
import { useToast } from '@/components/ui/toast';
import { humanApiError, isNonNegativeMoney, normalizeSlug } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

export default function NewPlanPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [form, setForm] = useState<PlanFormState>(emptyPlanForm());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const slug = normalizeSlug(form.slug || form.name);
    if (form.name.trim().length < 2) {
      setError('Plan name must be at least 2 characters.');
      return;
    }
    if (slug.length < 2) {
      setError('Plan slug must be at least 2 characters.');
      return;
    }
    if (!isNonNegativeMoney(form.monthlyPrice)) {
      setError('Monthly price must be a non-negative amount such as 999.');
      return;
    }

    setBusy(true);
    try {
      const result = await api.post<{ success: true; data: SubscriptionPlan }>(
        '/admin/plans',
        {
          name: form.name.trim(),
          slug,
          description: form.description.trim() || null,
          monthlyPrice: form.monthlyPrice.trim(),
          active: form.active,
        },
      );
      pushToast('Plan created', 'success');
      router.push(`/dashboard/plans/${result.data.id}`);
    } catch (err) {
      const message = humanApiError(err, 'Could not create the plan');
      setError(message);
      pushToast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="New plan" backHref="/dashboard/plans" backLabel="Plans" />

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      >
        <PlanFormFields form={form} setForm={setForm} />

        {error ? (
          <p className="text-sm text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create'}
        </Button>
      </form>
    </div>
  );
}
