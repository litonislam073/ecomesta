import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminShell } from '@/components/admin/admin-shell';
import type { AuthUser } from '@/lib/auth-context';

const logout = vi.fn();
const replace = vi.fn();

const superAdmin: AuthUser = {
  id: 'u-1',
  email: 'admin@ecomesta.local',
  firstName: 'Ada',
  lastName: 'Admin',
  platformRole: 'SUPER_ADMIN',
  status: 'ACTIVE',
  memberships: { tenants: [], stores: [] },
};

const merchant: AuthUser = { ...superAdmin, email: 'shop@example.com', platformRole: 'USER' };

let authState: {
  user: AuthUser | null;
  loading: boolean;
  isSuperAdmin: boolean;
} = { user: superAdmin, loading: false, isSuperAdmin: true };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/dashboard/users',
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ ...authState, logout }),
}));

describe('Admin shell auth gate', () => {
  beforeEach(() => {
    logout.mockReset();
    logout.mockResolvedValue(undefined);
    replace.mockReset();
    authState = { user: superAdmin, loading: false, isSuperAdmin: true };
  });

  it('renders the console and nav for a Super Admin', () => {
    render(
      <AdminShell>
        <p>Platform content</p>
      </AdminShell>,
    );

    expect(screen.getByText('Platform content')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /platform admin/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Audit Logs' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute('href', '/dashboard/email');
  });

  it('truncates a long admin email in the header instead of widening the page on phones', () => {
    const longEmail = 'platform.operations.supervisor@ecomesta-example.com';
    authState = { user: { ...superAdmin, email: longEmail }, loading: false, isSuperAdmin: true };
    render(
      <AdminShell>
        <p>Platform content</p>
      </AdminShell>,
    );

    const email = screen.getByText(longEmail);
    expect(email).toHaveClass('truncate');
    expect(email).toHaveAttribute('title', longEmail);
    // The header block must be allowed to shrink for truncation to apply.
    expect(email.parentElement).toHaveClass('min-w-0');
    expect(email.parentElement?.parentElement).toHaveClass('min-w-0');
    expect(screen.getByRole('button', { name: 'Log out' })).toHaveClass('shrink-0');
  });

  it('shows a session placeholder while the refresh call is in flight', () => {
    authState = { user: null, loading: true, isSuperAdmin: false };
    render(
      <AdminShell>
        <p>Platform content</p>
      </AdminShell>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Platform content')).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to login', () => {
    authState = { user: null, loading: false, isSuperAdmin: false };
    render(
      <AdminShell>
        <p>Platform content</p>
      </AdminShell>,
    );

    expect(replace).toHaveBeenCalledWith('/login?next=%2Fdashboard%2Fusers');
    expect(screen.queryByText('Platform content')).not.toBeInTheDocument();
  });

  it('denies a non-admin session instead of rendering the dashboard', () => {
    authState = { user: merchant, loading: false, isSuperAdmin: false };
    render(
      <AdminShell>
        <p>Platform content</p>
      </AdminShell>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
    expect(screen.queryByText('Platform content')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('logs the non-admin out and returns them to login', async () => {
    const user = userEvent.setup();
    authState = { user: merchant, loading: false, isSuperAdmin: false };
    render(
      <AdminShell>
        <p>Platform content</p>
      </AdminShell>,
    );

    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(logout).toHaveBeenCalled();
  });
});
