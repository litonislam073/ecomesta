'use client';

import { useState } from 'react';
import type { PublicPlan } from '@ecomesta/types';
import { ButtonLink, CheckList } from '@ecomesta/ui/marketing';
import {
  BILLING_CYCLES,
  billingCycleDefinition,
  formatBdt,
  type BillingCycleCode,
} from '@ecomesta/utils';
import { StaggerContainer } from '../animations/stagger';
import { StaggerItem } from '../animations/stagger-item';

const PERIOD_SUFFIX: Record<BillingCycleCode, string> = {
  MONTHLY: '/month',
  SEMI_ANNUAL: '/ 6 months',
  YEARLY: '/year',
};

const PERIOD_WORDS: Record<BillingCycleCode, string> = {
  MONTHLY: 'per month',
  SEMI_ANNUAL: 'every 6 months',
  YEARLY: 'per year',
};

function priceFor(plan: PublicPlan, cycle: BillingCycleCode) {
  return plan.prices.find((price) => price.billingCycle === cycle) ?? null;
}

/** Register link carrying the choice through sign-up and store setup. */
export function planRegisterPath(plan: string, cycle: BillingCycleCode): string {
  const params = new URLSearchParams({ plan, interval: billingCycleDefinition(cycle).slug });
  return `/register?${params.toString()}`;
}

export function PricingPlans({
  plans,
  merchantOrigin,
}: {
  plans: PublicPlan[];
  merchantOrigin: string;
}) {
  const [cycle, setCycle] = useState<BillingCycleCode>('MONTHLY');
  const [switched, setSwitched] = useState(false);
  const cycleIndex = Math.max(
    0,
    BILLING_CYCLES.findIndex((option) => option.code === cycle),
  );

  return (
    <div>
      <fieldset className="mx-auto w-full max-w-md">
        <legend className="sr-only">Billing period</legend>
        <div className="relative grid grid-cols-3 gap-1 rounded-xl border border-[var(--color-border)] bg-white p-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-1 left-1 rounded-lg bg-[#10231e] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              width: 'calc((100% - 1rem) / 3)',
              transform: `translateX(calc(${cycleIndex} * (100% + 0.25rem)))`,
            }}
          />
          {BILLING_CYCLES.map((option) => {
            const checked = option.code === cycle;
            const id = `pricing-cycle-${option.slug}`;
            return (
              <label
                key={option.code}
                htmlFor={id}
                className={`relative flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center text-sm transition-colors duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)] ${
                  checked
                    ? 'font-semibold text-white'
                    : 'text-[var(--color-ink)] hover:bg-[#eef5f2]'
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  name="pricing-cycle"
                  value={option.slug}
                  className="sr-only"
                  checked={checked}
                  onChange={() => {
                    setCycle(option.code);
                    setSwitched(true);
                  }}
                />
                <span>{option.label}</span>
                {option.discountPercent > 0 ? (
                  <span className={`text-xs transition-colors duration-200 ${checked ? 'text-[#b9e4d3]' : 'text-[var(--color-accent)]'}`}>
                    Save {option.discountPercent}%
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <StaggerContainer as="ul" step={0.08} distance={20} className="mt-10 grid gap-6 lg:grid-cols-3" aria-label="Plans">
        {plans.map((plan) => {
          const price = priceFor(plan, cycle);
          const amount = price?.amount ?? plan.monthlyPrice;
          const headingId = `plan-${plan.slug}`;
          return (
            <StaggerItem
              as="li"
              key={plan.slug}
              aria-labelledby={headingId}
              className={`em-hover-lift relative flex min-w-0 flex-col rounded-2xl border bg-white p-6 sm:p-8 ${
                plan.highlighted ? 'border-2 border-[var(--color-accent)] shadow-lg' : 'border-[var(--color-border)]'
              }`}
            >
              {plan.highlighted ? (
                <p className="absolute -top-3 left-6 rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-white">
                  Most Popular
                </p>
              ) : null}
              <h3 id={headingId} className="font-display text-2xl tracking-tight text-[var(--color-ink)]">
                {plan.name}
              </h3>
              {plan.tagline || plan.description ? (
                <p className="mt-2 text-[var(--color-muted)]">{plan.tagline ?? plan.description}</p>
              ) : null}
              <p className="mt-5 inline-flex w-fit rounded-full bg-[#e3f1ec] px-3 py-1 text-sm font-semibold text-[var(--color-accent)]">
                {plan.trialMonths} Months Free
              </p>
              <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
                <span
                  key={switched ? cycle : undefined}
                  className={`inline-block font-display text-4xl tracking-tight text-[var(--color-ink)] ${switched ? 'em-price-in' : ''}`}
                >
                  {formatBdt(amount)}
                </span>
                <span className="text-[var(--color-muted)]">{PERIOD_SUFFIX[cycle]} after trial</span>
              </p>
              <p key={switched ? cycle : undefined} className={`mt-1 min-h-5 text-sm text-[var(--color-muted)] ${switched ? 'em-price-in' : ''}`}>
                {price && price.months > 1
                  ? `${formatBdt(Math.round(price.effectiveMonthly))}/month · Save ${price.discountPercent}%`
                  : 'Billed monthly after your trial'}
              </p>
              <ButtonLink
                href={`${merchantOrigin}${planRegisterPath(plan.slug, cycle)}`}
                variant={plan.highlighted ? 'primary' : 'secondary'}
                cta={`pricing-start-${plan.slug}`}
                className="mt-6 w-full"
              >
                Start {plan.trialMonths} Months Free
              </ButtonLink>
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Free for {plan.trialMonths} months. No payment details needed today. After the trial,
                you pay {formatBdt(amount)} {PERIOD_WORDS[cycle]} to keep your store online.
              </p>
              {plan.features.length > 0 ? (
                <CheckList className="mt-6 border-t border-[var(--color-border)] pt-6 text-sm" items={plan.features} />
              ) : null}
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </div>
  );
}
