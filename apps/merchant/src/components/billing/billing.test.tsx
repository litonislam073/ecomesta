import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ManualPaymentAccount, MerchantBillingPayment, MerchantSubscription, PublicPlan } from '@ecomesta/types';
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
    awaitingFirstPayment: false,
    onlinePaymentAvailable: false,
    pendingPayment: null,
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
      plan: { name: 'Growth', slug: 'growth', monthlyPrice: 999, trialMonths: 2, limits: null },
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
  limits: null,
  prices: [
    { billingCycle: 'MONTHLY', amount: p.monthly, months: 1, discountPercent: 0, effectiveMonthly: p.monthly },
    { billingCycle: 'SEMI_ANNUAL', amount: p.y6, months: 6, discountPercent: 10, effectiveMonthly: p.y6 / 6 },
    { billingCycle: 'YEARLY', amount: p.y12, months: 12, discountPercent: 25, effectiveMonthly: p.y12 / 12 },
  ],
}));

const ACCOUNTS: ManualPaymentAccount[] = [
  { method: 'BKASH', label: 'bKash', number: '01309093407', transferType: 'Send Money' },
  { method: 'NAGAD', label: 'Nagad', number: '01309093407', transferType: 'Send Money' },
  { method: 'ROCKET', label: 'Rocket', number: '01757591788', transferType: 'Send Money' },
  { method: 'UPAY', label: 'Upay', number: '01318090622', transferType: 'Send Money' },
];

function payment(overrides: Partial<MerchantBillingPayment> = {}): MerchantBillingPayment {
  return {
    id: 'pay-1',
    planName: 'Growth',
    planSlug: 'growth',
    billingCycle: 'MONTHLY',
    amount: 999,
    currency: 'BDT',
    method: 'BKASH',
    senderNumber: '01712345678',
    transactionId: 'ABC123XYZ',
    status: 'PENDING',
    rejectionReason: null,
    createdAt: '2026-10-01T06:00:00.000Z',
    reviewedAt: null,
    ...overrides,
  };
}

