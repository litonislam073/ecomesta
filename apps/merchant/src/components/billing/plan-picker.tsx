'use client';

import type { PublicPlan } from '@ecomesta/types';
import { BILLING_CYCLES, formatCyclePrice, type BillingCycleCode } from '@ecomesta/utils';
import type { PlanSelection } from '@/lib/plan-selection';

function planPrice(plan: PublicPlan, cycle: BillingCycleCode): number {
  return plan.prices.find((price) => price.billingCycle === cycle)?.amount ?? plan.monthlyPrice;
}

/** Plan + billing period choice; the plan is paid for in the next step. */
export function PlanPicker({
  plans,
  value,
  onChange,
  idPrefix,
}: {
  plans: PublicPlan[];
  value: PlanSelection;
  onChange: (next: PlanSelection) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-semibold text-[var(--color-ink)]">
          Billing period
        </legend>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-[var(--color-border)] bg-[#f4f7f5] p-1">
          {BILLING_CYCLES.map((cycle) => {
            const id = `${idPrefix}-cycle-${cycle.slug}`;
            const checked = value.cycle === cycle.code;
            return (
              <label
                key={cycle.code}
                htmlFor={id}
                className={`flex cursor-pointer flex-col items-center rounded-md px-2 py-1.5 text-center text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)] ${
                  checked ? 'bg-white font-semibold text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-muted)]'
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  name={`${idPrefix}-cycle`}
                  className="sr-only"
                  checked={checked}
                  onChange={() => onChange({ ...value, cycle: cycle.code })}
                />
                <span>{cycle.label}</span>
                {cycle.discountPercent > 0 ? (
                  <span className="text-xs font-medium text-[var(--color-accent)]">Save {cycle.discountPercent}%</span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-[var(--color-ink)]">Plan</legend>
        <div className="mt-2 grid gap-2">
          {plans.map((plan) => {
            const id = `${idPrefix}-plan-${plan.slug}`;
            const checked = value.plan === plan.slug;
            return (
              <label
                key={plan.slug}
                htmlFor={id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)] ${
                  checked ? 'border-[var(--color-accent)] bg-[#f1f8f5]' : 'border-[var(--color-border)] bg-white'
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  name={`${idPrefix}-plan`}
                  className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
                  checked={checked}
                  onChange={() => onChange({ ...value, plan: plan.slug })}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-semibold text-[var(--color-ink)]">{plan.name}</span>
                    <span className="text-sm text-[var(--color-ink)]">
                      {formatCyclePrice(planPrice(plan, value.cycle), value.cycle)}
                    </span>
                  </span>
                  {plan.tagline ? (
                    <span className="block text-sm text-[var(--color-muted)]">{plan.tagline}</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

export function defaultSelection(plans: PublicPlan[], preferred: PlanSelection | null): PlanSelection | null {
  if (plans.length === 0) return null;
  if (preferred && plans.some((plan) => plan.slug === preferred.plan)) return preferred;
  return { plan: plans[0]!.slug, cycle: preferred?.cycle ?? 'MONTHLY' };
}
