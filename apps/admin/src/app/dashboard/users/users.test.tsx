import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminUsersPage from '@/app/dashboard/users/page';
import AdminUserDetailPage from '@/app/dashboard/users/[userId]/page';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ userId: 'user-1' }),
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

const sampleUser = {
  id: 'user-1',
  email: 'owner@example.com',
  firstName: 'Olive',
  lastName: 'Owner',
  phone: null,
  platformRole: 'USER' as const,
  status: 'ACTIVE' as const,
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-02-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const sampleDetail = {
  ...sampleUser,
  tenantMemberships: [
    {
      id: 'tm-1',
      role: 'OWNER' as const,
      status: 'ACTIVE' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      tenant: {
        id: 'tenant-1',
        name: 'Alpha Group',
        slug: 'alpha',
        status: 'ACTIVE' as const,
      },
    },
  ],
  storeMemberships: [],
};

describe('Admin users', () => {
  beforeEach(() => {
    pushToast.mockReset();
    api.get.mockReset();
    api.patch.mockReset();
  });

  it('lists users with status and role columns', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleUser],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<AdminUsersPage />);

    expect(
      await screen.findByRole('link', { name: 'owner@example.com' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Olive Owner')).toBeInTheDocument();
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
  });

  it('passes search and filter values to the API', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleUser],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<AdminUsersPage />);
    await screen.findByRole('link', { name: 'owner@example.com' });

    await user.type(screen.getByLabelText('Search users'), 'owner');
    await user.selectOptions(screen.getByLabelText('Status filter'), 'SUSPENDED');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      const paths = api.get.mock.calls.map((call) => String(call[0]));
      expect(paths.some((path) => path.includes('status=SUSPENDED'))).toBe(true);
      expect(paths.some((path) => path.includes('search=owner'))).toBe(true);
    });
  });

  it('never renders hashed credentials from the API payload', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [{ ...sampleUser, passwordHash: '$2b$10$superSecretHash' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<AdminUsersPage />);

    await screen.findByRole('link', { name: 'owner@example.com' });
    expect(screen.queryByText(/\$2b\$10\$/)).not.toBeInTheDocument();
  });

  it('shows API errors on the list', async () => {
    api.get.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'No access'));
    render(<AdminUsersPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('requires confirmation before suspending a user', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: sampleDetail });
    api.patch.mockResolvedValue({ success: true, data: sampleDetail });
    render(<AdminUserDetailPage />);

    await user.click(await screen.findByRole('button', { name: /suspend user/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Suspend this user?');
    expect(api.patch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /update status/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/users/user-1/status', {
        status: 'SUSPENDED',
      });
    });
    expect(pushToast).toHaveBeenCalledWith('User suspended', 'success');
  });

  it('cancels a suspension without calling the API', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: sampleDetail });
    render(<AdminUserDetailPage />);

    await user.click(await screen.findByRole('button', { name: /suspend user/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('confirms a platform role change and reports last-admin protection', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      success: true,
      data: { ...sampleDetail, platformRole: 'SUPER_ADMIN' },
    });
    api.patch.mockRejectedValue(
      new ApiError(422, 'UNPROCESSABLE', 'Cannot demote the last active Super Admin'),
    );
    render(<AdminUserDetailPage />);

    await screen.findByRole('button', { name: /suspend user/i });
    await user.selectOptions(screen.getByLabelText('Role'), 'USER');
    await user.click(screen.getByRole('button', { name: /change role/i }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Revoke Super Admin?');

    await user.click(screen.getByRole('button', { name: 'Confirm role change' }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/users/user-1/platform-role', {
        platformRole: 'USER',
      });
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot demote the last active Super Admin. Promote another account first.',
    );
  });
});
