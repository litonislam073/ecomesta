import type { Prisma, SubscriptionPlan } from '@prisma/client';
import type { PlanLimits, PublicPlan } from '@ecomesta/types';
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

/**
 * Limits from `configuration.limits`. A plan without a `limits` object
 * (e.g. an older or custom plan) restricts nothing.
 */
export function readPlanLimits(configuration: Prisma.JsonValue | null): PlanLimits | null {
  const raw = asRecord(configuration).limits;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const limits = raw as Record<string, unknown>;
  const flag = (key: string) => limits[key] === true;
  const count = (key: string) => {
    const value = limits[key];
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
  };
  return {
    maxProducts: count('maxProducts'),
    storageMb: count('storageMb'),
    customDomain: flag('customDomain'),
    onlinePayments: flag('onlinePayments'),
    stripe: flag('stripe'),
    coupons: flag('coupons'),
    deliveryZones: flag('deliveryZones'),
    allThemes: flag('allThemes'),
    premiumThemes: flag('premiumThemes'),
    marketingTracking: flag('marketingTracking'),
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
    limits: readPlanLimits(plan.configuration),
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
