import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicProductCard } from '@ecomesta/types';
import { AddToCartPanel } from '@/components/add-to-cart-panel';
import { CartDrawer } from '@/components/cart-drawer';
import { ProductCard } from '@/components/product-card';
import { FeaturedProducts } from '@/components/storefront/featured-products';
import { CartProvider, useCart } from '@/lib/cart';

/** Regression: product cards had no Add to cart action. */

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
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
  beforeEach(() => {
    window.localStorage.clear();
    pushMock.mockReset();
  });

  it('shows Add to cart under an available product and adds it to the existing cart', async () => {
    const user = userEvent.setup();
    renderInStore(<ProductCard product={card()} storeSlug="alpha" />);

    const button = screen.getByRole('button', { name: 'Add Ceramic Mug to cart' });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Add to cart');
    expect(screen.getByTestId('cart')).toHaveTextContent('0|');

    await user.click(button);
    expect(screen.getByTestId('cart')).toHaveTextContent('1|p1:-:450.00x1');
    // No cart popup: the product goes to the cart and the button becomes View cart.
    expect(screen.queryByRole('dialog', { name: 'Cart' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Ceramic Mug to cart' })).toBeNull();
    expect(screen.getByRole('link', { name: 'View cart (Ceramic Mug added)' })).toHaveAttribute(
      'href',
      '/cart?store=alpha',
    );
    expect(screen.getByRole('button', { name: 'Order Ceramic Mug now' })).toBeEnabled();
    const stored = JSON.parse(window.localStorage.getItem('ecomesta_cart_alpha') ?? '{}');
    expect(stored.lines).toEqual([
      expect.objectContaining({ productId: 'p1', productSlug: 'ceramic-mug', sku: 'MUG-1', variantId: null, unitPrice: '450.00', quantity: 1, imageUrl: 'https://cdn.example/mug.jpg' }),
    ]);
  });

  it('shows View cart on load for a product already in the saved cart', async () => {
    window.localStorage.setItem(
      'ecomesta_cart_alpha',
      JSON.stringify({
        storeId: 's1',
        storeSlug: 'alpha',
        currency: 'BDT',
        couponCode: null,
        lines: [{ productId: 'p1', productSlug: 'ceramic-mug', productName: 'Ceramic Mug', variantId: null, variantName: null, sku: 'MUG-1', unitPrice: '450.00', quantity: 1, imageUrl: null }],
      }),
    );
    renderInStore(
      <>
        <ProductCard product={card()} storeSlug="alpha" />
        <ProductCard product={card({ id: 'p7', name: 'Bowl', slug: 'bowl' })} storeSlug="alpha" />
      </>,
    );

    expect(await screen.findByRole('link', { name: 'View cart (Ceramic Mug added)' })).toBeInTheDocument();
    // Other products keep their own Add to cart.
    expect(screen.getByRole('button', { name: 'Add Bowl to cart' })).toBeEnabled();
  });

  it('keeps an unavailable product out of the cart', async () => {
    const user = userEvent.setup();
    renderInStore(<ProductCard product={card({ id: 'p2', name: 'Sold Out', available: false })} storeSlug="alpha" />);

    const button = screen.getByRole('button', { name: 'Add Sold Out to cart' });
    expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Order Sold Out now' })).toBeDisabled();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    await user.click(button);
    expect(screen.getByTestId('cart')).toHaveTextContent('0|');
  });

  it('sends products with variants to the product page to choose one', () => {
    renderInStore(<ProductCard product={card({ id: 'p3', name: 'Tee', slug: 'tee', hasVariants: true })} storeSlug="alpha" />);

    expect(screen.getByRole('link', { name: 'Choose options' })).toHaveAttribute('href', '/products/tee?store=alpha');
    expect(screen.queryByRole('button', { name: /to cart/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /order .* now/i })).toBeNull();
  });

  it('disables the action when no variant of the product is available', () => {
    renderInStore(<ProductCard product={card({ id: 'p4', name: 'Gone Tee', hasVariants: true, available: false })} storeSlug="alpha" />);

    expect(screen.getByRole('button', { name: 'Add Gone Tee to cart' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Order Gone Tee now' })).toBeDisabled();
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

describe('Order now', () => {
  beforeEach(() => {
    window.localStorage.clear();
    pushMock.mockReset();
  });

  it('adds the card product to the cart and goes straight to checkout', async () => {
    const user = userEvent.setup();
    renderInStore(<ProductCard product={card()} storeSlug="alpha" />);

    await user.click(screen.getByRole('button', { name: 'Order Ceramic Mug now' }));
    expect(screen.getByTestId('cart')).toHaveTextContent('1|p1:-:450.00x1');
    expect(screen.queryByRole('dialog', { name: 'Cart' })).toBeNull();
    expect(pushMock).toHaveBeenCalledWith('/checkout?store=alpha');
  });

  it('orders the chosen variant and quantity from the product page', async () => {
    const user = userEvent.setup();
    renderInStore(
      <AddToCartPanel
        product={{
          ...card({ id: 'p6', name: 'Tee', slug: 'tee', hasVariants: true }),
          description: null,
          variants: [
            { id: 'v-s', name: 'S', sku: 'TEE-S', price: '500.00', compareAtPrice: null, available: true },
            { id: 'v-m', name: 'M', sku: 'TEE-M', price: '550.00', compareAtPrice: null, available: true },
          ],
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
    await user.selectOptions(screen.getByLabelText('Choose variant'), 'v-m');
    await user.tripleClick(screen.getByLabelText('Quantity'));
    await user.keyboard('2');
    await user.click(screen.getByRole('button', { name: 'Order now' }));

    expect(screen.getByTestId('cart')).toHaveTextContent('2|p6:v-m:550.00x2');
    expect(screen.queryByRole('dialog', { name: 'Cart' })).toBeNull();
    expect(pushMock).toHaveBeenCalledWith('/checkout?store=alpha');
  });

  it('turns Add to cart into View cart for the variant in the cart on the product page', async () => {
    const user = userEvent.setup();
    renderInStore(
      <AddToCartPanel
        product={{
          ...card({ id: 'p8', name: 'Shirt', slug: 'shirt', hasVariants: true }),
          description: null,
          variants: [
            { id: 'v-s', name: 'S', sku: null, price: '500.00', compareAtPrice: null, available: true },
            { id: 'v-m', name: 'M', sku: null, price: '550.00', compareAtPrice: null, available: true },
          ],
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(screen.getByTestId('cart')).toHaveTextContent('1|p8:v-s:500.00x1');
    expect(screen.queryByRole('dialog', { name: 'Cart' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add to cart' })).toBeNull();
    expect(screen.getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/cart?store=alpha');
    expect(pushMock).not.toHaveBeenCalled();

    // A different variant is not in the cart yet, so it can still be added.
    await user.selectOptions(screen.getByLabelText('Choose variant'), 'v-m');
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  });

  it('still opens the cart drawer from the header cart button', async () => {
    const user = userEvent.setup();
    function OpenCart() {
      const { setDrawerOpen } = useCart();
      return <button type="button" onClick={() => setDrawerOpen(true)}>Open cart</button>;
    }
    renderInStore(
      <>
        <ProductCard product={card()} storeSlug="alpha" />
        <OpenCart />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Add Ceramic Mug to cart' }));
    await user.click(screen.getByRole('button', { name: 'Open cart' }));
    const drawer = screen.getByRole('dialog', { name: 'Cart' });
    expect(within(drawer).getByText('Ceramic Mug')).toBeInTheDocument();
  });
});
