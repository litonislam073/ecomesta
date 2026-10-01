import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminBillingPayment } from '@ecomesta/types';
import AdminPaymentsPage from '@/app/dashboard/payments/page';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ pushToast }) }));

const api = { get: vi.fn(), post: vi.fn() };

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => api.get(...args),
      post: (...args: unknown[]) => api.post(...args),
    },
  };
});

const pending: AdminBillingPayment = {
  id: 'pay-1',
  planName: 'Growth',
  planSlug: 'growth',
  billingCycle: 'YEARLY',
  amount: 2691,
  currency: 'BDT',
  method: 'BKASH',
  senderNumber: '01712345678',
  transactionId: 'ABC123XYZ',
  status: 'PENDING',
  rejectionReason: null,
  createdAt: '2026-10-01T06:00:00.000Z',
  reviewedAt: null,
  payToNumber: '01309093407',
  tenant: { id: 'tenant-1', name: 'Alpha Fashion', slug: 'alpha' },
  submittedBy: { id: 'user-1', email: 'owner@alpha.example', name: 'Ayesha Rahman' },
  reviewedBy: null,
  currentSubscription: { status: 'TRIALING', planName: 'Starter' },
};

function listResponse(items: AdminBillingPayment[], pendingCount = items.length) {
  return {
    success: true,
    data: { items, pendingCount, meta: { total: items.length, page: 1, limit: 20, totalPages: 1 } },
  };
}

describe('Admin payments page', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    pushToast.mockReset();
  });

  it('lists payments waiting for review with everything needed to check them', async () => {
    api.get.mockResolvedValue(listResponse([pending]));
    render(<AdminPaymentsPage />);

    expect(await screen.findByText('Alpha Fashion')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/billing-payments?page=1&limit=20&status=PENDING');
    const card = screen.getByText('Alpha Fashion').closest('li')!;
    expect(card).toHaveTextContent('৳2,691');
    expect(card).toHaveTextContent('Growth · Yearly');
    expect(card).toHaveTextContent('bKash to 01309093407');
    expect(card).toHaveTextContent('01712345678');
    expect(card).toHaveTextContent('ABC123XYZ');
    expect(card).toHaveTextContent('Starter · trialing');
    expect(screen.getByRole('tab', { name: 'Waiting for review (1)' })).toHaveAttribute('aria-selected', 'true');
  });

  it('approves only after confirming what to check, then reloads', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce(listResponse([pending])).mockResolvedValueOnce(listResponse([], 0));
    api.post.mockResolvedValue({ success: true, data: { ...pending, status: 'APPROVED' } });
    render(<AdminPaymentsPage />);

    await user.click(await screen.findByRole('button', { name: 'Approve & activate plan' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(
      'Only approve if ৳2,691 from 01712345678 arrived on bKash 01309093407 with transaction ID ABC123XYZ.',
    );
    expect(api.post).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Approve & activate' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/billing-payments/pay-1/approve'));
    expect(pushToast).toHaveBeenCalledWith('Approved — Alpha Fashion is now on Growth.', 'success');
    expect(await screen.findByText('No payments waiting')).toBeInTheDocument();
  });

  it('rejects with a reason the merchant will see', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(listResponse([pending]));
    api.post.mockResolvedValue({ success: true, data: { ...pending, status: 'REJECTED' } });
    render(<AdminPaymentsPage />);

    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    const submit = screen.getByRole('button', { name: 'Reject payment' });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason/), 'No payment with this ID reached our bKash.');
    await user.click(submit);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/billing-payments/pay-1/reject', {
        reason: 'No payment with this ID reached our bKash.',
      }),
    );
  });

  it('shows the API error when approval fails', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(listResponse([pending]));
    api.post.mockRejectedValue(new ApiError(409, 'CONFLICT', 'This payment was rejected and cannot be approved'));
    render(<AdminPaymentsPage />);
    await user.click(await screen.findByRole('button', { name: 'Approve & activate plan' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve & activate' }));
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith('This payment was rejected and cannot be approved', 'error'),
    );
  });

  it('switches to reviewed payments with who reviewed them', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce(listResponse([pending])).mockResolvedValueOnce(
      listResponse(
        [
          {
            ...pending,
            status: 'REJECTED',
            rejectionReason: 'Wrong amount',
            reviewedBy: { id: 'admin-1', email: 'admin@ecomesta.com' },
            reviewedAt: '2026-10-01T08:00:00.000Z',
          },
        ],
        0,
      ),
    );
    render(<AdminPaymentsPage />);
    await screen.findByText('Alpha Fashion');
    await user.click(screen.getByRole('tab', { name: 'Rejected' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/admin/billing-payments?page=1&limit=20&status=REJECTED'));
    expect(await screen.findByText(/Rejected by admin@ecomesta.com/)).toHaveTextContent('Wrong amount');
    expect(screen.queryByRole('button', { name: 'Approve & activate plan' })).not.toBeInTheDocument();
  });
});
