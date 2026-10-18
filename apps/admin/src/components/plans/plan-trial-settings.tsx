'use client';

import { useState } from 'react';
import type { SubscriptionPlan } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { TRIAL_DAY_OPTIONS } from '@ecomesta/utils';
import { useToast } from '@/components/ui/toast';
import { humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

type Config = Record<string, unknown>;

function label(days: number): string {
  return days === 0 ? 'No free trial' : `${days}-day free trial`;
}

/**
 * The plan's free trial. With a trial, a new merchant can start this plan at
 * sign-up without paying; the store goes live at once and they pay before the
 * trial ends. Saved into `configuration.trialDays`; everything else is kept.
 */
export function PlanTrialSettings({ plan, onSaved }: { plan: SubscriptionPlan; onSaved: () => void }) {
  const { pushToast } = useToast();
  const config = (plan.configuration ?? {}) as Config;
  const current = plan.trialDays;
  // Keep an unusual value set earlier selectable instead of silently changing it.
  const options = (TRIAL_DAY_OPTIONS as readonly number[]).includes(current)
    ? [...TRIAL_DAY_OPTIONS]
    : [...TRIAL_DAY_OPTIONS, current].sort((a, b) => a - b);
  const [days, setDays] = useState(current);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.patch(`/admin/plans/${plan.id}`, { configuration: { ...config, trialDays: days } });
      pushToast(days === 0 ? `Free trial turned off for ${plan.name}` : `${plan.name} now has a ${days}-day free trial`, 'success');
      onSaved();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not save the free trial'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="plan-trial" className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="plan-trial" className="font-semibold">
            Free trial
          </h2>
          <p className="text-sm text-[var(--color-muted)]">
            With a trial, a new merchant can start this plan at sign-up without paying. The store goes live at once;
            they pay from Plan &amp; billing before the trial ends, and the paid period starts when the trial ends.
            Each person gets one trial, for their first store.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            current > 0 ? 'bg-[#e6f6f1] text-[#027a60]' : 'bg-[var(--color-bg)] text-[var(--color-muted)]'
          }`}
        >
          Now: {label(current)}
        </span>
      </div>
      <fieldset>
        <legend className="sr-only">Trial length</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                days === option ? 'border-[var(--color-accent)] bg-[var(--color-bg)] font-semibold' : 'border-[var(--color-border)]'
              }`}
            >
              <input
                type="radio"
                name={`trial-${plan.id}`}
                value={option}
                checked={days === option}
                onChange={() => setDays(option)}
                className="h-4 w-4"
              />
              {option === 0 ? 'Off' : `${option} days`}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="button" variant="secondary" disabled={busy || days === current} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save free trial'}
      </Button>
    </section>
  );
}
