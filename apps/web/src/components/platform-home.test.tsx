import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_HOME_METADATA, PlatformHome } from '@/components/platform-home';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ priority: _priority, ...props }: Record<string, unknown>) => <img {...props} />,
}));

const MERCHANT = 'https://merchant.example.com';

describe('PlatformHome', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_MERCHANT_URL', MERCHANT);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('renders a single H1 with the hero headline', () => {
    render(<PlatformHome />);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(
      'Build Your Online Store. Sell More. Manage Everything in One Place.',
    );
  });

  it('points hero CTAs to merchant register and the features page', () => {
    render(<PlatformHome />);
    const hero = screen.getByRole('heading', { level: 1 }).closest('section')!;
    expect(
      within(hero).getByRole('link', { name: 'Create Your Store' }),
    ).toHaveAttribute('href', `${MERCHANT}/register`);
    expect(
      within(hero).getByRole('link', { name: 'Explore Features' }),
    ).toHaveAttribute('href', '/features');
  });

  it('renders header navigation with login and register links from env', () => {
    render(<PlatformHome />);
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    for (const label of ['Features', 'Payments', 'Shipping', 'Pricing', 'Resources']) {
      expect(within(primary).getByRole('link', { name: label })).toBeInTheDocument();
    }
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      `${MERCHANT}/login`,
    );
    expect(
      within(header).getByRole('link', { name: 'Create Your Store' }),
    ).toHaveAttribute('href', `${MERCHANT}/register`);
  });

  it('never links to localhost merchant URLs when configured', () => {
    const { container } = render(<PlatformHome />);
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs.some((href) => href?.includes('localhost'))).toBe(false);
  });

  it('includes the required homepage sections', () => {
    render(<PlatformHome />);
    for (const heading of [
      /Accept Payments Your Customers Prefer/i,
      /Everything you need to sell online/i,
      /Delivery charges that follow real delivery areas/i,
      /Questions before you start/i,
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
  });

  it('opens and closes the mobile menu accessibly', async () => {
    const user = userEvent.setup();
    render(<PlatformHome />);
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const mobile = screen.getByRole('navigation', { name: 'Mobile' });
    expect(within(mobile).getByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      `${MERCHANT}/login`,
    );

    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('emits structured data without ratings', () => {
    const { container } = render(<PlatformHome />);
    const types = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]'),
    ).flatMap((node) => JSON.parse(node.textContent ?? '{}'));
    const typeNames = types.map((t) => t['@type']);
    expect(typeNames).toEqual(
      expect.arrayContaining(['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']),
    );
    expect(JSON.stringify(types)).not.toMatch(/aggregateRating|reviewCount/i);
  });

  it('exports unique homepage metadata', () => {
    expect(PLATFORM_HOME_METADATA.title).toBeTruthy();
    expect(PLATFORM_HOME_METADATA.description).toBeTruthy();
  });
});
