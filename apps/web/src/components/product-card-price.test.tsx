import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicProductCard } from '@ecomesta/types';
import { ProductCard, productCardPrice } from '@/components/product-card';
import { CartProvider, useCart } from '@/lib/cart';

/** Regression: cards for products with variants showed the placeholder base price (BDT 0.00). */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('store=alpha'),
}));

const card = (overrides: Partial<PublicProductCard> = {}): PublicProductCard => ({
  id: 'p1',
  name: 'Kurta',
  slug: 'kurta',
  shortDescription: null,
  productType: 'PHYSICAL',
  currency: 'BDT',
  price: '1200.00',
  compareAtPrice: null,
  sku: null,
  available: true,
  images: [],
  categories: [],
  hasVariants: false,
  variantPriceMin: null,
  variantPriceMax: null,
  ...overrides,
});

const variantCard = (min: string | null, max: string | null, overrides: Partial<PublicProductCard> = {}) =>
  card({ name: 'Tee', slug: 'tee', price: '0.00', hasVariants: true, available: min !== null, variantPriceMin: min, variantPriceMax: max, ...overrides });

function CartCount() {
  const { lines } = useCart();
  return <output data-testid="cart">{lines.map((l) => `${l.productId}:${l.unitPrice}x${l.quantity}`).join(',')}</output>;
}

function renderCard(product: PublicProductCard) {
  return render(
    <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
      <ProductCard product={product} storeSlug="alpha" />
      <CartCount />
    </CartProvider>,
  );
}

// Intl separates the currency code with a no-break space.
const plain = (text: string | null) => (text ?? '').replace(/\u00a0/g, ' ');
const cardText = () => plain(screen.getByRole('article').textContent);

describe('product card price', () => {
  beforeEach(() => window.localStorage.clear());

  it('A — a simple product shows its own price (and compare-at price)', () => {
    renderCard(card({ compareAtPrice: '1500.00' }));
    expect(cardText()).toContain('BDT 1,200.00');
    expect(cardText()).toContain('BDT 1,500.00');
  });

  it('B — one available variant shows that variant’s price, never the 0.00 base price', () => {
    renderCard(variantCard('650.00', '650.00'));
    expect(cardText()).toContain('BDT 650.00');
    expect(cardText()).not.toContain('0.00 ');
    expect(cardText()).not.toMatch(/BDT 0\.00/);
    expect(cardText()).not.toContain('From');
  });

  it('C — equal variant prices show the one price', () => {
    expect(plain(productCardPrice(variantCard('650.00', '650.00')))).toBe('BDT 650.00');
  });

  it('D — different variant prices show "From" the lowest', () => {
    renderCard(variantCard('650.00', '950.00'));
    expect(cardText()).toContain('From BDT 650.00');
    expect(cardText()).not.toContain('950.00');
  });

  it('E — the range comes from available variants only (the server leaves the sold-out 300 out)', () => {
    renderCard(variantCard('700.00', '700.00'));
    expect(cardText()).toContain('BDT 700.00');
    expect(cardText()).not.toContain('300.00');
  });

  it('F — no available variant shows no price, the existing Unavailable state and a disabled action', () => {
    renderCard(variantCard(null, null, { compareAtPrice: '999.00' }));
    expect(cardText()).not.toMatch(/BDT/);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Tee to cart' })).toBeDisabled();
  });

  it('never shows the product-level compare-at price on a product with variants', () => {
    renderCard(variantCard('650.00', '800.00', { compareAtPrice: '2000.00' }));
    expect(cardText()).not.toContain('2,000.00');
  });

  it('keeps Add to cart for simple products, at the product price', async () => {
    const user = userEvent.setup();
    renderCard(card());
    await user.click(screen.getByRole('button', { name: 'Add Kurta to cart' }));
    expect(screen.getByTestId('cart')).toHaveTextContent('p1:1200.00x1');
  });

  it('keeps Choose options for products with variants', () => {
    renderCard(variantCard('650.00', '950.00'));
    expect(screen.getByRole('link', { name: 'Choose options' })).toHaveAttribute('href', '/products/tee?store=alpha');
    expect(screen.queryByRole('button', { name: /to cart/ })).toBeNull();
  });
});
