'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { SubscriptionPlan } from '@ecomesta/types';
import { BILLING_CYCLES, billingCyclePrice, formatBdt } from '@ecomesta/utils';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export interface PlanFormState {
  name: string;
  slug: string;
  description: string;
  monthlyPrice: string;
  active: boolean;
}

export function emptyPlanForm(): PlanFormState {
  return {
    name: '',
    slug: '',
    description: '',
    monthlyPrice: '',
    active: true,
  };
}

export function planFormFromPlan(plan: SubscriptionPlan): PlanFormState {
  return {
    name: plan.name,
    slug: plan.slug,
    description: plan.description ?? '',
    monthlyPrice: plan.monthlyPrice,
    active: plan.active,
  };
}

export function PlanFormFields({
  form,
  setForm,
}: {
  form: PlanFormState;
  setForm: Dispatch<SetStateAction<PlanFormState>>;
}) {
  return (
    <>
      <label className="block space-y-1.5" htmlFor="plan-name">
        <span className="text-sm font-medium">Plan name</span>
        <Input
          id="plan-name"
          value={form.name}
          required
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
      </label>

      <label className="block space-y-1.5" htmlFor="plan-slug">
        <span className="text-sm font-medium">Plan slug</span>
        <Input
          id="plan-slug"
          value={form.slug}
          required
          onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
        />
      </label>

      <label className="block space-y-1.5" htmlFor="plan-description">
        <span className="text-sm font-medium">Description</span>
        <Input
          id="plan-description"
          value={form.description}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, description: e.target.value }))
          }
        />
      </label>

      <div className="space-y-1.5">
        <label className="block space-y-1.5" htmlFor="plan-monthly-price">
          <span className="text-sm font-medium">Monthly price (BDT)</span>
          <Input
            id="plan-monthly-price"
            inputMode="decimal"
            placeholder="999"
            value={form.monthlyPrice}
            required
            aria-describedby="plan-derived-prices"
            onChange={(e) =>
              setForm((prev) => ({ ...prev, monthlyPrice: e.target.value }))
            }
          />
        </label>
        <DerivedPrices monthly={form.monthlyPrice} />
      </div>

      <label className="block space-y-1.5" htmlFor="plan-active">
        <span className="text-sm font-medium">Availability</span>
        <Select
          id="plan-active"
          value={form.active ? 'true' : 'false'}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, active: e.target.value === 'true' }))
          }
        >
          <option value="true">Active — assignable to tenants</option>
          <option value="false">Inactive — hidden from new subscriptions</option>
        </Select>
      </label>
    </>
  );
}

/** 6-month and yearly prices are always derived from the monthly price. */
function DerivedPrices({ monthly }: { monthly: string }) {
  const amount = Number(monthly.trim());
  const valid = monthly.trim() !== '' && Number.isFinite(amount) && amount >= 0;
  return (
    <p id="plan-derived-prices" className="text-xs text-[var(--color-muted)]">
      {valid
        ? BILLING_CYCLES.filter((cycle) => cycle.months > 1)
            .map(
              (cycle) =>
                `${cycle.label}: ${formatBdt(billingCyclePrice(amount, cycle.code))} (save ${cycle.discountPercent}%)`,
            )
            .join(' · ')
        : '6-month and yearly prices are calculated from the monthly price.'}
    </p>
  );
}
