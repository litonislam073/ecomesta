import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminDomainOrder } from '@ecomesta/types';
import AdminDomainOrdersPage from '@/app/dashboard/domain-orders/page';

const pushToast = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ pushToast }) }));

const api = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: {
      get: (...a: unknown[]) => api.get(...a),
      post: (...a: unknown[]) => api.post(...a),
      patch: (...a: unknown[]) => api.patch(...a),
    },
  };
});

const pending: AdminDomainOrder = {
  id: 'do-1',
  kind: 'REGISTER',
  domain: 'amarshop.com',
  years: 1,
  amount: '1710.00',
  method: 'BKASH',
  senderNumber: '01712345678',
  transactionId: 'DOM123',
  status: 'PENDING',
  failureReason: null,
  rejectionReason: null,
  store: { id: 'store-1', name: 'Amar Shop', slug: 'amarshop' },
  createdAt: '2026-11-20T06:00:00.000Z',
  completedAt: null,
  payToNumber: '01309093407',
  costUsd: '11.62',
  usdRate: '125.00',
  marginBdt: '250.00',
  registrant: { name: 'Rahim Uddin', email: 'rahim@example.com', phone: '01712345678', address: 'House 1', city: 'Dhaka', postcode: '1207' },
  tenant: { id: 'tenant-1', name: 'Amar Shop Ltd', slug: 'amar' },
  submittedBy: { email: 'rahim@example.com', firstName: 'Rahim', lastName: 'Uddin' },
  reviewedBy: null,
  reviewedAt: null,
};

const settings = { enabled: true, usdRate: 125, marginBdt: 250, tlds: ['com', 'net'], maxYears: 5 };

function mockApi(items: AdminDomainOrder[] = [pending]) {
  api.get.mockImplementation((path: string) => {
    if (path === '/admin/domain-sales/settings') return Promise.resolve({ success: true, data: settings });
    if (path === '/admin/domain-sales/balance') return Promise.resolve({ success: true, data: { mode: 'sandbox', balanceUsd: 42.5 } });
    return Promise.resolve({
      success: true,
      data: { items, meta: { total: items.length, page: 1, limit: 20, totalPages: 1 }, pendingCount: items.length, registrarMode: 'sandbox' },
    });
  });
}

describe('Domain orders (admin)', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
    pushToast.mockReset();
    mockApi();
  });

  it('shows the order with cost, profit and registrant, and approves it', async () => {
    const user = userEvent.setup();
    render(<AdminDomainOrdersPage />);
    const card = (await screen.findByText('amarshop.com')).closest('li')!;
    expect(within(card).getByText('৳1,710')).toBeInTheDocument();
    // 11.62 × 125 = 1452.5 → profit 257.5
    expect(within(card).getByText('৳258')).toBeInTheDocument();
    expect(within(card).getByText(/Rahim Uddin · rahim@example.com/)).toBeInTheDocument();
    expect(await screen.findByText('$42.50')).toBeInTheDocument();

    api.post.mockResolvedValue({ success: true, data: { ...pending, status: 'COMPLETED' } });
    await user.click(within(card).getByRole('button', { name: 'Approve & register' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve & register' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/domain-sales/orders/do-1/approve'));
    expect(pushToast).toHaveBeenCalledWith('amarshop.com registered and connected to the store.', 'success');
  });

  it('a failed order shows the registrar reason and can be retried', async () => {
    mockApi([{ ...pending, status: 'FAILED', failureReason: 'not enough account balance' }]);
    render(<AdminDomainOrdersPage />);
    expect(await screen.findByText('Registrar said: not enough account balance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('saves the dollar rate and profit', async () => {
    const user = userEvent.setup();
    render(<AdminDomainOrdersPage />);
    const form = await screen.findByRole('form', { name: 'Domain settings' });
    const rate = within(form).getByLabelText('Dollar rate (৳ per $)');
    await user.clear(rate);
    await user.type(rate, '122');
    api.patch.mockResolvedValue({ success: true, data: { ...settings, usdRate: 122 } });
    await user.click(within(form).getByRole('button', { name: 'Save domain settings' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/domain-sales/settings', { ...settings, usdRate: 122, tlds: ['com', 'net'] }),
    );
    expect(pushToast).toHaveBeenCalledWith('Domain settings saved', 'success');
  });
});
