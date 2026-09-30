import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicProductCard } from '@ecomesta/types';
import { CartDrawer } from '@/components/cart-drawer';
import { ProductCard } from '@/components/product-card';
import { FeaturedProducts } from '@/components/storefront/featured-products';
import { CartProvider, useCart } from '@/lib/cart';

/** Regression: product cards had no Add to cart action. */

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('store=alpha'),
}));

const card = (overrides: Partial<PublicProductCard> = {}): PublicProductCard => ({
  id: 'p1',
  name: 'Ceramic Mug',
  slug: 'ceramic-mug',
  shortDescription: null,
  productType: 'PHYSICAL',
  currency: 'BDT',
  price: '450.00',
  compareAtPrice: null,
  sku: 'MUG-1',
  available: true,
  images: [{ url: 'https://cdn.example/mug.jpg', alt: 'Mug' }],
  categories: [],
  hasVariants: false,
  ...overrides,
});

function CartProbe() {
  const { itemCount, lines } = useCart();
  return (
    <output data-testid="cart">
      {itemCount}|{lines.map((l) => `${l.productId}:${l.variantId ?? '-'}:${l.unitPrice}x${l.quantity}`).join(',')}
    </output>
  );
}

function renderInStore(ui: React.ReactNode) {
  return render(
    <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
      {ui}
      <CartProbe />
      <CartDrawer />
    </CartProvider>,
  );
}

describe('product card Add to cart', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows Add to cart under an available product and adds it to the existing cart', async () => {
    const user = userEvent.setup();
    renderInStore(<ProductCard product={card()} storeSlug="alpha" />);

    const button = screen.getByRole('button', { name: 'Add Ceramic Mug to cart' });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Add to cart');
    expect(screen.getByTestId('cart')).toHaveTextContent('0|');

    await user.click(button);
    expect(screen.getByTestId('cart')).toHaveTextContent('1|p1:-:450.00x1');
    // The existing cart drawer opens with the product in it.
    const drawer = screen.getByRole('dialog', { name: 'Cart' });
    expect(within(drawer).getByText('Ceramic Mug')).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: 'Close cart' }));
    await user.click(button);
    expect(screen.getByTestId('cart')).toHaveTextContent('2|p1:-:450.00x2');
    const stored = JSON.parse(window.localStorage.getItem('ecomesta_cart_alpha') ?? '{}');
    expect(stored.lines).toEqual([
      expect.objectContaining({ productId: 'p1', productSlug: 'ceramic-mug', sku: 'MUG-1', variantId: null, unitPrice: '450.00', quantity: 2, imageUrl: 'https://cdn.example/mug.jpg' }),
    ]);
  });

  it('keeps an unavailable product out of the cart', async () => {
    const user = userEvent.setup();
    renderInStore(<ProductCard product={card({ id: 'p2', name: 'Sold Out', available: false })} storeSlug="alpha" />);

    const button = screen.getByRole('button', { name: 'Add Sold Out to cart' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    await user.click(button);
    expect(screen.getByTestId('cart')).toHaveTextContent('0|');
  });

  it('sends products with variants to the product page to choose one', () => {
    renderInStore(<ProductCard product={card({ id: 'p3', name: 'Tee', slug: 'tee', hasVariants: true })} storeSlug="alpha" />);

    expect(screen.getByRole('link', { name: 'Choose options' })).toHaveAttribute('href', '/products/tee?store=alpha');
    expect(screen.queryByRole('button', { name: /to cart/i })).toBeNull();
  });

  it('disables the action when no variant of the product is available', () => {
    renderInStore(<ProductCard product={card({ id: 'p4', name: 'Gone Tee', hasVariants: true, available: false })} storeSlug="alpha" />);

    expect(screen.getByRole('button', { name: 'Add Gone Tee to cart' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Choose options' })).toBeNull();
  });

  it('renders the action on every card of the homepage featured-products section', async () => {
    const user = userEvent.setup();
    renderInStore(
      <FeaturedProducts
        storeSlug="alpha"
        products={[card(), card({ id: 'p5', name: 'Plate', slug: 'plate', price: '300.00' })]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Latest products' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Plate to cart' }));
    expect(screen.getByTestId('cart')).toHaveTextContent('1|p5:-:300.00x1');
    expect(screen.getByRole('button', { name: 'Add Ceramic Mug to cart' })).toBeEnabled();
  });
});
