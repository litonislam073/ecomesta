import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPagesPage from '@/app/dashboard/landing-pages/page';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('Landing page (coming soon)', () => {
  it('says it is coming soon and what it will do', () => {
    render(<LandingPagesPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Landing page' })).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /turn ad clicks into orders/ })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Theme' })).toHaveAttribute('href', '/dashboard/theme');
  });
});
