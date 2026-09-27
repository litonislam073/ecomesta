import { billingCycleDefinition, parseBillingCycle, type BillingCycleCode } from '@ecomesta/utils';

/** Plan chosen on the pricing page, carried through register → onboard as `?plan=&interval=`. */
export interface PlanSelection {
  plan: string;
  cycle: BillingCycleCode;
}

const PLAN_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface ParamReader {
  get(name: string): string | null;
}

export function readPlanSelection(params: ParamReader): PlanSelection | null {
  const plan = params.get('plan')?.trim().toLowerCase() ?? '';
  if (!plan || plan.length > 120 || !PLAN_SLUG.test(plan)) return null;
  return { plan, cycle: parseBillingCycle(params.get('interval')) ?? 'MONTHLY' };
}

export function planSelectionQuery(selection: PlanSelection): string {
  const params = new URLSearchParams({
    plan: selection.plan,
    interval: billingCycleDefinition(selection.cycle).slug,
  });
  return params.toString();
}

export function withPlanSelection(path: string, selection: PlanSelection | null): string {
  if (!selection) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${planSelectionQuery(selection)}`;
}

/** Only same-app paths may be used as post-auth redirects. */
export function safeNextPath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }
  return value;
}
