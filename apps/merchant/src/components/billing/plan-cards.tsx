'use client';

import type { PublicPlan } from '@ecomesta/types';
import { BILLING_CYCLES, formatBdt, type BillingCycleCode } from '@ecomesta/utils';

const PERIOD_SUFFIX: Record<BillingCycleCode, string> = {
  MONTHLY: '/month',
  SEMI_ANNUAL: '/6 months',
  YEARLY: '/year',
};

export function cyclePrice(plan: PublicPlan, cycle: BillingCycleCode) {
  return plan.prices.find((price) => price.billingCycle === cycle) ?? null;
}

/** Billing period switch (Monthly / 6 Months / Yearly) with the savings. */
export function CycleSwitch({
  value,
  onChange,
  idPrefix,
}: {
  value: BillingCycleCode;
  onChange: (cycle: BillingCycleCode) => void;
  idPrefix: string;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Billing period</legend>
      <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[#f4f7f5] p-1">
        {BILLING_CYCLES.map((cycle) => {
          const id = `${idPrefix}-cycle-${cycle.slug}`;
          const checked = value === cycle.code;
          return (
            <label
              key={cycle.code}
              htmlFor={id}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-accent)] ${
                checked ? 'bg-white font-semibold text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-muted)]'
              }`}
            >
              <input
                id={id}
                type="radio"
                name={`${idPrefix}-cycle`}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(cycle.code)}
              />
              {cycle.label}
              {cycle.discountPercent > 0 ? (
                <span className="rounded-full bg-[#e3f1ec] px-1.5 text-[11px] font-semibold text-[var(--color-accent)]">
                  −{cycle.discountPercent}%
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Side-by-side plan comparison; selecting a card picks the plan to pay for. */
export function PlanCards({
  plans,
  cycle,
  selected,
  currentSlug,
  onSelect,
  idPrefix,
}: {
  plans: PublicPlan[];
  cycle: BillingCycleCode;
  selected: string;
  currentSlug: string | null;
  onSelect: (slug: string) => void;
  idPrefix: string;
}) {
  return (
    <fieldset className="grid gap-4 md:grid-cols-3">
      <legend className="sr-only">Plan</legend>
      {plans.map((plan) => {
        const price = cyclePrice(plan, cycle);
        const amount = price?.amount ?? plan.monthlyPrice;
        const checked = plan.slug === selected;
        const id = `${idPrefix}-plan-${plan.slug}`;
        return (
          <label
            key={plan.slug}
            htmlFor={id}
            className={`relative flex cursor-pointer flex-col rounded-2xl border-2 bg-white p-5 transition-all has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)] ${
              checked
                ? 'border-[var(--color-accent)] shadow-[0_10px_30px_rgba(20,82,64,0.14)]'
                : 'border-[var(--color-border)] hover:border-[#bcd3c9]'
            }`}
          >
            <input
              id={id}
              type="radio"
              name={`${idPrefix}-plan`}
              className="sr-only"
              checked={checked}
              onChange={() => onSelect(plan.slug)}
            />
            <div className="flex min-h-6 flex-wrap gap-1.5">
              {plan.slug === currentSlug ? (
                <span className="rounded-full bg-[var(--color-ink)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Current plan
                </span>
              ) : null}
              {plan.highlighted ? (
                <span className="rounded-full bg-[#e3f1ec] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                  Most popular
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-lg font-semibold text-[var(--color-ink)]">{plan.name}</p>
            {plan.tagline ? <p className="text-sm text-[var(--color-muted)]">{plan.tagline}</p> : null}
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight text-[var(--color-ink)]">{formatBdt(amount)}</span>
              <span className="text-sm text-[var(--color-muted)]">{PERIOD_SUFFIX[cycle]}</span>
            </p>
            {price && price.months > 1 ? (
              <p className="text-xs text-[var(--color-muted)]">{formatBdt(price.effectiveMonthly)}/month · save {price.discountPercent}%</p>
            ) : (
              <p className="text-xs text-[var(--color-muted)]">Billed every month</p>
            )}
            <ul className="mt-4 flex-1 space-y-2 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-ink)]">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span aria-hidden="true" className="text-[var(--color-accent)]">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <span
              aria-hidden="true"
              className={`mt-5 flex h-10 items-center justify-center rounded-lg text-sm font-semibold ${
                checked ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-border)] text-[var(--color-ink)]'
              }`}
            >
              {checked ? 'Selected' : `Choose ${plan.name}`}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
