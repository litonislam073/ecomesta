import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginRoute, { metadata as loginMetadata } from '@/app/login/page';
import RegisterRoute, { metadata as registerMetadata } from '@/app/register/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/auth-context', () => ({
  hasSessionHint: () => false,
  useAuth: () => ({ login: vi.fn(), register: vi.fn(), user: null, loading: false }),
}));

const SITE = 'https://ecomesta.example';

const ROUTES = [
  { name: 'login', Route: LoginRoute, heading: 'Welcome back', current: 'Login' },
  { name: 'register', Route: RegisterRoute, heading: 'Create your store', current: null },
] as const;

describe('Auth pages inside the marketing shell', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', SITE);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  for (const { name, Route, heading } of ROUTES) {
    describe(`/${name}`, () => {
      it('renders the marketing header with links back to the marketing site', () => {
        render(<Route />);
        const header = screen.getByRole('banner');
        expect(within(header).getByRole('link', { name: 'Ecomesta' })).toHaveAttribute('href', `${SITE}/`);
        const primary = within(header).getByRole('navigation', { name: 'Primary' });
        for (const [label, path] of [
          ['Features', '/features'],
          ['Payments', '/payments'],
          ['Shipping', '/shipping'],
          ['Pricing', '/pricing'],
          ['Solutions', '/solutions'],
          ['Resources', '/resources'],
        ]) {
          expect(within(primary).getByRole('link', { name: label })).toHaveAttribute('href', `${SITE}${path}`);
        }
        expect(within(header).getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
        expect(within(header).getByRole('link', { name: 'Create Your Store' })).toHaveAttribute('href', '/register');
      });

      it('renders the marketing footer with marketing-site links only', () => {
        render(<Route />);
        const footer = screen.getByRole('contentinfo');
        const nav = within(footer).getByRole('navigation', { name: 'Footer' });
        const hrefs = within(nav).getAllByRole('link').map((a) => a.getAttribute('href'));
        expect(hrefs.length).toBeGreaterThan(10);
        expect(hrefs.every((href) => href?.startsWith(`${SITE}/`))).toBe(true);
        expect(within(footer).getByText(/Ecomesta. All rights reserved/)).toBeInTheDocument();
      });

      it('renders the auth card with a single page heading', () => {
        render(<Route />);
        const h1s = screen.getAllByRole('heading', { level: 1 });
        expect(h1s).toHaveLength(1);
        expect(h1s[0]).toHaveTextContent(heading);
        expect(screen.getByRole('main')).toContainElement(h1s[0] ?? null);
      });

      it('never links to localhost when the marketing URL is configured', () => {
        const { container } = render(<Route />);
        const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
        expect(hrefs.some((href) => href.includes('localhost'))).toBe(false);
      });
    });
  }

  it('marks the current page in the header on /login', () => {
    render(<LoginRoute />);
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Login' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('keeps the responsive mobile menu with login and register', async () => {
    const user = userEvent.setup();
    render(<RegisterRoute />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const mobile = screen.getByRole('navigation', { name: 'Mobile' });
    expect(within(mobile).getByRole('link', { name: 'Solutions' })).toHaveAttribute('href', `${SITE}/solutions`);
    expect(within(mobile).getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(within(mobile).getByRole('link', { name: 'Create Your Store' })).toHaveAttribute('href', '/register');
  });

  it('keeps both auth pages out of search indexes without a canonical', () => {
    for (const metadata of [loginMetadata, registerMetadata]) {
      expect(metadata.robots).toEqual({ index: false, follow: false });
      expect(metadata.alternates).toBeUndefined();
    }
  });
});
