import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { ToastProvider, useToast } from '@/components/ui/toast';

// TE-07: the shell header must never force the page wider than the viewport.
// Layout itself is measured in the browser suite; these tests pin the
// responsive contract jsdom can see (truncation, shrink/wrap classes, Escape).

const get = vi.fn();
const LONG_NAME = 'Maximiliana-Alexandrina Worthington-Featherstonehaugh';
const LONG_EMAIL = 'maximiliana.alexandrina.worthington@an-extremely-long-domain.example.com';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/dashboard/theme',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get: (...args: unknown[]) => get(...args), post: vi.fn() } };
});

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      email: LONG_EMAIL,
      firstName: 'Maximiliana-Alexandrina',
      lastName: 'Worthington-Featherstonehaugh',
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      memberships: { tenants: [{ tenantId: 't1', role: 'OWNER' }], stores: [{ storeId: 's1' }] },
    },
    loading: false,
    accessToken: 'token',
    logout: vi.fn(),
  }),
}));

vi.mock('@/components/dashboard/sidebar-nav', () => ({
  SidebarNav: () => <a href="/dashboard/orders">Orders</a>,
}));
vi.mock('@/components/dashboard/store-selector', () => ({ StoreSelector: () => <span>store</span> }));
vi.mock('@/components/dashboard/view-store-link', () => ({ ViewStoreLink: () => <span>view</span> }));

function renderShell() {
  get.mockResolvedValue({
    success: true,
    data: {
      tenantName: 'Demo',
      canManage: true,
      onlinePaymentAvailable: false,
      subscription: null,
    },
  });
  return render(
    <DashboardShell>
      <p>Theme page</p>
    </DashboardShell>,
  );
}

describe('Dashboard shell responsive header (TE-07)', () => {
  beforeEach(() => get.mockReset());

  it('truncates a long name and email, keeping the full text available', async () => {
    renderShell();
    const name = await screen.findByText(LONG_NAME);
    const email = screen.getByText(LONG_EMAIL);
    expect(name).toHaveClass('truncate');
    expect(name).toHaveAttribute('title', LONG_NAME);
    expect(email).toHaveClass('truncate');
    expect(email).toHaveAttribute('title', LONG_EMAIL);
    // The block can shrink below its text width instead of widening the header.
    expect(name.parentElement).toHaveClass('min-w-0');
  });

  it('lets the header wrap and its groups shrink; essential controls never shrink', async () => {
    renderShell();
    const menu = await screen.findByRole('button', { name: 'Menu' });
    const row = menu.closest('header')!.firstElementChild!;
    expect(row).toHaveClass('flex-wrap');
    const [left, right] = Array.from(row.children);
    expect(left).toHaveClass('min-w-0');
    expect(left).toHaveClass('flex-auto'); // content-based basis so the row wraps rather than squeezes
    expect(right).toHaveClass('min-w-0');
    expect(menu).toHaveClass('shrink-0');
    expect(screen.getByRole('button', { name: 'Log out' })).toHaveClass('shrink-0');
  });

  it('the mobile navigation panel opens from Menu and closes on Escape, returning focus', async () => {
    const user = userEvent.setup();
    renderShell();
    const menu = await screen.findByRole('button', { name: 'Menu' });
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('mobile-sidebar')).not.toBeNull();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.getElementById('mobile-sidebar')).toBeNull());
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();
  });
});

describe('Toast container (TE-07)', () => {
  function Trigger() {
    const { pushToast } = useToast();
    return <button onClick={() => pushToast('Saved', 'success')}>toast</button>;
  }

  it('is inset on both sides on small screens and capped on larger ones', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'toast' }));
    const container = screen.getByRole('status').parentElement!;
    for (const cls of ['fixed', 'left-4', 'right-4', 'sm:left-auto', 'sm:max-w-sm']) {
      expect(container).toHaveClass(cls);
    }
    expect(container).not.toHaveClass('w-full');
  });
});
