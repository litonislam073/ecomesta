import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPlansPage from '@/app/dashboard/plans/page';
import NewPlanPage from '@/app/dashboard/plans/new/page';
import EditPlanPage from '@/app/dashboard/plans/[planId]/page';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ planId: 'plan-1' }),
  useRouter: () => ({ push, replace: vi.fn() }),
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

const samplePlan = {
  id: 'plan-1',
  name: 'Growth',
  slug: 'growth',
  description: 'For scaling merchants',
  monthlyPrice: '999.00',
  yearlyPrice: '8991.00',
  currency: 'BDT',
  trialMonths: 2,
  prices: [
    { billingCycle: 'MONTHLY', amount: 999, months: 1, discountPercent: 0, effectiveMonthly: 999 },
    { billingCycle: 'SEMI_ANNUAL', amount: 5395, months: 6, discountPercent: 10, effectiveMonthly: 899.17 },
    { billingCycle: 'YEARLY', amount: 8991, months: 12, discountPercent: 25, effectiveMonthly: 749.25 },
  ],
  active: true,
  configuration: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Admin plans', () => {
  beforeEach(() => {
    pushToast.mockReset();
    push.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.patch.mockReset();
  });

  it('lists plans with pricing and links to create', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [samplePlan],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<AdminPlansPage />);

    expect(await screen.findByRole('link', { name: 'Growth' })).toBeInTheDocument();
    expect(screen.getByText('৳999')).toBeInTheDocument();
    expect(screen.getByText('৳5,395')).toBeInTheDocument();
    expect(screen.getByText('৳8,991')).toBeInTheDocument();
    expect(screen.getByText('2 months')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new plan/i })).toBeInTheDocument();
  });

  it('surfaces API errors on the list', async () => {
    api.get.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Nope'));
    render(<AdminPlansPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('validates prices before posting a new plan', async () => {
    const user = userEvent.setup();
    render(<NewPlanPage />);

    await user.type(screen.getByLabelText('Plan name'), 'Growth');
    await user.type(screen.getByLabelText('Plan slug'), 'growth');
    await user.type(screen.getByLabelText(/Monthly price/), 'free');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Monthly price must be a non-negative amount',
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it('creates a plan and navigates to it', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ success: true, data: samplePlan });
    render(<NewPlanPage />);

    await user.type(screen.getByLabelText('Plan name'), 'Growth');
    await user.type(screen.getByLabelText('Plan slug'), 'Growth Plan');
    await user.type(screen.getByLabelText(/Monthly price/), '999');
    expect(screen.getByText(/6 Months: ৳5,395 \(save 10%\) · Yearly: ৳8,991 \(save 25%\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/admin/plans', {
        name: 'Growth',
        slug: 'growth-plan',
        description: null,
        monthlyPrice: '999',
        active: true,
      });
    });
    expect(push).toHaveBeenCalledWith('/dashboard/plans/plan-1');
  });

  it('confirms before deactivating a plan', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: samplePlan });
    api.patch.mockResolvedValue({ success: true, data: samplePlan });
    render(<EditPlanPage />);

    await user.click(await screen.findByRole('button', { name: /deactivate plan/i }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Deactivate this plan?');
    expect(api.patch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/plans/plan-1/status', {
        active: false,
      });
    });
    expect(pushToast).toHaveBeenCalledWith('Plan deactivated', 'success');
  });

  it('prefills the edit form from the loaded plan', async () => {
    api.get.mockResolvedValue({ success: true, data: samplePlan });
    render(<EditPlanPage />);

    expect(await screen.findByLabelText('Plan name')).toHaveValue('Growth');
    expect(screen.getByLabelText('Plan slug')).toHaveValue('growth');
    expect(screen.getByLabelText(/Monthly price/)).toHaveValue('999.00');
    expect(screen.queryByLabelText(/Yearly price/)).not.toBeInTheDocument();
  });
});
