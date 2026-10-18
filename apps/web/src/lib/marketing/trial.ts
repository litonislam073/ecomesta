import type { PublicPlan } from '@ecomesta/types';
import type { MarketingLocale } from '@ecomesta/ui/marketing';

/**
 * The free trial every plan shares, in days, or null when plans differ or have
 * none. Marketing copy reads it from the live plans, so it always matches
 * what the Super Admin has set.
 */
export function commonTrialDays(plans: PublicPlan[] | null | undefined): number | null {
  if (!plans || plans.length === 0) return null;
  const first = plans[0]!.trialDays;
  return first > 0 && plans.every((plan) => plan.trialDays === first) ? first : null;
}

/** True when at least one plan has a free trial. */
export function anyTrial(plans: PublicPlan[] | null | undefined): boolean {
  return Boolean(plans?.some((plan) => plan.trialDays > 0));
}

/** "1-month free trial" for 30 days, "7-day free trial" otherwise. */
export function trialLength(days: number, locale: MarketingLocale): string {
  if (locale === 'bn') return days === 30 ? '১ মাসের ফ্রি ট্রায়াল' : `${days.toLocaleString('bn-BD')} দিনের ফ্রি ট্রায়াল`;
  return days === 30 ? '1-month free trial' : `${days}-day free trial`;
}

/** The headline trial claim for the site, or null when no plan has a trial. */
export function trialHeadline(plans: PublicPlan[] | null | undefined, locale: MarketingLocale): string | null {
  const shared = commonTrialDays(plans);
  if (shared) {
    return locale === 'bn' ? `সব প্যাকেজে ${trialLength(shared, 'bn')}` : `${trialLength(shared, 'en')} on every plan`;
  }
  if (anyTrial(plans)) return locale === 'bn' ? 'কিছু প্যাকেজে ফ্রি ট্রায়াল' : 'Free trial on selected plans';
  return null;
}
