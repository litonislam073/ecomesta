import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditLogsView from '@/app/dashboard/audit-logs/audit-logs-view';
import { ApiError } from '@/lib/api-client';

let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

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

const sampleEntry = {
  id: 'log-1',
  action: 'TENANT_SUSPENDED',
  entityType: 'Tenant',
  entityId: 'tenant-1',
  tenantId: 'tenant-1',
  storeId: null,
  userId: 'user-1',
  metadata: { slug: 'alpha', status: 'SUSPENDED' },
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
  createdAt: '2026-02-01T10:00:00.000Z',
  user: { id: 'user-1', email: 'admin@ecomesta.local' },
};

describe('Admin audit logs', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    api.get.mockReset();
  });

  it('lists audit entries with actor and metadata', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleEntry],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<AuditLogsView />);

    expect(await screen.findByText('TENANT_SUSPENDED')).toBeInTheDocument();
    expect(screen.getByText('admin@ecomesta.local')).toBeInTheDocument();
    expect(screen.getByText(/slug: alpha/)).toBeInTheDocument();
  });

  it('seeds the tenant filter from the query string', async () => {
    searchParams = new URLSearchParams('tenantId=tenant-9');
    api.get.mockResolvedValue({
      success: true,
      data: { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 1 } },
    });
    render(<AuditLogsView />);

    await waitFor(() => {
      expect(String(api.get.mock.calls[0]?.[0])).toContain('tenantId=tenant-9');
    });
    expect(screen.getByLabelText('Tenant ID')).toHaveValue('tenant-9');
  });

  it('sends the action filter to the API', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleEntry],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<AuditLogsView />);
    await screen.findByText('TENANT_SUSPENDED');

    await user.type(screen.getByLabelText('Action'), 'STORE_SUSPENDED');
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    await waitFor(() => {
      const paths = api.get.mock.calls.map((call) => String(call[0]));
      expect(paths.some((path) => path.includes('action=STORE_SUSPENDED'))).toBe(true);
    });
  });

  it('redacts credential-like metadata keys', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            ...sampleEntry,
            metadata: { refreshToken: 'abc123', passwordHash: 'xyz', slug: 'alpha' },
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<AuditLogsView />);

    await screen.findByText('TENANT_SUSPENDED');
    expect(screen.queryByText(/abc123/)).not.toBeInTheDocument();
    expect(screen.getByText(/refreshToken: \[redacted\]/)).toBeInTheDocument();
  });

  it('rejects an inverted date range before calling the API', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      success: true,
      data: { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 1 } },
    });
    render(<AuditLogsView />);
    await screen.findByText('No audit entries');
    api.get.mockClear();

    await user.type(screen.getByLabelText('From'), '2026-03-01');
    await user.type(screen.getByLabelText('To'), '2026-01-01');
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'must be after the "from" date',
    );
    expect(api.get).not.toHaveBeenCalled();
  });

  it('surfaces API errors', async () => {
    api.get.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Nope'));
    render(<AuditLogsView />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
