import { describe, expect, it } from 'vitest';
import type { PublicPlan } from '@ecomesta/types';
import { commonTrialDays, trialHeadline } from './trial';

const plans = (...days: number[]) => days.map((trialDays, i) => ({ slug: `p${i}`, trialDays }) as PublicPlan);

describe('marketing trial headline', () => {
  it('claims a trial on every plan only when every plan has the same one', () => {
    expect(commonTrialDays(plans(30, 30, 30))).toBe(30);
    expect(commonTrialDays(plans(30, 7, 30))).toBeNull();
    expect(commonTrialDays(plans(0, 0, 0))).toBeNull();
    expect(commonTrialDays([])).toBeNull();
  });

  it('says "1-month free trial" for 30 days in both languages', () => {
    expect(trialHeadline(plans(30, 30, 30), 'en')).toBe('1-month free trial on every plan');
    expect(trialHeadline(plans(30, 30, 30), 'bn')).toBe('সব প্যাকেজে ১ মাসের ফ্রি ট্রায়াল');
    expect(trialHeadline(plans(7, 7), 'en')).toBe('7-day free trial on every plan');
  });

  it('never claims a trial the plans do not have', () => {
    expect(trialHeadline(plans(0, 7, 0), 'en')).toBe('Free trial on selected plans');
    expect(trialHeadline(plans(0, 0, 0), 'en')).toBeNull();
    expect(trialHeadline(null, 'bn')).toBeNull();
  });
});
