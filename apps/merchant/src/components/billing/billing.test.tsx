import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MerchantSubscription, PublicPlan } from '@ecomesta/types';
import { SubscriptionBanner, SuspendedScreen } from '@/components/billing/subscription-notices';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import BillingView from '@/app/dashboard/billing/billing-view';

const get = vi.fn();
const post = vi.fn();
const replace = vi.fn();
const nav = { pathname: '/dashboard', search: new URLSearchParams() };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.search,
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => get(...args),
      post: (...args: unknown[]) => post(...args),
    },
  };
});

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      email: 'owner@example.com',
      firstName: 'Owner',
      lastName: 'One',
      memberships: { tenants: [{ tenantId: 't1', role: 'OWNER' }], stores: [{ storeId: 's1' }] },
    },
    loading: false,
    accessToken: 'token',
    logout: vi.fn(),
  }),
}));

vi.mock('@/components/dashboard/sidebar-nav', () => ({ SidebarNav: () => null }));
vi.mock('@/components/dashboard/store-selector', () => ({ StoreSelector: () => null }));
vi.mock('@/components/dashboard/view-store-link', () => ({ ViewStoreLink: () => null }));

type Sub = NonNullable<MerchantSubscription['subscription']>;

function subscription(overrides: Partial<Sub> = {}, top: Partial<MerchantSubscription> = {}): MerchantSubscription {
  return {
    tenantName: 'Demo Shop',
    canManage: true,
    onlinePaymentAvailable: false,
    ...top,
    subscription: {
      status: 'TRIALING',
      phase: 'TRIAL',
      billingCycle: 'MONTHLY',
      startsAt: '2026-09-27T18:00:00.000Z',
      trialEndsAt: '2026-11-27T18:00:00.000Z',
      endsAt: null,
      paymentDueBy: '2026-12-04T18:00:00.000Z',
      currency: 'BDT',
      amountDue: 999,
      plan: { name: 'Growth', slug: 'growth', monthlyPrice: 999, trialMonths: 2 },
      ...overrides,
    },
  };
}

const PLANS: PublicPlan[] = [
  { slug: 'starter', name: 'Starter', monthly: 499, y6: 2695, y12: 4491 },
  { slug: 'growth', name: 'Growth', monthly: 999, y6: 5395, y12: 8991 },
  { slug: 'business', name: 'Business', monthly: 1999, y6: 10795, y12: 17991 },
].map((p) => ({
  name: p.name,
  slug: p.slug,
  description: null,
  tagline: null,
  features: [],
  highlighted: p.slug === 'growth',
  currency: 'BDT',
  monthlyPrice: p.monthly,
  trialMonths: 2,
  prices: [
    { billingCycle: 'MONTHLY', amount: p.monthly, months: 1, discountPercent: 0, effectiveMonthly: p.monthly },
    { billingCycle: 'SEMI_ANNUAL', amount: p.y6, months: 6, discountPercent: 10, effectiveMonthly: p.y6 / 6 },
    { billingCycle: 'YEARLY', amount: p.y12, months: 12, discountPercent: 25, effectiveMonthly: p.y12 / 12 },
  ],
}));

function mockApi(data: MerchantSubscription) {
  get.mockImplementation((path: string) =>
    Promise.resolve({ success: true, data: path === '/public/plans' ? PLANS : data }),
  );
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  replace.mockReset();
  nav.pathname = '/dashboard';
  nav.search = new URLSearchParams();
});

afterEach(() => cleanup());

