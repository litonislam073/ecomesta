import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminTenantsPage from '@/app/dashboard/tenants/page';
import AdminTenantDetailPage from '@/app/dashboard/tenants/[tenantId]/page';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantId: 'tenant-1' }),
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

const sampleTenant = {
  id: 'tenant-1',
  name: 'Alpha Group',
  slug: 'alpha',
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  counts: { stores: 3, users: 5 },
};

const sampleDetail = {
  id: 'tenant-1',
  name: 'Alpha Group',
  slug: 'alpha',
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  memberships: [],
  stores: [
    { id: 'store-1', name: 'Alpha Store', slug: 'alpha-store', status: 'ACTIVE' as const },
  ],
  counts: { stores: 1, users: 2, orders: 14 },
  latestSubscription: null,
  recentAuditLogs: [],
};

describe('Admin tenants', () => {
  beforeEach(() => {
    pushToast.mockReset();
    api.get.mockReset();
    api.patch.mockReset();
  });

  it('lists tenants with store and user counts', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleTenant],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<AdminTenantsPage />);

    expect(await screen.findByRole('link', { name: 'Alpha Group' })).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 1 } },
    });
    render(<AdminTenantsPage />);

    expect(await screen.findByText('No tenants found')).toBeInTheDocument();
  });

  it('surfaces API errors', async () => {
    api.get.mockRejectedValue(new ApiError(500, 'INTERNAL', 'Boom'));
    render(<AdminTenantsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
  });

  it('confirms before suspending a tenant', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: sampleDetail });
    api.patch.mockResolvedValue({ success: true, data: sampleDetail });
    render(<AdminTenantDetailPage />);

    await user.click(await screen.findByRole('button', { name: /suspend tenant/i }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Suspend this tenant?');
    expect(api.patch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /update status/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/tenants/tenant-1/status', {
        status: 'SUSPENDED',
      });
    });
    expect(pushToast).toHaveBeenCalledWith('Tenant suspended', 'success');
  });

  it('offers activation for a suspended tenant', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: { ...sampleDetail, status: 'SUSPENDED' as const },
    });
    render(<AdminTenantDetailPage />);

    expect(
      await screen.findByRole('button', { name: /activate tenant/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /suspend tenant/i }),
    ).not.toBeInTheDocument();
  });
});
