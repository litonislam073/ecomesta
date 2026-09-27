import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductCard } from '@/components/product-card';
import NotFound from '@/app/not-found';
import { CartProvider, useCart } from '@/lib/cart';
import { readStoreSlugFromSearch } from '@/lib/store-resolver';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('store=alpha'),
}));

describe('store resolution helpers', () => {
  it('reads store slug from query', () => {
    expect(readStoreSlugFromSearch({ store: 'Demo-Store' })).toBe('demo-store');
    expect(readStoreSlugFromSearch({})).toBeNull();
  });
});

describe('homepage / listing product card', () => {
  it('renders product name, price, and availability', () => {
    render(
      <ProductCard
        storeSlug="alpha"
        product={{
          id: 'p1',
          name: 'Ceramic Mug',
          slug: 'ceramic-mug',
          shortDescription: 'Hand thrown',
          productType: 'PHYSICAL',
          currency: 'BDT',
          price: '450.00',
          compareAtPrice: '500.00',
          sku: null,
          available: true,
          images: [],
          categories: [],
          hasVariants: false,
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Ceramic Mug' })).toBeInTheDocument();
    expect(screen.getByText(/450\.00/)).toBeInTheDocument();
    expect(screen.getByText(/in stock/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ceramic Mug' })).toHaveAttribute(
      'href',
      '/products/ceramic-mug?store=alpha',
    );
  });

  it('shows unavailable state', () => {
    render(
      <ProductCard
        storeSlug="alpha"
        product={{
          id: 'p2',
          name: 'Sold Out',
          slug: 'sold-out',
          shortDescription: null,
          productType: 'PHYSICAL',
          currency: 'USD',
          price: '9.00',
          compareAtPrice: null,
          sku: null,
          available: false,
          images: [],
          categories: [],
          hasVariants: false,
        }}
      />,
    );
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });
});

describe('not-found state', () => {
  it('renders a clean not-found message with a way back home', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText(/does not exist or is no longer available/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the homepage' })).toHaveAttribute('href', '/');
  });
});

function OpenDrawer() {
  const { setDrawerOpen } = useCart();
  return (
    <button type="button" onClick={() => setDrawerOpen(true)}>
      Open
    </button>
  );
}

describe('cart drawer empty state', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows empty cart copy when opened with no lines', async () => {
    const { CartDrawer } = await import('@/components/cart-drawer');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="USD">
        <OpenDrawer />
        <CartDrawer />
      </CartProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: /cart/i })).toBeInTheDocument();
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });
});

describe('category product listing link shape', () => {
  it('keeps product links store-scoped', () => {
    render(
      <ProductCard
        storeSlug="beta-shop"
        product={{
          id: 'p3',
          name: 'Lamp',
          slug: 'lamp',
          shortDescription: null,
          productType: 'PHYSICAL',
          currency: 'EUR',
          price: '40.00',
          compareAtPrice: null,
          sku: null,
          available: true,
          images: [{ url: 'https://example.com/lamp.jpg', alt: 'Lamp' }],
          categories: [{ id: 'c1', name: 'Home', slug: 'home' }],
          hasVariants: false,
        }}
      />,
    );
    expect(screen.getByRole('img', { name: 'Lamp' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')[0]).toHaveAttribute(
      'href',
      '/products/lamp?store=beta-shop',
    );
  });
});
