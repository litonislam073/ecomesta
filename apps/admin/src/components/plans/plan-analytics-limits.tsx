'use client';

import { useState } from 'react';
import type { SubscriptionPlan } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { useToast } from '@/components/ui/toast';
import { humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

type Config = Record<string, unknown> & { limits?: Record<string, unknown> };

/**
 * Full analytics on a plan (any date range, visitors, products, traffic,
 * funnel and CSV export). Without it a store sees a 30-day sales overview.
 * Saved into the plan's `configuration.limits`; everything else is kept.
 */
export function PlanAnalyticsLimits({ plan, onSaved }: { plan: SubscriptionPlan; onSaved: () => void }) {
  const { pushToast } = useToast();
  const config = (plan.configuration ?? {}) as Config;
  const limits = config.limits;
  const [enabled, setEnabled] = useState(limits?.advancedAnalytics === true);
  const [busy, setBusy] = useState(false);

  if (!limits) {
    return (
      <section aria-labelledby="plan-analytics" className="space-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 id="plan-analytics" className="font-semibold">
          Analytics
        </h2>
        <p className="text-sm text-[var(--color-muted)]">This plan sets no limits, so its stores get full analytics.</p>
      </section>
    );
  }

  async function save() {
    setBusy(true);
    try {
      await api.patch(`/admin/plans/${plan.id}`, {
        configuration: { ...config, limits: { ...limits, advancedAnalytics: enabled } },
      });
      pushToast('Analytics setting saved', 'success');
      onSaved();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not save the setting'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="plan-analytics" className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div>
        <h2 id="plan-analytics" className="font-semibold">
          Analytics
        </h2>
        <p className="text-sm text-[var(--color-muted)]">
          Full analytics: any date range, visitors and conversion rate, best-selling products, traffic sources, the
          shopping funnel and CSV export. Without it, stores see a 30-day sales overview.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
        Full analytics included in this plan
      </label>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save analytics setting'}
      </Button>
    </section>
  );
}
