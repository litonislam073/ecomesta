import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AffiliateMe } from '@ecomesta/types';
import AffiliateView from '@/app/dashboard/affiliate/affiliate-view';
import { ApiError } from '@/lib/api-client';
import { isStorelessPath } from '@/lib/nav';
import { readReferralCode, rememberReferralCode } from '@/lib/referral';

const pushToast = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ pushToast }) }));

const api = { get: vi.fn(), post: vi.fn(), put: vi.fn() };
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => api.get(...args),
      post: (...args: unknown[]) => api.post(...args),
      put: (...args: unknown[]) => api.put(...args),
    },
  };
});

let emailVerified: boolean | undefined = true;
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { emailVerified } }) }));

const program = { enabled: true, commissionRate: 20, cookieDays: 30, holdDays: 7, minPayout: 500 };
const profile = {
  id: 'aff-1',
  code: 'RAHIM4821',
  status: 'ACTIVE' as const,
  statusReason: null,
  applicationNote: null,
  commissionRate: 20,
  payoutMethod: 'BKASH' as const,
  payoutNumber: '01712345678',
  payoutName: 'Rahim',
  createdAt: '2026-10-01T00:00:00.000Z',
  reviewedAt: '2026-10-02T00:00:00.000Z',
};

function active(balance: Partial<AffiliateMe['balance']> = {}): AffiliateMe {
  return {
    program,
    affiliate: profile,
    stats: { clicks: 12, signups: 3, businesses: 2, paidCustomers: 1 },
    balance: { available: 0, onHold: 0, requested: 0, paid: 0, totalEarned: 0, ...balance },
    referralUrl: 'https://ecomesta.com/?ref=RAHIM4821',
  };
}

function routeGets(me: AffiliateMe, lists: { payouts?: unknown[] } = {}) {
  api.get.mockImplementation((path: string) => {
    if (path === '/affiliate/me') return Promise.resolve({ success: true, data: me });
    if (path === '/affiliate/payouts') return Promise.resolve({ data: { items: lists.payouts ?? [] } });
    return Promise.resolve({ data: { items: [] } });
  });
}

describe('Affiliate program page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emailVerified = true;
  });

  it('keeps Apply disabled until the account email is confirmed', async () => {
    emailVerified = false;
    routeGets({ program, affiliate: null, stats: null, balance: null, referralUrl: null });
    render(<AffiliateView />);

    expect(await screen.findByText(/confirm your email address first/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply now' })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('lets an account without an affiliate profile apply, showing the program terms', async () => {
    routeGets({ program, affiliate: null, stats: null, balance: null, referralUrl: null });
    api.post.mockResolvedValue({
      success: true,
      data: { program, affiliate: { ...profile, status: 'PENDING' }, stats: null, balance: null, referralUrl: null },
    });
    render(<AffiliateView />);

    expect(await screen.findByText('20%')).toBeInTheDocument();
    expect(screen.getByText('৳500')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/how will you promote/i), 'My Facebook group');
    await userEvent.click(screen.getByRole('button', { name: 'Apply now' }));

    expect(api.post).toHaveBeenCalledWith('/affiliate/apply', { applicationNote: 'My Facebook group' });
    expect(await screen.findByText('Waiting for review')).toBeInTheDocument();
  });

  it('shows the link, earnings and stats to an active affiliate', async () => {
    routeGets(active({ available: 120, onHold: 300, paid: 500, totalEarned: 920 }));
    render(<AffiliateView />);

    expect(await screen.findByLabelText('Referral link')).toHaveValue('https://ecomesta.com/?ref=RAHIM4821');
    expect(screen.getByText('৳300')).toBeInTheDocument();
    expect(screen.getByText('Link clicks').nextSibling).toHaveTextContent('12');
    // Below the minimum: the withdraw button stays off and says why.
    expect(screen.getByText(/at least ৳500 available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeDisabled();
  });

  it('requests a withdrawal of the available balance', async () => {
    routeGets(active({ available: 900, totalEarned: 900 }));
    api.post.mockResolvedValue({ success: true, data: {} });
    render(<AffiliateView />);

    const button = await screen.findByRole('button', { name: 'Withdraw' });
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /^Withdraw ৳/.test(el.textContent ?? ''))).toHaveTextContent(
      '৳900 to bKash 01712345678',
    );
    await userEvent.click(button);
    expect(api.post).toHaveBeenCalledWith('/affiliate/payouts', {});
    await waitFor(() => expect(pushToast).toHaveBeenCalledWith(expect.stringMatching(/Withdrawal requested/), 'success'));
  });

  it('shows a waiting withdrawal instead of the button', async () => {
    routeGets(active({ requested: 900 }), {
      payouts: [
        {
          id: 'p-1',
          amount: 900,
          method: 'NAGAD',
          number: '01812345678',
          accountName: null,
          status: 'REQUESTED',
          transactionId: null,
          rejectionReason: null,
          createdAt: '2026-10-10T00:00:00.000Z',
          reviewedAt: null,
        },
      ],
    });
    render(<AffiliateView />);
    expect(await screen.findByText(/is waiting to be paid/)).toHaveTextContent('৳900 to Nagad 01812345678');
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeDisabled();
  });

  it('checks the wallet number before saving it', async () => {
    routeGets(active());
    api.put.mockResolvedValue({ success: true, data: {} });
    render(<AffiliateView />);

    const number = await screen.findByLabelText('Wallet number');
    await userEvent.clear(number);
    await userEvent.type(number, '12345');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/11-digit mobile number/)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();

    await userEvent.clear(number);
    await userEvent.type(number, '+88 01912-345678');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.put).toHaveBeenCalledWith('/affiliate/payout-method', { method: 'BKASH', number: '01912345678', name: 'Rahim' });
  });

  it('shows an error with retry when the program cannot load', async () => {
    api.get.mockRejectedValue(new ApiError(500, 'INTERNAL', 'boom'));
    render(<AffiliateView />);
    expect(await screen.findByText('Could not load the affiliate program')).toBeInTheDocument();
  });
});

describe('referral code and store-less pages', () => {
  it('remembers a valid ?ref code and ignores junk', () => {
    document.cookie = 'ecomesta_ref=; max-age=0; path=/';
    rememberReferralCode('<script>');
    expect(readReferralCode()).toBeNull();
    rememberReferralCode(' rahim4821 ');
    expect(readReferralCode()).toBe('RAHIM4821');
  });

  it('lets accounts without a store open the affiliate page only', () => {
    expect(isStorelessPath('/dashboard/affiliate')).toBe(true);
    expect(isStorelessPath('/onboard')).toBe(true);
    expect(isStorelessPath('/dashboard')).toBe(false);
    expect(isStorelessPath('/dashboard/orders')).toBe(false);
    expect(isStorelessPath('/dashboard/support')).toBe(true);
  });
});
