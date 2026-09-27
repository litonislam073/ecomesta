import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewStoreLink } from './view-store-link';

let selectedStore: { id: string; name: string; slug: string } | null = null;

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({ selectedStore }),
}));

describe('ViewStoreLink', () => {
  beforeEach(() => {
    selectedStore = { id: 'store-1', name: 'Alpha Store', slug: 'alpha shop' };
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'https://shop.example.com/');
  });

  it('opens the selected storefront in a new tab', () => {
    render(<ViewStoreLink />);
    const link = screen.getByRole('link', { name: /view store alpha store/i });
    expect(link).toHaveAttribute('href', 'https://shop.example.com/?store=alpha%20shop');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links to the store subdomain on a deployed platform domain', () => {
    selectedStore = { id: 'store-1', name: 'Alpha Store', slug: 'alpha-shop' };
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'https://ecomesta.com');
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN', 'ecomesta.com');
    render(<ViewStoreLink />);
    expect(screen.getByRole('link', { name: /view store alpha store/i })).toHaveAttribute(
      'href',
      'https://alpha-shop.ecomesta.com/',
    );
  });

  it('keeps the ?store= preview on localhost even when a root domain is set', () => {
    selectedStore = { id: 'store-1', name: 'Alpha Store', slug: 'alpha-shop' };
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'http://localhost:3000');
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN', 'ecomesta.local');
    render(<ViewStoreLink />);
    expect(screen.getByRole('link', { name: /view store alpha store/i })).toHaveAttribute(
      'href',
      'http://localhost:3000/?store=alpha-shop',
    );
  });

  it('renders nothing without a selected store', () => {
    selectedStore = null;
    const { container } = render(<ViewStoreLink />);
    expect(container).toBeEmptyDOMElement();
  });
});
