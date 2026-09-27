/**
 * Local QA only: moves a QA tenant's subscription dates so the trial → grace →
 * suspension lifecycle can be exercised without waiting two months. It only
 * rewrites dates (and resets status for `trial`); the API's own lifecycle
 * evaluation then moves the subscription and stores, exactly as in real use.
 *
 *   NODE_ENV=development QA_EMAIL=billing-qa-growth-20260928@example.com \
 *     QA_PHASE=grace pnpm --filter @ecomesta/api qa:subscription-clock
 *
 * QA_PHASE:
 *   trial   trial started today (TRIALING, trial ends in the plan's trial months)
 *   grace   trial ended yesterday (payment due, inside the 7-day grace period)
 *   lapsed  trial ended 8 days ago (grace period over → store is suspended)
 *
 * Refuses to run outside the local `ecomesta` database or for accounts not
 * listed in qa-local-guard.ts.
 */
import { PrismaClient, SubscriptionStatus } from '@prisma/client';
import { addCalendarDays, addCalendarMonths, DEFAULT_TRIAL_MONTHS } from '@ecomesta/utils';
import { QA_ACCOUNTS, checkEnvironment, fail } from './qa-local-guard';

const PHASES = ['trial', 'grace', 'lapsed'] as const;
type Phase = (typeof PHASES)[number];

function trialMonthsOf(configuration: unknown): number {
  const value = (configuration as { trialMonths?: unknown } | null)?.trialMonths;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : DEFAULT_TRIAL_MONTHS;
}

async function main(): Promise<void> {
  checkEnvironment();
  const email = process.env.QA_EMAIL?.trim().toLowerCase() ?? '';
  const phase = process.env.QA_PHASE?.trim().toLowerCase() as Phase;
  if (!PHASES.includes(phase)) {
    fail(`QA_PHASE must be one of ${PHASES.join(', ')}`);
  }
  const account = QA_ACCOUNTS.find((item) => item.email === email);
  if (!account?.slug) {
    fail('QA_EMAIL must be one of the onboarded QA accounts in qa-local-guard.ts');
  }

  const prisma = new PrismaClient();
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: account.slug },
      select: {
        id: true,
        memberships: { select: { user: { select: { email: true } } } },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, plan: { select: { configuration: true } } },
        },
      },
    });
    if (!tenant) fail(`tenant ${account.slug} not found`);
    if (!tenant.memberships.some((m) => m.user.email === email)) {
      fail(`tenant ${account.slug} is not owned by ${email}`);
    }
    const subscription = tenant.subscriptions[0];
    if (!subscription) fail(`tenant ${account.slug} has no subscription`);

    const now = new Date();
    const months = trialMonthsOf(subscription.plan.configuration);
    const trialEndsAt =
      phase === 'trial'
        ? addCalendarMonths(now, months)
        : addCalendarDays(now, phase === 'grace' ? -1 : -8);
    const startsAt = phase === 'trial' ? now : addCalendarMonths(trialEndsAt, -months);

    if (phase === 'trial' && subscription.status !== SubscriptionStatus.TRIALING) {
      fail(`subscription is ${subscription.status}; only a TRIALING subscription can be reset to trial`);
    }
    if (subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.CANCELLED) {
      fail(`subscription is ${subscription.status}; paid or cancelled subscriptions are left alone`);
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { startsAt, trialEndsAt, endsAt: null },
    });
    console.log(`\n${account.slug}: phase=${phase}`);
    console.log(`  status:      ${subscription.status} (the API evaluates the next step)`);
    console.log(`  startsAt:    ${startsAt.toISOString()}`);
    console.log(`  trialEndsAt: ${trialEndsAt.toISOString()}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
