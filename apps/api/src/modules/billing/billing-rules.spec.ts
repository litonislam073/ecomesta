import { Prisma, SubscriptionStatus, type SubscriptionPlan } from '@prisma/client';
import {
  addCalendarMonths,
  billingCyclePrice,
  formatBillingDate,
  parseBillingCycle,
  paymentDeadline,
  subscriptionPhase,
  trialEndDate,
  type BillingCycleCode,
} from '@ecomesta/utils';
import { readPlanSettings, sortPlans, toPublicPlan } from './plan-catalog';
import { SubscriptionLifecycleScheduler } from './subscription-lifecycle.scheduler';
import { pickCurrent } from './subscription-lifecycle.service';

/** Midnight Asia/Dhaka on the given calendar date. */
const dhaka = (date: string) => new Date(`${date}T00:00:00+06:00`);

describe('plan prices', () => {
  it.each<[number, BillingCycleCode, number]>([
    [499, 'MONTHLY', 499],
    [499, 'SEMI_ANNUAL', 2695],
    [499, 'YEARLY', 4491],
    [999, 'MONTHLY', 999],
    [999, 'SEMI_ANNUAL', 5395],
    [999, 'YEARLY', 8991],
    [1999, 'MONTHLY', 1999],
    [1999, 'SEMI_ANNUAL', 10795],
    [1999, 'YEARLY', 17991],
  ])('৳%d %s → ৳%d', (monthly, cycle, expected) => {
    expect(billingCyclePrice(monthly, cycle)).toBe(expected);
    expect(billingCyclePrice(`${monthly}.00`, cycle)).toBe(expected);
  });

  it('rejects negative prices', () => {
    expect(() => billingCyclePrice(-1, 'MONTHLY')).toThrow();
  });

  it('parses URL slugs and enum codes', () => {
    expect(parseBillingCycle('6-months')).toBe('SEMI_ANNUAL');
    expect(parseBillingCycle('YEARLY')).toBe('YEARLY');
    expect(parseBillingCycle('monthly')).toBe('MONTHLY');
    expect(parseBillingCycle('weekly')).toBeNull();
    expect(parseBillingCycle(undefined)).toBeNull();
  });
});

// A plan's free trial (set by a Super Admin, e.g. 7 or 30 days) ends after
// that many Asia/Dhaka calendar days.
describe('trial dates (Asia/Dhaka calendar days)', () => {
  it('has no free days by default', () => {
    expect(trialEndDate(dhaka('2026-09-28'))).toEqual(dhaka('2026-09-28'));
  });

  it('ends 7 or 30 calendar days after the start', () => {
    expect(trialEndDate(dhaka('2026-09-28'), 7)).toEqual(dhaka('2026-10-05'));
    expect(formatBillingDate(trialEndDate(dhaka('2026-09-28'), 7))).toBe('October 5, 2026');
    expect(trialEndDate(dhaka('2026-09-28'), 30)).toEqual(dhaka('2026-10-28'));
    expect(trialEndDate(dhaka('2027-02-15'), 30)).toEqual(dhaka('2027-03-17'));
  });

  it('still clamps calendar months for paid periods', () => {
    expect(addCalendarMonths(dhaka('2027-03-31'), -1)).toEqual(dhaka('2027-02-28'));
  });

  it('uses the Dhaka date even when the UTC date is different', () => {
    // 01:30 on Oct 1 in Dhaka is still Sep 30 in UTC.
    const start = new Date('2026-09-30T19:30:00.000Z');
    expect(trialEndDate(start, 7).toISOString()).toBe('2026-10-07T19:30:00.000Z');
    expect(formatBillingDate(trialEndDate(start, 7))).toBe('October 8, 2026');
  });

  it('gives a 7-day payment grace period after the trial', () => {
    expect(paymentDeadline(dhaka('2026-11-28'))).toEqual(dhaka('2026-12-05'));
  });
});

describe('subscription phase', () => {
  const trialEndsAt = dhaka('2026-11-28');
  const timing = (status: SubscriptionStatus, endsAt: Date | null = null) => ({ status, trialEndsAt, endsAt });

  it('moves TRIAL → GRACE → LAPSED on the calendar', () => {
    expect(subscriptionPhase(timing('TRIALING'), dhaka('2026-11-27'))).toBe('TRIAL');
    expect(subscriptionPhase(timing('TRIALING'), dhaka('2026-11-28'))).toBe('GRACE');
    expect(subscriptionPhase(timing('PAST_DUE'), dhaka('2026-12-04'))).toBe('GRACE');
    expect(subscriptionPhase(timing('PAST_DUE'), dhaka('2026-12-05'))).toBe('LAPSED');
    expect(subscriptionPhase(timing('TRIALING'), dhaka('2027-01-01'))).toBe('LAPSED');
  });

  it('never treats a paid subscription as lapsed', () => {
    expect(subscriptionPhase(timing('ACTIVE', dhaka('2026-01-01')), dhaka('2027-06-01'))).toBe('ACTIVE');
  });

  it('maps ended statuses', () => {
    expect(subscriptionPhase(timing('EXPIRED'))).toBe('SUSPENDED');
    expect(subscriptionPhase(timing('CANCELLED'))).toBe('CANCELLED');
  });

  it('measures grace from the end of a paid period when there is one', () => {
    const paidUntil = dhaka('2027-05-28');
    expect(subscriptionPhase(timing('PAST_DUE', paidUntil), dhaka('2027-06-01'))).toBe('GRACE');
    expect(subscriptionPhase(timing('PAST_DUE', paidUntil), dhaka('2027-06-04'))).toBe('LAPSED');
  });
});

