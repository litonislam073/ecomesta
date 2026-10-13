import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminBillingCoupon } from '@ecomesta/types';
import CouponsPage from '@/app/dashboard/coupons/page';

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

const eid: AdminBillingCoupon = {
  id: 'c-1',
  code: 'EID25',
  description: 'Eid offer',
  type: 'PERCENTAGE',
  value: 25,
  planSlugs: ['growth'],
  billingCycles: [],
  maxRedemptions: 50,
  maxPerTenant: 1,
  startsAt: null,
  endsAt: null,
  active: true,
  usedCount: 3,
  pendingCount: 1,
  approvedDiscountTotal: 148,
  createdAt: '2026-10-13T00:00:00.000Z',
};
const plans = [
  { slug: 'starter', name: 'Starter' },
  { slug: 'growth', name: 'Growth' },
  { slug: 'business', name: 'Business' },
];

beforeEach(() => {
  pushToast.mockReset();
  for (const fn of Object.values(api)) fn.mockReset();
  api.get.mockImplementation(async (path: string) =>
    path === '/public/plans' ? { success: true, data: plans } : { success: true, data: [eid] },
  );
});

describe('Admin → Coupons', () => {
  it('lists coupons with discount, scope, usage and status', async () => {
    render(<CouponsPage />);
    const row = (await screen.findByText('EID25')).closest('tr')!;
    expect(row).toHaveTextContent('25% off');
    expect(row).toHaveTextContent('Growth · any period');
    expect(row).toHaveTextContent('3 / 50');
    expect(row).toHaveTextContent('(1 under review)');
    expect(row).toHaveTextContent('৳148 given');
    expect(within(row).getByText('Active')).toBeInTheDocument();
  });

  it('creates a coupon for the chosen plans and periods', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ success: true, data: { ...eid, id: 'c-2', code: 'NEWYEAR', type: 'FIXED_AMOUNT', value: 100, usedCount: 0 } });
    render(<CouponsPage />);
    await screen.findByText('EID25');

    await user.type(screen.getByLabelText('Code'), 'newyear');
    await user.selectOptions(screen.getByLabelText('Discount type'), 'FIXED_AMOUNT');
    await user.type(screen.getByLabelText('Taka off'), '100');
    await user.click(screen.getByRole('checkbox', { name: 'Business' }));
    await user.click(screen.getByRole('checkbox', { name: 'Yearly' }));
    await user.type(screen.getByLabelText('Total uses'), '20');
    await user.click(screen.getByRole('button', { name: 'Create coupon' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/billing-coupons', {
        code: 'NEWYEAR',
        type: 'FIXED_AMOUNT',
        value: 100,
        planSlugs: ['business'],
        billingCycles: ['YEARLY'],
        maxRedemptions: 20,
        maxPerTenant: 1,
      }),
    );
    expect(await screen.findByText('NEWYEAR')).toBeInTheDocument();
    expect(pushToast).toHaveBeenCalledWith('Coupon NEWYEAR created.', 'success');
  });

  it('checks the code and value before sending', async () => {
    const user = userEvent.setup();
    render(<CouponsPage />);
    await screen.findByText('EID25');
    await user.type(screen.getByLabelText('Code'), 'ok1');
    await user.type(screen.getByLabelText('Percent off'), '150');
    await user.click(screen.getByRole('button', { name: 'Create coupon' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('1 to 99');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('turns a coupon off and on', async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ success: true, data: { ...eid, active: false } });
    render(<CouponsPage />);
    const row = (await screen.findByText('EID25')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/billing-coupons/c-1', { active: false }));
    expect(await within(row).findByText('Off')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Turn on' })).toBeInTheDocument();
  });
});
