import type { Prisma, SubscriptionPlan } from '@prisma/client';
import type { PublicPlan } from '@ecomesta/types';
import {
  BILLING_CYCLES,
  DEFAULT_TRIAL_MONTHS,
  billingCyclePrice,
  effectiveMonthlyPrice,
} from '@ecomesta/utils';

/** Marketing and trial settings kept in `SubscriptionPlan.configuration`. */
export interface PlanSettings {
  trialMonths: number;
  tagline: string | null;
  features: string[];
  highlighted: boolean;
  sortOrder: number;
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readPlanSettings(configuration: Prisma.JsonValue | null): PlanSettings {
  const config = asRecord(configuration);
  const trialMonths = config.trialMonths;
  const sortOrder = config.sortOrder;
  return {
    trialMonths:
      typeof trialMonths === 'number' && Number.isInteger(trialMonths) && trialMonths >= 0 && trialMonths <= 24
        ? trialMonths
        : DEFAULT_TRIAL_MONTHS,
    tagline: typeof config.tagline === 'string' && config.tagline.trim() ? config.tagline.trim() : null,
    features: Array.isArray(config.features)
      ? config.features.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
    highlighted: config.highlighted === true,
    sortOrder: typeof sortOrder === 'number' && Number.isFinite(sortOrder) ? sortOrder : 0,
  };
}

export function planMonthlyPrice(plan: Pick<SubscriptionPlan, 'monthlyPrice'>): number {
  return Number(plan.monthlyPrice.toString());
}

export function toPublicPlan(plan: SubscriptionPlan): PublicPlan {
  const settings = readPlanSettings(plan.configuration);
  const monthlyPrice = planMonthlyPrice(plan);
  return {
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    tagline: settings.tagline,
    features: settings.features,
    highlighted: settings.highlighted,
    currency: 'BDT',
    monthlyPrice,
    trialMonths: settings.trialMonths,
    prices: BILLING_CYCLES.map((cycle) => ({
      billingCycle: cycle.code,
      amount: billingCyclePrice(monthlyPrice, cycle.code),
      months: cycle.months,
      discountPercent: cycle.discountPercent,
      effectiveMonthly: effectiveMonthlyPrice(monthlyPrice, cycle.code),
    })),
  };
}

export function sortPlans<T extends { configuration: Prisma.JsonValue | null; monthlyPrice: Prisma.Decimal }>(
  plans: T[],
): T[] {
  return [...plans].sort((a, b) => {
    const order = readPlanSettings(a.configuration).sortOrder - readPlanSettings(b.configuration).sortOrder;
    return order !== 0 ? order : Number(a.monthlyPrice) - Number(b.monthlyPrice);
  });
}
