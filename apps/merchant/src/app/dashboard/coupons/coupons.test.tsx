import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CouponsPage from '@/app/dashboard/coupons/page';
import NewCouponPage from '@/app/dashboard/coupons/new/page';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();
let selectedStoreId = 'store-1';
let canManage = true;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    selectedStoreId,
    selectedStore: {
      id: selectedStoreId,
      tenantId: 'tenant-1',
      name: 'Alpha',
      slug: 'alpha',
      status: 'ACTIVE',
      currency: 'USD',
      timezone: 'UTC',
      locale: 'en-US',
      createdAt: '',
      updatedAt: '',
    },
    stores: [],
    loading: false,
    error: null,
    setSelectedStoreId: vi.fn(),
    refreshStores: vi.fn(),
  }),
}));

vi.mock('@/lib/permissions', () => ({
  useCanManageStore: () => canManage,
}));

let couponsAllowed = true;
vi.mock('@/lib/subscription-context', () => ({
  useSubscription: () => ({
    data: {
      subscription: {
        plan: { limits: { coupons: couponsAllowed } },
      },
    },
  }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ pushToast }),
}));

const api = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

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

const sampleCoupon = {
  id: 'c-1',
  storeId: 'store-1',
  code: 'SUMMER10',
  type: 'PERCENTAGE' as const,
  value: '10.00',
  minimumOrderAmount: null,
  maximumDiscountAmount: null,
  usageLimit: null,
  usageCount: 0,
  perCustomerLimit: null,
  startsAt: null,
  expiresAt: null,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Coupons UI', () => {
  beforeEach(() => {
    selectedStoreId = 'store-1';
    canManage = true;
    couponsAllowed = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.post.mockReset();
  });

  it('loads coupon list', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleCoupon],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<CouponsPage />);
    expect(await screen.findByRole('link', { name: 'SUMMER10' })).toBeInTheDocument();
    expect(screen.getAllByText('Percentage').length).toBeGreaterThan(0);
    expect(screen.queryByText('PERCENTAGE')).not.toBeInTheDocument();
    expect(screen.queryByText('FIXED_AMOUNT')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new coupon/i })).toBeInTheDocument();
  });

  it('Starter: locked with an upgrade link and no create button', async () => {
    couponsAllowed = false;
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleCoupon],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<CouponsPage />);
    expect(
      await screen.findByRole('heading', { name: /available on the Growth and Business plans/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Upgrade in Plan & billing/i })).toHaveAttribute(
      'href',
      '/dashboard/billing',
    );
    expect(screen.queryByRole('link', { name: /new coupon/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'SUMMER10' })).toBeInTheDocument();
  });

  it('hides New coupon for staff read-only access', async () => {
    canManage = false;
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleCoupon],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<CouponsPage />);
    await screen.findByRole('link', { name: 'SUMMER10' });
    expect(screen.queryByRole('link', { name: /new coupon/i })).not.toBeInTheDocument();
  });

  it('shows create form fields on the new coupon page', async () => {
    render(<NewCouponPage />);
    expect(await screen.findByRole('heading', { name: /new coupon/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/coupon code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/coupon type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/coupon value/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create$/i })).toBeInTheDocument();
  });

  it('uses human labels for coupon types in the form', async () => {
    render(<NewCouponPage />);
    const select = await screen.findByLabelText(/coupon type/i);
    expect(within(select).getByRole('option', { name: 'Percentage' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Fixed amount' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'FIXED_AMOUNT' })).not.toBeInTheDocument();
  });

  it('shows explicit required-field errors when creating an empty coupon', async () => {
    const user = userEvent.setup();
    render(<NewCouponPage />);
    await user.clear(await screen.findByLabelText(/coupon value/i));
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect(await screen.findByText('Coupon code is required.')).toBeInTheDocument();
    expect(screen.getByText('Discount value is required.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows API errors on the list', async () => {
    api.get.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'No access'));
    render(<CouponsPage />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