function mockApi(data: MerchantSubscription, payments: MerchantBillingPayment[] = []) {
  get.mockImplementation((path: string) =>
    Promise.resolve({
      success: true,
      data:
        path === '/public/plans'
          ? PLANS
          : path === '/billing/payment-accounts'
            ? ACCOUNTS
            : path === '/billing/payments'
              ? payments
              : data,
    }),
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
    expect(screen.getByText('Free trial')).toBeInTheDocument();
    expect(screen.getByText(/Your free trial\s+ends on November 28, 2026/)).toBeInTheDocument();
  });

  it('shows the grace-period notice with plan, cycle, amount due and deadline', () => {
    render(
      <SubscriptionBanner
        data={subscription({ status: 'PAST_DUE', phase: 'GRACE', billingCycle: 'YEARLY', amountDue: 8991 })}
        showTrial={false}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Payment due' })).toBeInTheDocument();
    expect(screen.getByText(/7-day payment grace period/)).toHaveTextContent('Payment due by December 5, 2026.');
    expect(screen.getByText(/Growth plan · Yearly · Amount due ৳8,991/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pay now' })).toHaveAttribute('href', '/dashboard/billing');
  });

  it('tells a new store it is offline until its sign-up payment is confirmed', () => {
    const awaiting = { ...subscription(), subscription: null, awaitingFirstPayment: true };
    const { unmount } = render(<SubscriptionBanner data={{ ...awaiting, pendingPayment: payment() }} showTrial />);
    expect(screen.getByRole('heading', { name: 'Your store is not live yet' })).toBeInTheDocument();
    expect(screen.getByText(/We are confirming your payment/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pay now' })).not.toBeInTheDocument();
    unmount();

    // The payment was rejected: there is nothing under review, so pay again.
    render(<SubscriptionBanner data={awaiting} showTrial />);
    expect(screen.getByText(/Pay for your plan to bring your store online/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pay now' })).toHaveAttribute('href', '/dashboard/billing#pay');
  });

  it('shows nothing for a business without a plan whose store is already live', () => {
    const { container } = render(
      <SubscriptionBanner data={{ ...subscription(), subscription: null, awaitingFirstPayment: false }} showTrial />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('suspended screen sends the owner to the payment section', () => {
    render(<SuspendedScreen data={subscription({ status: 'EXPIRED', phase: 'SUSPENDED' })} />);
    expect(screen.getByRole('heading', { name: 'Your store is suspended' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your 7-day payment grace period has ended. Complete your payment to reactivate your store.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pay & Reactivate' })).toHaveAttribute('href', '/dashboard/billing#pay');
    expect(post).not.toHaveBeenCalled();
  });

  it('suspended screen says the payment is being checked while one is under review', () => {
    render(
      <SuspendedScreen
        data={subscription({ status: 'EXPIRED', phase: 'SUSPENDED' }, { pendingPayment: payment() })}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Pay & Reactivate' })).not.toBeInTheDocument();
    expect(screen.getByText(/Your payment is being checked/)).toBeInTheDocument();
  });

  it('staff without billing rights see who can pay instead of a payment button', () => {
    render(
      <SuspendedScreen data={subscription({ status: 'EXPIRED', phase: 'SUSPENDED' }, { canManage: false })} />,
    );
    expect(screen.queryByRole('link', { name: 'Pay & Reactivate' })).not.toBeInTheDocument();
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
    expect(await screen.findByRole('heading', { name: 'Payment due' })).toBeInTheDocument();
    expect(screen.getByText('Orders page')).toBeInTheDocument();
  });
});

describe('Plan & billing page', () => {
  function renderBilling(data: MerchantSubscription, payments: MerchantBillingPayment[] = []) {
    mockApi(data, payments);
    nav.pathname = '/dashboard/billing';
    return render(
      <DashboardShell>
        <BillingView />
      </DashboardShell>,
    );
  }

  /** The bar under the plans opens the payment as a dialog. */
  async function openPayment(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /Continue to payment/ }));
    return screen.findByRole('dialog', { name: 'Pay for your plan' });
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
    expect(await screen.findByRole('link', { name: 'Pay & Reactivate' })).toHaveAttribute('href', '/dashboard/billing#pay');
    expect(screen.getByText('Amount due')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Continue to payment/ })).toBeInTheDocument();
  });

  it('opens the payment straight away from a #pay link (Pay & Reactivate, reminders)', async () => {
    window.history.replaceState(null, '', '/dashboard/billing#pay');
    try {
      renderBilling(subscription({ status: 'EXPIRED', phase: 'SUSPENDED', amountDue: 999 }));
      const dialog = await screen.findByRole('dialog', { name: 'Pay for your plan' });
      await waitFor(() => expect(within(dialog).getByRole('heading', { name: 'Pay for your plan' })).toHaveFocus());
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('keeps the chosen plan in view and pays for it in a dialog that closes again', async () => {
    const user = userEvent.setup();
    renderBilling(subscription({ status: 'PAST_DUE', phase: 'GRACE' }));
    const bar = await screen.findByRole('region', { name: 'Selected plan' });
    expect(bar).toHaveTextContent('Growth · Monthly');
    expect(bar).toHaveTextContent('৳999');
    await user.click(screen.getByRole('radio', { name: /^Business/ }));
    expect(bar).toHaveTextContent('Business · Monthly');
    expect(screen.queryByRole('dialog')).toBeNull();

    const dialog = await openPayment(user);
    expect(dialog).toHaveTextContent('Business plan');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: /Continue to payment/ })).toHaveFocus());
    await openPayment(user);
    await user.click(screen.getByRole('button', { name: '← Back to plans' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('asks a business without a plan to pay for the plan chosen on the pricing page', async () => {
    nav.search = new URLSearchParams('plan=business&interval=6-months');
    const none: MerchantSubscription = { ...subscription(), subscription: null, awaitingFirstPayment: true };
    renderBilling(none);

    const business = await screen.findByRole('radio', { name: /Business/ });
    expect(business).toBeChecked();
    expect(screen.getByRole('radio', { name: /6 Months/ })).toBeChecked();
    expect(screen.getByText(/Your store goes live as soon as we confirm the payment/)).toBeInTheDocument();
    // There is no free trial to start: the plan is paid for right here.
    expect(screen.queryByRole('button', { name: /Months Free|free trial/i })).not.toBeInTheDocument();
    const panel = await openPayment(userEvent.setup());
    expect(panel).toHaveTextContent('Business plan');
    expect(panel).toHaveTextContent('Amount৳10,795');
    expect(post).not.toHaveBeenCalled();
  });

  it('shows the wallet number and exact amount for the chosen plan and wallet', async () => {
    const user = userEvent.setup();
    renderBilling(subscription({ status: 'PAST_DUE', phase: 'GRACE' }));
    let panel = await openPayment(user);
    expect(panel).toHaveTextContent('Growth plan');
    expect(panel).toHaveTextContent('bKash number01309093407');
    expect(panel).toHaveTextContent('Amount৳999');

    await user.click(screen.getByRole('radio', { name: /Rocket/ }));
    expect(panel).toHaveTextContent('Rocket number01757591788');
    await user.click(screen.getByRole('radio', { name: /Upay/ }));
    expect(panel).toHaveTextContent('Upay number01318090622');

    // The billing period is chosen on the page: close, switch to yearly, open again.
    await user.click(screen.getByRole('button', { name: 'Close payment' }));
    await user.click(screen.getByRole('radio', { name: /Yearly/ }));
    panel = await openPayment(user);
    await user.click(within(panel).getByRole('radio', { name: /Upay/ }));
    expect(panel).toHaveTextContent('Amount৳8,991');
    expect(screen.getByRole('button', { name: /Submit ৳8,991 Upay payment/ })).toBeInTheDocument();
  });

  it('checks the number and transaction ID before submitting', async () => {
    const user = userEvent.setup();
    renderBilling(subscription({ status: 'PAST_DUE', phase: 'GRACE' }));
    await openPayment(user);
    await user.type(screen.getByLabelText('Your bKash number'), '12345');
    await user.type(screen.getByLabelText('Transaction ID'), 'ABC123XYZ');
    await user.click(screen.getByRole('button', { name: /Submit ৳999 bKash payment/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/11-digit bKash number/);

    await user.clear(screen.getByLabelText('Your bKash number'));
    await user.type(screen.getByLabelText('Your bKash number'), '01712345678');
    await user.clear(screen.getByLabelText('Transaction ID'));
    await user.type(screen.getByLabelText('Transaction ID'), 'x');
    await user.click(screen.getByRole('button', { name: /Submit ৳999 bKash payment/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/transaction ID/);
    expect(post).not.toHaveBeenCalled();
  });

  it('submits the payment and shows it is under review', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ success: true, data: payment({ method: 'NAGAD', amount: 999 }) });
    renderBilling(subscription({ status: 'PAST_DUE', phase: 'GRACE' }));
    await openPayment(user);
    await user.click(screen.getByRole('radio', { name: /Nagad/ }));
    await user.type(screen.getByLabelText('Your Nagad number'), '+880 1712-345678');
    await user.type(screen.getByLabelText('Transaction ID'), 'abc123xyz');
    await user.click(screen.getByRole('button', { name: /Submit ৳999 Nagad payment/ }));

    expect(post).toHaveBeenCalledWith(
      '/billing/payments',
      {
        planSlug: 'growth',
        billingCycle: 'MONTHLY',
        method: 'NAGAD',
        senderNumber: '01712345678',
        transactionId: 'ABC123XYZ',
      },
      { token: 'token' },
    );
    expect(await screen.findByRole('heading', { name: 'Payment under review' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /Continue to payment/ })).not.toBeInTheDocument();
    expect(screen.getByText('Under review')).toBeInTheDocument();
  });

  it('hides the payment form while a payment is under review', async () => {
    renderBilling(subscription({}, { pendingPayment: payment() }), [payment()]);
    expect(await screen.findByRole('heading', { name: 'Payment under review' })).toBeInTheDocument();
    expect(screen.getByText(/We are checking your ৳999 bKash payment for the Growth plan/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue to payment/ })).not.toBeInTheDocument();
  });

  it('explains a rejected payment and lets the merchant pay again', async () => {
    renderBilling(subscription({ status: 'PAST_DUE', phase: 'GRACE' }), [
      payment({ status: 'REJECTED', rejectionReason: 'No payment with this ID reached our number.' }),
    ]);
    expect(await screen.findByText(/We could not confirm your last payment/)).toHaveTextContent(
      'No payment with this ID reached our number.',
    );
    expect(screen.getByText('Not confirmed')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Continue to payment/ })).toBeInTheDocument();
  });

  it('offers a free switch to a cheaper plan during the trial, but not an upgrade', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      success: true,
      data: subscription({ plan: { name: 'Starter', slug: 'starter', monthlyPrice: 499, trialMonths: 2, limits: null } }),
    });
    renderBilling(subscription());
    await screen.findByRole('button', { name: /Continue to payment/ });

    await user.click(screen.getByRole('radio', { name: /^Business/ }));
    expect(screen.queryByRole('button', { name: /Switch to Business now/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^Starter/ }));
    await user.click(screen.getByRole('button', { name: 'Switch to Starter now' }));
    expect(post).toHaveBeenCalledWith(
      '/billing/subscription',
      { planSlug: 'starter', billingCycle: 'MONTHLY' },
      { token: 'token' },
    );
  });

  it('lets a paid subscription renew or change plan by paying', async () => {
    renderBilling(subscription({ status: 'ACTIVE', phase: 'ACTIVE', endsAt: '2027-01-27T18:00:00.000Z' }));
    expect(await screen.findByText(/paid through January 28, 2027/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Continue to payment/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Switch to/ })).not.toBeInTheDocument();
  });
});
