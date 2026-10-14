'use client';

import { useState } from 'react';
import type { SubscriptionPlan } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

type Config = Record<string, unknown> & { limits?: Record<string, unknown> };

/**
 * Landing pages on a plan: on or off, and how many pages a business may have
 * (empty = unlimited). Saved into the plan's `configuration.limits`; every
 * other setting of the plan is kept as it is.
 */
export function PlanLandingLimits({ plan, onSaved }: { plan: SubscriptionPlan; onSaved: () => void }) {
  const { pushToast } = useToast();
  const config = (plan.configuration ?? {}) as Config;
  const limits = config.limits;
  const [enabled, setEnabled] = useState(limits?.landingPages === true);
  const [max, setMax] = useState(typeof limits?.maxLandingPages === 'number' ? String(limits.maxLandingPages) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!limits) {
    return (
      <section aria-labelledby="plan-landing" className="space-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 id="plan-landing" className="font-semibold">
          Landing pages
        </h2>
        <p className="text-sm text-[var(--color-muted)]">This plan sets no limits, so its businesses can build unlimited landing pages.</p>
      </section>
    );
  }

  async function save() {
    const trimmed = max.trim();
    if (enabled && trimmed && !/^\d{1,4}$/.test(trimmed)) {
      setError('Enter a whole number of pages, or leave it empty for unlimited.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.patch(`/admin/plans/${plan.id}`, {
        configuration: {
          ...config,
          limits: { ...limits, landingPages: enabled, maxLandingPages: enabled ? (trimmed ? Number(trimmed) : null) : 0 },
        },
      });
      pushToast('Landing page limits saved', 'success');
      onSaved();
    } catch (err) {
      const message = humanApiError(err, 'Could not save the limits');
      setError(message);
      pushToast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="plan-landing" className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div>
        <h2 id="plan-landing" className="font-semibold">
          Landing pages
        </h2>
        <p className="text-sm text-[var(--color-muted)]">One-page offers with their own order form. Existing pages stay; over the limit, a business cannot add more.</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
        Included in this plan
      </label>
      {enabled ? (
        <label className="block max-w-xs space-y-1 text-sm">
          <span className="block font-medium">Pages per business</span>
          <Input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Unlimited" />
          <span className="block text-xs text-[var(--color-muted)]">Leave empty for unlimited.</span>
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save landing page limits'}
      </Button>
    </section>
  );
}
