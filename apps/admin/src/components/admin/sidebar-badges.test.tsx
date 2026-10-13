import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { SidebarNav } from '@/components/admin/sidebar-nav';
import { refreshAdminBadges } from '@/lib/admin-badges';

let pathname = '/dashboard';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const get = vi.fn();
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get: (...args: unknown[]) => get(...args) } };
});

const link = (name: string) => screen.getByRole('link', { name: new RegExp(`^${name}`) });

beforeEach(() => {
  pathname = '/dashboard';
  get.mockReset();
});

describe('Admin sidebar counters', () => {
  it('shows new users, payments and theme purchases to review', async () => {
    get.mockResolvedValue({ success: true, data: { newUsers: 1, pendingPayments: 3, pendingThemePurchases: 120 } });
    render(<SidebarNav />);
    await waitFor(() => expect(link('Users')).toHaveTextContent('Users1 new'));
    expect(get).toHaveBeenCalledWith('/admin/badges');
    expect(link('Payments')).toHaveTextContent('Payments3 to review');
    expect(link('Theme purchases')).toHaveTextContent('Theme purchases99+ to review');
    // Other menus never get a counter.
    expect(link('Tenants')).toHaveTextContent(/^Tenants$/);
  });

  it('hides a counter at zero and refreshes on demand', async () => {
    get.mockResolvedValueOnce({ success: true, data: { newUsers: 2, pendingPayments: 1, pendingThemePurchases: 0 } });
    render(<SidebarNav />);
    await waitFor(() => expect(within(link('Users')).getByText('2')).toBeInTheDocument());
    expect(link('Theme purchases')).toHaveTextContent(/^Theme purchases$/);

    get.mockResolvedValueOnce({ success: true, data: { newUsers: 0, pendingPayments: 0, pendingThemePurchases: 0 } });
    act(() => refreshAdminBadges());
    await waitFor(() => expect(link('Users')).toHaveTextContent(/^Users$/));
    expect(link('Payments')).toHaveTextContent(/^Payments$/);
  });
});