describe('plan catalog', () => {
  const plan = (slug: string, monthly: string, configuration: Prisma.JsonValue | null): SubscriptionPlan => ({
    id: '00000000-0000-4000-8000-000000000000',
    name: slug,
    slug,
    description: null,
    monthlyPrice: new Prisma.Decimal(monthly),
    yearlyPrice: new Prisma.Decimal('0'),
    active: true,
    configuration,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('builds public prices from the monthly price without exposing ids', () => {
    const dto = toPublicPlan(plan('growth', '999.00', { trialDays: 7, highlighted: true, features: ['A', 3] }));
    expect(dto).not.toHaveProperty('id');
    expect(dto.trialDays).toBe(7);
    expect(dto.currency).toBe('BDT');
    expect(dto.highlighted).toBe(true);
    expect(dto.features).toEqual(['A']);
    expect(dto.prices.map((p) => [p.billingCycle, p.amount, p.discountPercent])).toEqual([
      ['MONTHLY', 999, 0],
      ['SEMI_ANNUAL', 5395, 10],
      ['YEARLY', 8991, 25],
    ]);
  });

  it('defaults to no free trial and ignores invalid settings', () => {
    expect(readPlanSettings(null).trialDays).toBe(0);
    expect(readPlanSettings({ trialDays: -1 }).trialDays).toBe(0);
    expect(readPlanSettings({ trialDays: 1.5 }).trialDays).toBe(0);
    expect(readPlanSettings({ trialDays: 91 }).trialDays).toBe(0);
    expect(readPlanSettings({ trialDays: 7 }).trialDays).toBe(7);
    expect(readPlanSettings({ trialDays: 30 }).trialDays).toBe(30);
    // The old month-based setting no longer gives a trial.
    expect(readPlanSettings({ trialMonths: 2 }).trialDays).toBe(0);
  });

  it('sorts by configured order, then price', () => {
    const sorted = sortPlans([
      plan('business', '1999', { sortOrder: 3 }),
      plan('starter', '499', { sortOrder: 1 }),
      plan('growth', '999', { sortOrder: 2 }),
    ]);
    expect(sorted.map((p) => p.slug)).toEqual(['starter', 'growth', 'business']);
  });
});

describe('current subscription selection', () => {
  const row = (status: SubscriptionStatus, createdAt: string) => ({ status, createdAt: new Date(createdAt) });

  it('prefers paid, then pending, then ended subscriptions', () => {
    expect(
      pickCurrent([row('EXPIRED', '2026-03-01'), row('ACTIVE', '2026-01-01'), row('TRIALING', '2026-02-01')])?.status,
    ).toBe('ACTIVE');
    expect(pickCurrent([row('CANCELLED', '2026-03-01'), row('EXPIRED', '2026-01-01')])?.status).toBe('EXPIRED');
    expect(pickCurrent([])).toBeNull();
  });
});

describe('subscription scheduler', () => {
  function scheduler(evaluateDue: jest.Mock, env: Record<string, string | undefined> = {}) {
    const config = { get: (key: string) => env[key] };
    return new SubscriptionLifecycleScheduler({ evaluateDue } as never, config as never);
  }

  it('never overlaps runs', async () => {
    let release: () => void = () => undefined;
    const evaluateDue = jest.fn(
      () => new Promise((resolve) => (release = () => resolve({ movedToGrace: 0, suspended: 0, storesSuspended: 0 }))),
    );
    const instance = scheduler(evaluateDue);
    const first = instance.runOnce();
    await instance.runOnce();
    expect(evaluateDue).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  it('survives an evaluation failure', async () => {
    const evaluateDue = jest.fn().mockRejectedValue(new Error('db down'));
    await expect(scheduler(evaluateDue).runOnce()).resolves.toBeUndefined();
  });

  it('does not start timers under NODE_ENV=test or when disabled', () => {
    const spy = jest.spyOn(global, 'setInterval');
    scheduler(jest.fn(), { NODE_ENV: 'test' }).onApplicationBootstrap();
    scheduler(jest.fn(), { NODE_ENV: 'development', SUBSCRIPTION_EVALUATION_INTERVAL_MS: '0' }).onApplicationBootstrap();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