describe('Subscription notices', () => {
  it('shows the trial end date on the dashboard home', () => {
    render(<SubscriptionBanner data={subscription()} showTrial />);
    expect(screen.getByText('2 Months Free')).toBeInTheDocument();
    expect(screen.getByText(/Your free trial\s+ends on November 28, 2026/)).toBeInTheDocument();
  });

  it('shows the grace-period notice with plan, cycle, amount due and deadline', () => {
    render(
      <SubscriptionBanner
        data={subscription({ status: 'PAST_DUE', phase: 'GRACE', billingCycle: 'YEARLY', amountDue: 8991 })}
        showTrial={false}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Your trial has ended' })).toBeInTheDocument();
    expect(screen.getByText(/7-day payment grace period/)).toHaveTextContent('Payment due by December 5, 2026.');
    expect(screen.getByText(/Growth plan · Yearly · Amount due ৳8,991/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pay now' })).toHaveAttribute('href', '/dashboard/billing');
  });

  it('suspended screen offers Pay & Reactivate without pretending to take payment', async () => {
    const user = userEvent.setup();
    render(<SuspendedScreen data={subscription({ status: 'EXPIRED', phase: 'SUSPENDED' })} />);
    expect(screen.getByRole('heading', { name: 'Your store is suspended' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your 7-day payment grace period has ended. Complete your payment to reactivate your store.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pay & Reactivate' }));
    const region = screen.getByRole('region', { name: 'How to pay' });
    expect(region).toHaveTextContent('not available in the dashboard yet');
    expect(region).not.toHaveTextContent(/success/i);
    expect(post).not.toHaveBeenCalled();
  });

  it('staff without billing rights see who can pay instead of a payment button', () => {
    render(
      <SuspendedScreen data={subscription({ status: 'EXPIRED', phase: 'SUSPENDED' }, { canManage: false })} />,
    );
    expect(screen.queryByRole('button', { name: 'Pay & Reactivate' })).not.toBeInTheDocument();
    expect(screen.getByText(/Only the account owner or an admin/)).toBeInTheDocument();
  });
});

describe('Dashboard subscription gate', () => {
  it('replaces dashboard pages with the suspended screen', async () => {
    mockApi(subscription({ status: 'EXPIRED', phase: 'SUSPENDED' }));
    nav.pathname = '/dashboard/products';
    render(
      <DashboardShell>
        <p>Products page</p>
      </DashboardShell>,
    );
    expect(await screen.findByRole('heading', { name: 'Your store is suspended' })).toBeInTheDocument();
    expect(screen.queryByText('Products page')).not.toBeInTheDocument();
  });

  it('keeps Plan & billing reachable while suspended', async () => {
    mockApi(subscription({ status: 'EXPIRED', phase: 'SUSPENDED' }));
    nav.pathname = '/dashboard/billing';
    render(
      <DashboardShell>
        <p>Billing page</p>
      </DashboardShell>,
    );
    await waitFor(() => expect(get).toHaveBeenCalledWith('/billing/subscription', expect.anything()));
    expect(screen.getByText('Billing page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your store is suspended' })).not.toBeInTheDocument();
  });

  it('keeps pages usable during the grace period under a payment notice', async () => {
    mockApi(subscription({ status: 'PAST_DUE', phase: 'GRACE' }));
    nav.pathname = '/dashboard/orders';
    render(
      <DashboardShell>
        <p>Orders page</p>
      </DashboardShell>,
    );
    expect(await screen.findByRole('heading', { name: 'Your trial has ended' })).toBeInTheDocument();
    expect(screen.getByText('Orders page')).toBeInTheDocument();
  });
});

describe('Plan & billing page', () => {
  function renderBilling(data: MerchantSubscription) {
    mockApi(data);
    nav.pathname = '/dashboard/billing';
    return render(
      <DashboardShell>
        <BillingView />
      </DashboardShell>,
    );
  }

  it('shows the trial plan, end date and post-trial price with no payment due today', async () => {
    renderBilling(subscription());
    expect(await screen.findByText('Growth Plan')).toBeInTheDocument();
    expect(screen.getByText('Your free trial ends on November 28, 2026.')).toBeInTheDocument();
    expect(screen.getByText(/No payment is needed today\. ৳999\/month after the trial/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bt1\b|\bs1\b/);
  });

  it('shows the suspended state with Pay & Reactivate', async () => {
    renderBilling(subscription({ status: 'EXPIRED', phase: 'SUSPENDED', amountDue: 999 }));
    expect(await screen.findByRole('button', { name: 'Pay & Reactivate' })).toBeInTheDocument();
    expect(screen.getByText('Amount due')).toBeInTheDocument();
  });

  it('drops free-trial wording from the plan picker once the trial is over', async () => {
    renderBilling(subscription({ status: 'EXPIRED', phase: 'SUSPENDED', amountDue: 999 }));
    expect(await screen.findByText('Choose the plan and billing period you want to pay for.')).toBeInTheDocument();
    expect(screen.getByText('Billing period')).toBeInTheDocument();
    expect(screen.queryByText(/after trial/)).not.toBeInTheDocument();
    expect(screen.queryByText(/months free/)).not.toBeInTheDocument();
  });

  it('starts a free trial with the plan and interval from the pricing page', async () => {
    const user = userEvent.setup();
    nav.search = new URLSearchParams('plan=business&interval=6-months');
    const none: MerchantSubscription = { ...subscription(), subscription: null };
    post.mockResolvedValue({ success: true, data: subscription() });
    renderBilling(none);

    const business = await screen.findByRole('radio', { name: /Business/ });
    expect(business).toBeChecked();
    expect(screen.getByRole('radio', { name: /6 Months/ })).toBeChecked();
    expect(screen.getByText('৳10,795 / 6 months')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start 2 Months Free' }));
    expect(post).toHaveBeenCalledWith(
      '/billing/subscription',
      { planSlug: 'business', billingCycle: 'SEMI_ANNUAL' },
      { token: 'token' },
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Your 2-month free trial has started.');
  });

  it('does not offer plan changes on a paid subscription', async () => {
    renderBilling(subscription({ status: 'ACTIVE', phase: 'ACTIVE', endsAt: '2027-01-27T18:00:00.000Z' }));
    expect(await screen.findByText(/paid through January 28, 2027/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update plan' })).not.toBeInTheDocument();
  });
});
