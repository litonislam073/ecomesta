import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminSubscriptionsPage from '@/app/dashboard/subscriptions/page';
import AdminSubscriptionDetailPage from '@/app/dashboard/subscriptions/[subscriptionId]/page';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ subscriptionId: 'sub-1' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ pushToast }),
}));

const api = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>(
    '@/lib/api-client',
  );
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => api.get(...args),
      post: (...args: unknown[]) => api.post(...args),
      patch: (...args: unknown[]) => api.patch(...args),
      delete: (...args: unknown[]) => api.delete(...args),
    },
  };
});

const sampleSubscription = {
  id: 'sub-1',
  tenantId: 'tenant-1',
  planId: 'plan-1',
  status: 'ACTIVE' as const,
  phase: 'ACTIVE' as const,
  billingCycle: 'MONTHLY' as const,
  startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: null,
  trialEndsAt: null,
  paymentDueBy: null,
  amountDue: 999,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tenant: {
    id: 'tenant-1',
    name: 'Alpha Group',
    slug: 'alpha',
    status: 'ACTIVE' as const,
  },
  plan: {
    id: 'plan-1',
    name: 'Growth',
    slug: 'growth',
    active: true,
    monthlyPrice: '999.00',
    yearlyPrice: '8991.00',
    trialMonths: 2,
  },
};

const graceSubscription = {
  ...sampleSubscription,
  status: 'PAST_DUE' as const,
  phase: 'GRACE' as const,
  billingCycle: 'SEMI_ANNUAL' as const,
  trialEndsAt: '2026-11-27T18:00:00.000Z',
  paymentDueBy: '2026-12-04T18:00:00.000Z',
  amountDue: 5395,
};

describe('Admin subscriptions', () => {
  beforeEach(() => {
    pushToast.mockReset();
    api.get.mockReset();
    api.patch.mockReset();
  });

  it('lists subscriptions with tenant, plan and cycle', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleSubscription],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<AdminSubscriptionsPage />);

    expect(await screen.findByRole('link', { name: 'Alpha Group' })).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage' })).toBeInTheDocument();
  });

  it('shows the trial, grace period and 6-month cycle so operators can tell who owes payment', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: { items: [graceSubscription], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } },
    });
    render(<AdminSubscriptionsPage />);

    expect(await screen.findByText('Grace period (payment due)')).toBeInTheDocument();
    expect(screen.getByText('6 Months')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Payment due by' })).toBeInTheDocument();
  });

  it('shows trial length, amount due and payment deadline on the detail page', async () => {
    api.get.mockResolvedValue({ success: true, data: graceSubscription });
    render(<AdminSubscriptionDetailPage />);

    expect(await screen.findByText('Grace period (payment due)')).toBeInTheDocument();
    expect(screen.getByText('2 months')).toBeInTheDocument();
    expect(screen.getByText('৳5,395')).toBeInTheDocument();
    expect(screen.getByText('Payment due by')).toBeInTheDocument();
  });

  it('warns that activation must follow a confirmed payment', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: graceSubscription });
    render(<AdminSubscriptionDetailPage />);
    await user.selectOptions(await screen.findByLabelText('Move to status'), 'ACTIVE');
    await user.click(screen.getByRole('button', { name: 'Change status' }));
    expect(screen.getByRole('dialog')).toHaveTextContent("Only activate after the tenant's payment has been confirmed");
  });

  it('surfaces API errors on the list', async () => {
    api.get.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Nope'));
    render(<AdminSubscriptionsPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('only offers transitions the API accepts from the current status', async () => {
    api.get.mockResolvedValue({ success: true, data: sampleSubscription });
    render(<AdminSubscriptionDetailPage />);

    const select = await screen.findByLabelText('Move to status');
    const options = Array.from(select.querySelectorAll('option')).map(
      (option) => option.value,
    );
    expect(options).toEqual(['', 'PAST_DUE', 'CANCELLED', 'EXPIRED']);
    expect(options).not.toContain('TRIALING');
  });

  it('confirms before changing subscription status', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: sampleSubscription });
    api.patch.mockResolvedValue({ success: true, data: sampleSubscription });
    render(<AdminSubscriptionDetailPage />);

    await user.selectOptions(
      await screen.findByLabelText('Move to status'),
      'CANCELLED',
    );
    await user.click(screen.getByRole('button', { name: 'Change status' }));

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Move subscription to CANCELLED?',
    );
    expect(api.patch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm status change' }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/subscriptions/sub-1/status', {
        status: 'CANCELLED',
      });
    });
    expect(pushToast).toHaveBeenCalledWith(
      'Subscription moved to CANCELLED',
      'success',
    );
  });

  it('reports a rejected transition from the API', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: sampleSubscription });
    api.patch.mockRejectedValue(
      new ApiError(
        422,
        'UNPROCESSABLE',
        'Invalid subscription status transition from ACTIVE to TRIALING',
      ),
    );
    render(<AdminSubscriptionDetailPage />);

    await user.selectOptions(await screen.findByLabelText('Move to status'), 'EXPIRED');
    await user.click(screen.getByRole('button', { name: 'Change status' }));
    await user.click(screen.getByRole('button', { name: 'Confirm status change' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid subscription status transition',
    );
  });
});
