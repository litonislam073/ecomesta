import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('Sidebar new-order badge', () => {
  it('shows how many orders are new next to Orders', () => {
    render(<SidebarNav badges={{ '/dashboard/orders': 5 }} />);
    expect(screen.getByRole('link', { name: 'Orders 5 new' })).toBeInTheDocument();
  });

  it('caps a large count at 99+', () => {
    render(<SidebarNav badges={{ '/dashboard/orders': 240 }} />);
    expect(screen.getByRole('link', { name: 'Orders 99+ new' })).toBeInTheDocument();
  });

  it('marks Theme as New', () => {
    render(<SidebarNav />);
    expect(screen.getByRole('link', { name: 'Theme New' })).toHaveAttribute('href', '/dashboard/theme');
  });

  it('lists Landing page under Marketing as Coming soon', () => {
    render(<SidebarNav />);
    expect(screen.getByRole('link', { name: 'Landing page Coming soon' })).toHaveAttribute('href', '/dashboard/landing-pages');
  });

  it('shows no badge when nothing is new', () => {
    render(<SidebarNav badges={{ '/dashboard/orders': 0 }} />);
    expect(screen.getByRole('link', { name: 'Orders' })).toBeInTheDocument();
  });
});
