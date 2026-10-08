import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminThemePurchase } from '@ecomesta/types';
import AdminThemePurchasesPage from '@/app/dashboard/theme-purchases/page';

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

const pending: AdminThemePurchase = {
  id: 'tp-1',
  theme: { id: 'theme-shopease', slug: 'shopease', name: 'ShopEase' },
  amount: '999.00',
  currency: 'BDT',
  method: 'BKASH',
  senderNumber: '01712345678',
  transactionId: 'THEME123',
  status: 'PENDING',
  rejectionReason: null,
  createdAt: '2026-10-08T06:00:00.000Z',
  payToNumber: '01309093407',
  tenant: { id: 'tenant-1', name: 'Alpha Fashion', slug: 'alpha' },
  submittedBy: { email: 'owner@alpha.example', firstName: 'Ayesha', lastName: 'Rahman' },
  reviewedBy: null,
  reviewedAt: null,
};

function listResponse(items: AdminThemePurchase[], pendingCount = items.length) {
  return {
    success: true,
    data: { items, pendingCount, meta: { total: items.length, page: 1, limit: 20, totalPages: 1 } },
  };
}

describe('Admin theme purchases page', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    pushToast.mockReset();
  });

  it('lists pending theme payments with what to check', async () => {
    api.get.mockResolvedValue(listResponse([pending]));
    render(<AdminThemePurchasesPage />);

    const card = (await screen.findByText('Alpha Fashion')).closest('li')!;
    expect(api.get).toHaveBeenCalledWith('/admin/theme-purchases?page=1&limit=20&status=PENDING');
    expect(within(card).getByText('৳999')).toBeInTheDocument();
    expect(within(card).getByText('ShopEase · one-time')).toBeInTheDocument();
    expect(within(card).getByText('bKash to 01309093407')).toBeInTheDocument();
    expect(within(card).getByText('THEME123')).toBeInTheDocument();
    expect(within(card).getByText('Ayesha Rahman · owner@alpha.example')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Waiting for review (1)' })).toHaveAttribute('aria-selected', 'true');
  });

  it('approves after confirmation and reloads', async () => {
    api.get.mockResolvedValueOnce(listResponse([pending])).mockResolvedValueOnce(listResponse([], 0));
    api.post.mockResolvedValue({ success: true, data: { ...pending, status: 'APPROVED' } });
    const user = userEvent.setup();
    render(<AdminThemePurchasesPage />);

    await user.click(await screen.findByRole('button', { name: 'Approve & unlock theme' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Alpha Fashion gets ShopEase for all its stores');
    await user.click(screen.getByRole('button', { name: 'Approve & unlock' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/theme-purchases/tp-1/approve'));
    expect(pushToast).toHaveBeenCalledWith('Approved — Alpha Fashion can now use ShopEase.', 'success');
    expect(await screen.findByText('No theme payments waiting')).toBeInTheDocument();
  });

  it('rejects with a reason', async () => {
    api.get.mockResolvedValue(listResponse([pending]));
    api.post.mockResolvedValue({ success: true, data: { ...pending, status: 'REJECTED' } });
    const user = userEvent.setup();
    render(<AdminThemePurchasesPage />);

    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    const submit = screen.getByRole('button', { name: 'Reject payment' });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText('Reason (shown to the merchant)'), 'Amount did not match');
    await user.click(submit);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/theme-purchases/tp-1/reject', { reason: 'Amount did not match' }),
    );
  });

  it('shows who reviewed a finished payment', async () => {
    api.get.mockResolvedValue(
      listResponse(
        [{ ...pending, status: 'REJECTED', rejectionReason: 'Wrong amount', reviewedBy: { email: 'admin@ecomesta.local' }, reviewedAt: '2026-10-08T07:00:00.000Z' }],
        0,
      ),
    );
    render(<AdminThemePurchasesPage />);
    expect(await screen.findByText(/Rejected by admin@ecomesta.local on .* — Wrong amount/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve & unlock theme' })).toBeNull();
  });
});
