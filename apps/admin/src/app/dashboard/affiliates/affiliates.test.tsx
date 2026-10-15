import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminAffiliateItem, AdminAffiliatePayoutItem } from '@ecomesta/types';
import AdminAffiliatesPage from '@/app/dashboard/affiliates/page';

const pushToast = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ pushToast }) }));

const api = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => api.get(...args),
      post: (...args: unknown[]) => api.post(...args),
      patch: (...args: unknown[]) => api.patch(...args),
    },
  };
});

const balance = { available: 0, onHold: 0, requested: 0, paid: 0, totalEarned: 0 };
const applicant: AdminAffiliateItem = {
  id: 'aff-1',
  code: 'RAHIM4821',
  status: 'PENDING',
  statusReason: null,
  applicationNote: 'I run a Facebook group for sellers',
  commissionRate: 20,
  customRate: null,
  payoutMethod: null,
  payoutNumber: null,
  payoutName: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  reviewedAt: null,
  user: { id: 'u-1', email: 'rahim@example.com', name: 'Rahim Uddin' },
  stats: { clicks: 0, signups: 0, businesses: 0, paidCustomers: 0 },
  balance,
};
const payout: AdminAffiliatePayoutItem = {
  id: 'p-1',
  amount: 900,
  method: 'BKASH',
  number: '01712345678',
  accountName: 'Rahim',
  status: 'REQUESTED',
  transactionId: null,
  rejectionReason: null,
  createdAt: '2026-10-10T00:00:00.000Z',
  reviewedAt: null,
  affiliate: { id: 'aff-1', code: 'RAHIM4821', email: 'rahim@example.com', name: 'Rahim Uddin' },
};

describe('Admin affiliates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path: string) => {
      if (path.startsWith('/admin/affiliates/payouts')) return Promise.resolve({ success: true, data: { items: [payout] } });
      if (path === '/admin/affiliates/settings') {
        return Promise.resolve({ success: true, data: { enabled: true, commissionRate: 20, cookieDays: 30, holdDays: 7, minPayout: 500 } });
      }
      return Promise.resolve({ success: true, data: { items: [applicant] } });
    });
    api.post.mockResolvedValue({ success: true, data: {} });
    api.patch.mockImplementation((_path: string, body: Record<string, unknown>) =>
      Promise.resolve({ success: true, data: { enabled: true, commissionRate: 20, cookieDays: 30, holdDays: 7, minPayout: 500, ...body } }),
    );
  });

  it('lists applications waiting for approval and approves one', async () => {
    render(<AdminAffiliatesPage />);
    expect(await screen.findByText('Rahim Uddin')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/affiliates?status=PENDING');
    expect(screen.getByText(/Facebook group for sellers/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(api.post).toHaveBeenCalledWith('/admin/affiliates/aff-1/approve', undefined);
    await waitFor(() => expect(pushToast).toHaveBeenCalledWith(expect.stringMatching(/approved/), 'success'));
  });

  it('needs a reason to reject an application', async () => {
    render(<AdminAffiliatesPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const confirm = screen.getByRole('button', { name: 'Reject application' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox'), 'No audience');
    await userEvent.click(confirm);
    expect(api.post).toHaveBeenCalledWith('/admin/affiliates/aff-1/reject', { reason: 'No audience' });
  });

  it('marks a withdrawal paid with the transaction ID', async () => {
    render(<AdminAffiliatesPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Withdrawals' }));
    expect(await screen.findByText('৳900')).toBeInTheDocument();
    expect(screen.getByText('bKash 01712345678')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mark as paid' }));
    await userEvent.type(screen.getByLabelText(/Transaction ID/), 'TRX9988');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm paid' }));
    expect(api.post).toHaveBeenCalledWith('/admin/affiliates/payouts/p-1/paid', { transactionId: 'TRX9988' });
  });

  it('saves program settings', async () => {
    render(<AdminAffiliatesPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
    const rate = await screen.findByLabelText(/Commission \(%\)/);
    expect(rate).toHaveValue('20');
    await userEvent.clear(rate);
    await userEvent.type(rate, '25');
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(api.patch).toHaveBeenCalledWith('/admin/affiliates/settings', {
      enabled: true,
      commissionRate: 25,
      cookieDays: 30,
      holdDays: 7,
      minPayout: 500,
    });
  });
});
