/**
 * Platform subscription billing rules shared by the API and the web apps.
 * The API stays authoritative; the web apps only use these for display.
 */

export type BillingCycleCode = 'MONTHLY' | 'SEMI_ANNUAL' | 'YEARLY';

/** Platform billing currency. Plan prices are stored in BDT. */
export const BILLING_CURRENCY = 'BDT';

/** All billing dates are calendar dates in Asia/Dhaka (UTC+6, no DST). */
export const BILLING_TIME_ZONE = 'Asia/Dhaka';
const BILLING_UTC_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Free months when a plan does not configure `trialMonths`. New stores no
 * longer get a free trial: they pay when they create the store. Subscriptions
 * already in a trial keep their own `trialEndsAt`.
 */
export const DEFAULT_TRIAL_MONTHS = 0;

/** Days after the trial (or a paid period) ends before the store is suspended. */
export const PAYMENT_GRACE_DAYS = 7;

export interface BillingCycleDefinition {
  code: BillingCycleCode;
  /** URL value used by the pricing page and registration links. */
  slug: 'monthly' | '6-months' | 'yearly';
  label: string;
  months: number;
  discountPercent: number;
}

export const BILLING_CYCLES: readonly BillingCycleDefinition[] = [
  { code: 'MONTHLY', slug: 'monthly', label: 'Monthly', months: 1, discountPercent: 0 },
  { code: 'SEMI_ANNUAL', slug: '6-months', label: '6 Months', months: 6, discountPercent: 10 },
  { code: 'YEARLY', slug: 'yearly', label: 'Yearly', months: 12, discountPercent: 25 },
];

export function billingCycleDefinition(code: BillingCycleCode): BillingCycleDefinition {
  const found = BILLING_CYCLES.find((cycle) => cycle.code === code);
  if (!found) {
    throw new Error(`Unknown billing cycle: ${String(code)}`);
  }
  return found;
}

export function isBillingCycleCode(value: unknown): value is BillingCycleCode {
  return BILLING_CYCLES.some((cycle) => cycle.code === value);
}

/** Accepts a URL slug (`6-months`) or an enum code (`SEMI_ANNUAL`), case-insensitively. */
export function parseBillingCycle(value: string | null | undefined): BillingCycleCode | null {
  const raw = value?.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const found = BILLING_CYCLES.find(
    (cycle) => cycle.slug === lower || cycle.code.toLowerCase() === lower,
  );
  return found?.code ?? null;
}

/**
 * Price for a whole billing period, derived from the monthly reference price:
 * `monthly × months × (100 − discount)%`, rounded to the nearest whole taka.
 */
export function billingCyclePrice(monthlyPrice: number | string, cycle: BillingCycleCode): number {
  const monthly = typeof monthlyPrice === 'number' ? monthlyPrice : Number.parseFloat(monthlyPrice);
  if (!Number.isFinite(monthly) || monthly < 0) {
    throw new Error('monthlyPrice must be a non-negative number');
  }
  const { months, discountPercent } = billingCycleDefinition(cycle);
  const paisa = Math.round(monthly * 100);
  return Math.round((paisa * months * (100 - discountPercent)) / 10000);
}

/** Effective per-month price for a billing period, rounded to whole taka. */
export function effectiveMonthlyPrice(monthlyPrice: number | string, cycle: BillingCycleCode): number {
  return Math.round(billingCyclePrice(monthlyPrice, cycle) / billingCycleDefinition(cycle).months);
}

/** `৳1,999` — whole-taka amounts with Bangladeshi digit grouping. */
export function formatBdt(amount: number): string {
  return `৳${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(amount))}`;
}

/** `৳999/month`, `৳2,695 / 6 months`, `৳4,491 / year`. */
export function formatCyclePrice(amount: number, cycle: BillingCycleCode): string {
  switch (cycle) {
    case 'MONTHLY':
      return `${formatBdt(amount)}/month`;
    case 'SEMI_ANNUAL':
      return `${formatBdt(amount)} / 6 months`;
    case 'YEARLY':
      return `${formatBdt(amount)} / year`;
  }
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Adds calendar months in Asia/Dhaka, keeping the wall-clock time. A day that
 * does not exist in the target month clamps to its last day (Dec 31 + 2 → Feb 28/29).
 */
export function addCalendarMonths(date: Date, months: number): Date {
  const local = new Date(date.getTime() + BILLING_UTC_OFFSET_MS);
  const totalMonths = local.getUTCFullYear() * 12 + local.getUTCMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const monthIndex = totalMonths - year * 12;
  const day = Math.min(local.getUTCDate(), daysInMonth(year, monthIndex));
  const shifted = Date.UTC(
    year,
    monthIndex,
    day,
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  );
  return new Date(shifted - BILLING_UTC_OFFSET_MS);
}

/** Asia/Dhaka has no DST, so calendar days are exactly 24 hours. */
export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function trialEndDate(startsAt: Date, trialMonths = DEFAULT_TRIAL_MONTHS): Date {
  return addCalendarMonths(startsAt, trialMonths);
}

/** Last moment the store stays usable without payment. */
export function paymentDeadline(dueFrom: Date): Date {
  return addCalendarDays(dueFrom, PAYMENT_GRACE_DAYS);
}

/** "November 28, 2026" in Asia/Dhaka regardless of the viewer's timezone. */
export function formatBillingDate(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BILLING_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(value);
}

export type SubscriptionStatusCode = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';

/**
 * Where a subscription is in its lifecycle right now:
 * TRIAL → GRACE (payment due, store usable) → LAPSED (suspension due) → SUSPENDED.
 * ACTIVE always wins: a paid subscription is never treated as lapsed.
 */
export type SubscriptionPhase = 'TRIAL' | 'GRACE' | 'LAPSED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

export interface SubscriptionTiming {
  status: SubscriptionStatusCode;
  trialEndsAt: Date | string | null;
  endsAt: Date | string | null;
}

function toDate(value: Date | string | null): Date | null {
  if (value === null) return null;
  return typeof value === 'string' ? new Date(value) : value;
}

/** When payment became due: end of the paid period, otherwise end of the trial. */
export function paymentDueFrom(timing: SubscriptionTiming): Date | null {
  return toDate(timing.endsAt) ?? toDate(timing.trialEndsAt);
}

export function subscriptionPhase(timing: SubscriptionTiming, now: Date = new Date()): SubscriptionPhase {
  switch (timing.status) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'EXPIRED':
      return 'SUSPENDED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'TRIALING':
    case 'PAST_DUE': {
      const dueFrom = paymentDueFrom(timing);
      if (!dueFrom) return timing.status === 'TRIALING' ? 'TRIAL' : 'GRACE';
      if (timing.status === 'TRIALING' && now.getTime() < dueFrom.getTime()) return 'TRIAL';
      return now.getTime() < paymentDeadline(dueFrom).getTime() ? 'GRACE' : 'LAPSED';
    }
    default:
      return 'CANCELLED';
  }
}
