import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoreDomainSales } from '@ecomesta/types';
import { BuyDomain } from '@/components/domains/buy-domain';

const pushToast = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ pushToast }) }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { firstName: 'Rahim', lastName: 'Uddin', email: 'rahim@example.com' } }) }));

const api = { get: vi.fn(), post: vi.fn() };
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get: (...a: unknown[]) => api.get(...a), post: (...a: unknown[]) => api.post(...a) } };
});

let sales: StoreDomainSales;

function mockApi() {
  api.get.mockImplementation((path: string) => {
    if (path === '/stores/store-1/domain-sales') return Promise.resolve({ success: true, data: sales });
    if (path === '/billing/payment-accounts') {
      return Promise.resolve({ success: true, data: [{ method: 'BKASH', label: 'bKash', number: '01700000000', transferType: 'Send Money' }] });
    }
    if (path.startsWith('/public/domains/search')) {
      return Promise.resolve({
        success: true,
        data: {
          query: 'amarshop',
          maxYears: 3,
          results: [
            { domain: 'amarshop.com', available: true, premium: false, priceBdt: 1630, renewBdt: 1820 },
            { domain: 'amarshop.net', available: false, premium: false, priceBdt: null, renewBdt: null },
          ],
        },
      });
    }
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

describe('Buy a domain', () => {
  beforeEach(() => {
    sales = { enabled: true, maxYears: 3, domains: [], orders: [] };
    api.get.mockReset();
    api.post.mockReset();
    pushToast.mockReset();
    mockApi();
  });

  it('searches, then buys with owner details and a wallet payment', async () => {
    const user = userEvent.setup();
    render(<BuyDomain storeId="store-1" canBuy onConnected={vi.fn()} />);
    await user.type(screen.getByLabelText('Domain name'), 'amarshop');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    const results = await screen.findByRole('list', { name: 'Search results' });
    expect(within(results).getByText('Already taken')).toBeInTheDocument();
    expect(within(results).getByText('৳1,630/year')).toBeInTheDocument();
    await user.click(within(results).getByRole('button', { name: 'Buy' }));

    // Name and email come from the account; the rest is asked for.
    expect(screen.getByLabelText('Full name')).toHaveValue('Rahim Uddin');
    expect(screen.getByLabelText('Email')).toHaveValue('rahim@example.com');
    await user.click(screen.getByRole('button', { name: /Continue to payment/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/fill in every field/);

    await user.selectOptions(screen.getByLabelText('Period'), '2');
    await user.type(screen.getByLabelText('Mobile number'), '01712345678');
    await user.type(screen.getByLabelText('City'), 'Dhaka');
    await user.type(screen.getByLabelText('Address'), 'House 1, Road 2');
    await user.type(screen.getByLabelText('Postcode'), '1207');
    await user.click(screen.getByRole('button', { name: 'Continue to payment · ৳3,260' }));

    api.post.mockResolvedValue({ success: true, data: {} });
    await user.type(await screen.findByLabelText('Your bKash number'), '01711111111');
    await user.type(screen.getByLabelText('Transaction ID'), 'TRX12345');
    await user.click(screen.getByRole('button', { name: 'Pay ৳3,260 with bKash' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/stores/store-1/domain-sales/orders', {
        domain: 'amarshop.com',
        years: 2,
        registrant: { name: 'Rahim Uddin', email: 'rahim@example.com', phone: '01712345678', address: 'House 1, Road 2', city: 'Dhaka', postcode: '1207' },
        method: 'BKASH',
        senderNumber: '01711111111',
        transactionId: 'TRX12345',
      }),
    );
    expect(pushToast).toHaveBeenCalledWith(expect.stringMatching(/Payment submitted/), 'success');
  });

  it('lists bought domains with expiry and renews them; shows order status', async () => {
    sales = {
      enabled: true,
      maxYears: 3,
      domains: [{ id: 'rd-1', name: 'myshop.com', storeId: 'store-1', registeredAt: '2026-01-01T00:00:00Z', expiresAt: '2030-06-15T12:00:00Z', renewBdt: 1820 }],
      orders: [
        {
          id: 'o-1',
          kind: 'REGISTER',
          domain: 'other.shop',
          years: 1,
          amount: '1630.00',
          method: 'BKASH',
          senderNumber: '017',
          transactionId: 'TRX1',
          status: 'PENDING',
          failureReason: null,
          rejectionReason: null,
          store: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        },
      ],
    };
    mockApi();
    const user = userEvent.setup();
    render(<BuyDomain storeId="store-1" canBuy onConnected={vi.fn()} />);
    expect(await screen.findByText('myshop.com')).toBeInTheDocument();
    expect(screen.getByText(/Expires 15 Jun 2030 · \d+ days left/)).toBeInTheDocument();
    expect(screen.getByText('Waiting for payment check')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Renew · ৳1,820/year' }));
    api.post.mockResolvedValue({ success: true, data: {} });
    await user.type(await screen.findByLabelText('Your bKash number'), '01711111111');
    await user.type(screen.getByLabelText('Transaction ID'), 'TRX999');
    await user.click(screen.getByRole('button', { name: 'Pay ৳1,820 with bKash' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/stores/store-1/domain-sales/rd-1/renew', {
        years: 1,
        method: 'BKASH',
        senderNumber: '01711111111',
        transactionId: 'TRX999',
      }),
    );
  });

  it('read-only members see prices but cannot buy', async () => {
    const user = userEvent.setup();
    render(<BuyDomain storeId="store-1" canBuy={false} onConnected={vi.fn()} />);
    await user.type(screen.getByLabelText('Domain name'), 'amarshop');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('৳1,630/year')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buy' })).not.toBeInTheDocument();
  });
});
