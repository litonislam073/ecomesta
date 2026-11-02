import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoreAnalytics } from '@ecomesta/types';
import AnalyticsView from '@/app/dashboard/analytics/analytics-view';
import { DashboardSummary } from '@/components/analytics/dashboard-summary';
import { groupByWeek } from '@/components/analytics/charts';
import { percentChange, presetRange, shiftDate } from '@/lib/analytics';
import { ApiError } from '@/lib/api-client';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ pushToast: vi.fn() }) }));
vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    selectedStore: { id: 'store-1', name: 'Rahim Fashion', timezone: 'Asia/Dhaka', currency: 'BDT' },
    loading: false,
  }),
}));

const get = vi.fn();
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get: (...args: unknown[]) => get(...args) } };
});

const totals = { revenue: 12500, orders: 5, averageOrder: 2500, itemsSold: 9, visitors: 200, pageViews: 640, conversionRate: 2.5 };

function report(overrides: Partial<StoreAnalytics> = {}): StoreAnalytics {
  return {
    full: true,
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
    range: { from: '2026-09-16', to: '2026-10-15', days: 30 },
    previousRange: { from: '2026-08-17', to: '2026-09-15' },
    totals,
    previous: { ...totals, revenue: 10000, orders: 5, visitors: 100 },
    series: Array.from({ length: 30 }, (_, i) => ({ date: shiftDate('2026-09-16', i), revenue: i === 29 ? 2500 : 0, orders: i === 29 ? 1 : 0, visitors: 5 })),
    orderStatuses: [{ status: 'PENDING', orders: 3 }, { status: 'COMPLETED', orders: 2 }],
    topProducts: [{ productId: 'p-1', name: 'Jamdani Saree', quantity: 4, revenue: 6000 }],
    sources: [{ source: 'Facebook', visitors: 120 }, { source: 'Direct', visitors: 80 }],
    pages: [{ path: '/', views: 300 }],
    devices: [{ device: 'MOBILE', visitors: 170 }, { device: 'DESKTOP', visitors: 30 }],
    funnel: { visitors: 200, productViews: 90, addToCart: 20, checkout: 8, orders: 5 },
    paymentMethods: [{ provider: 'COD', orders: 5, revenue: 12500 }],
    customers: { new: 4, returning: 1 },
    ...overrides,
  };
}

describe('Analytics', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('shows sales, visitors and the reports with changes against the previous period', async () => {
    get.mockResolvedValue({ success: true, data: report() });
    render(<AnalyticsView />);

    const summary = await screen.findByRole('region', { name: 'Summary' });
    expect(within(summary).getByText('৳12,500')).toBeInTheDocument();
    expect(within(summary).getByText(/25% up/)).toBeInTheDocument();
    expect(within(summary).getByText('2.5%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jamdani Saree' })).toHaveAttribute('href', '/dashboard/products/p-1');
    expect(screen.getByText('Facebook')).toBeInTheDocument();
    expect(screen.getByText('Added to cart')).toBeInTheDocument();
    expect(screen.getByText('Cash on delivery')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/^\/stores\/store-1\/analytics\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/));
  });

  it('loads another range when a preset is picked', async () => {
    get.mockResolvedValue({ success: true, data: report() });
    render(<AnalyticsView />);
    await screen.findByRole('region', { name: 'Summary' });
    await userEvent.click(screen.getByRole('radio', { name: 'Last 90 days' }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    const url = get.mock.calls[1]![0] as string;
    const [, from, to] = /from=([\d-]+)&to=([\d-]+)/.exec(url)!;
    expect(shiftDate(from!, 89)).toBe(to);
  });

  it('gives Starter the sales overview with locked visitor numbers and longer ranges', async () => {
    get.mockResolvedValue({
      success: true,
      data: report({
        full: false,
        totals: { ...totals, visitors: null, pageViews: null, conversionRate: null },
        topProducts: null,
        sources: null,
        pages: null,
        devices: null,
        funnel: null,
        paymentMethods: null,
        customers: null,
      }),
    });
    render(<AnalyticsView />);
    await screen.findByRole('region', { name: 'Summary' });
    expect(screen.getAllByRole('link', { name: 'Included on Growth and Business' })).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /Last 90 days/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Last 7 days' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
    expect(screen.getByText('Full analytics on Growth and Business')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Visitors' })).toBeNull();
  });

  it('explains when the plan does not cover the range', async () => {
    get.mockRejectedValue(new ApiError(403, 'PLAN_UPGRADE_REQUIRED', 'Full analytics are not included in your plan.'));
    render(<AnalyticsView />);
    expect(await screen.findByText('Full analytics on Growth and Business')).toBeInTheDocument();
  });

  it('shows today and the last 7 days on the dashboard home', async () => {
    get.mockResolvedValue({ success: true, data: report({ series: report().series.slice(-7) }) });
    render(<DashboardSummary storeId="store-1" timezone="Asia/Dhaka" />);
    expect(await screen.findByText('Today’s sales')).toBeInTheDocument();
    expect(screen.getByText('Sales, last 7 days', { selector: 'p' }).nextSibling).toHaveTextContent('৳12,500');
    expect(screen.getByRole('link', { name: /View analytics/ })).toHaveAttribute('href', '/dashboard/analytics');
  });
});

describe('analytics helpers', () => {
  it('computes ranges, changes and weekly groups', () => {
    const r = presetRange('7d', 'Asia/Dhaka')!;
    expect(shiftDate(r.from, 6)).toBe(r.to);
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(null, 10)).toBeNull();
    const days = Array.from({ length: 120 }, (_, i) => ({ date: shiftDate('2026-01-01', i), value: 1 }));
    const weeks = groupByWeek(days);
    expect(weeks).toHaveLength(18);
    expect(weeks[0]).toEqual({ date: '2026-01-01', value: 7 });
  });
});
