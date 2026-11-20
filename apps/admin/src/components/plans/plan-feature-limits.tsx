'use client';

import { useState } from 'react';
import type { SubscriptionPlan } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { useToast } from '@/components/ui/toast';
import { humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

type Config = Record<string, unknown> & { limits?: Record<string, unknown> };

const FEATURES = [
  {
    key: 'customDomain',
    label: 'Custom domain',
    hint: 'Connect a domain the business owns (or buys) to its store. Every store keeps its free Ecomesta address.',
  },
  {
    key: 'allThemes',
    label: 'All free themes',
    hint: 'Default and Minimal. Without it, the store uses the Default theme only.',
  },
  {
    key: 'premiumThemes',
    label: 'Premium themes',
    hint: 'ShopEase and Kenakata without buying them. Without it, the business can still buy a premium theme.',
  },
] as const;

type FeatureKey = (typeof FEATURES)[number]['key'];

/**
 * On/off features of a plan (custom domain, themes). Saved into the plan's
 * `configuration.limits`; every other setting of the plan is kept.
 */
export function PlanFeatureLimits({ plan, onSaved }: { plan: SubscriptionPlan; onSaved: () => void }) {
  const { pushToast } = useToast();
  const config = (plan.configuration ?? {}) as Config;
  const limits = config.limits;
  const saved = Object.fromEntries(FEATURES.map((f) => [f.key, limits?.[f.key] === true])) as Record<FeatureKey, boolean>;
  const [values, setValues] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!limits) {
    return (
      <section aria-labelledby="plan-features" className="space-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 id="plan-features" className="font-semibold">
          Plan features
        </h2>
        <p className="text-sm text-[var(--color-muted)]">This plan sets no limits, so its businesses get every feature.</p>
      </section>
    );
  }

  const changed = FEATURES.some((f) => values[f.key] !== saved[f.key]);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await api.patch(`/admin/plans/${plan.id}`, {
        configuration: { ...config, limits: { ...limits, ...values } },
      });
      pushToast('Plan features saved', 'success');
      onSaved();
    } catch (err) {
      const message = humanApiError(err, 'Could not save the plan features');
      setError(message);
      pushToast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="plan-features" className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div>
        <h2 id="plan-features" className="font-semibold">
          Plan features
        </h2>
        <p className="text-sm text-[var(--color-muted)]">What businesses on this plan can use. Changes apply to them straight away.</p>
      </div>
      <ul className="space-y-3">
        {FEATURES.map((feature) => (
          <li key={feature.key}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={values[feature.key]}
                aria-describedby={`plan-feature-${feature.key}`}
                onChange={(e) => setValues((prev) => ({ ...prev, [feature.key]: e.target.checked }))}
              />
              <span className="font-medium">{feature.label}</span>
            </label>
            <p id={`plan-feature-${feature.key}`} className="ml-6 text-xs text-[var(--color-muted)]">
              {feature.hint}
            </p>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <Button type="button" variant="secondary" disabled={busy || !changed} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save plan features'}
      </Button>
    </section>
  );
}
