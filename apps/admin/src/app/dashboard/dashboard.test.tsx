import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminDashboardPage from '@/app/dashboard/page';
import { ApiError } from '@/lib/api-client';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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

const stats = {
  users: { total: 42, active: 40 },
  tenants: { total: 7, active: 6 },
  stores: { total: 12, active: 11 },
  subscriptions: { total: 5, active: 4 },
  orders: { total: 318 },
  orderRevenueSum: '14250.75',
  recentAuditCount: 23,
  generatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Admin dashboard', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('renders platform metrics from /admin/stats', async () => {
    api.get.mockResolvedValue({ success: true, data: stats });
    render(<AdminDashboardPage />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/stats');
    expect(screen.getByText('40 active')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('318')).toBeInTheDocument();
    expect(screen.getByText('14250.75')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
  });

  it('links each metric to its management area', async () => {
    api.get.mockResolvedValue({ success: true, data: stats });
    render(<AdminDashboardPage />);

    await screen.findByText('42');
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/dashboard/users');
    expect(hrefs).toContain('/dashboard/tenants');
    expect(hrefs).toContain('/dashboard/audit-logs');
  });

  it('surfaces API failures', async () => {
    api.get.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Insufficient permissions'));
    render(<AdminDashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This action requires the Super Admin platform role.',
    );
  });
});
