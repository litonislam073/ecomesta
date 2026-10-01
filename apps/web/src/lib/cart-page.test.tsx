import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartPage from '@/app/(store)/cart/page';
import { CartProvider } from '@/lib/cart';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('store=alpha'),
}));

const line = (overrides: Record<string, unknown> = {}) => ({
  productId: 'p1',
  productSlug: 'ceramic-mug',
  productName: 'Ceramic Mug',
  variantId: null,
  variantName: null,
  sku: 'MUG-1',
  unitPrice: '450.00',
  quantity: 2,
  imageUrl: 'https://cdn.example/mug.jpg',
  ...overrides,
});

function saveCart(lines: unknown[]) {
  window.localStorage.setItem(
    'ecomesta_cart_alpha',
    JSON.stringify({ storeId: 's1', storeSlug: 'alpha', currency: 'BDT', couponCode: null, lines }),
  );
}

function renderCart() {
  return render(
    <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
      <CartPage />
    </CartProvider>,
  );
}

describe('cart page', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows each product with its image, line total and an order summary', async () => {
    saveCart([line(), line({ productId: 'p2', productSlug: 'plate', productName: 'Plate', unitPrice: '300.00', quantity: 1, imageUrl: null })]);
    renderCart();

    const mugImage = await screen.findByRole('img', { name: 'Ceramic Mug' });
    expect(mugImage).toHaveAttribute('src', 'https://cdn.example/mug.jpg');
    // No photo for Plate: an image icon is shown instead of an <img>.
    expect(screen.queryByRole('img', { name: 'Plate' })).toBeNull();

    expect(screen.getByText('3 items')).toBeInTheDocument();
    const summary = screen.getByRole('complementary', { name: 'Order summary' });
    expect(within(summary).getByText(/1,200\.00/, { selector: 'span' })).toBeInTheDocument();
    expect(within(summary).getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute('href', '/checkout?store=alpha');
  });

  it('falls back to the image icon when the photo fails to load', async () => {
    saveCart([line()]);
    renderCart();
    fireEvent.error(await screen.findByRole('img', { name: 'Ceramic Mug' }));
    expect(screen.queryByRole('img', { name: 'Ceramic Mug' })).toBeNull();
  });

  it('changes quantity and removes items', async () => {
    const user = userEvent.setup();
    saveCart([line()]);
    renderCart();

    await user.click(await screen.findByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByLabelText('Quantity')).toHaveTextContent('3');
    await user.click(screen.getByRole('button', { name: 'Remove Ceramic Mug' }));
    expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start shopping' })).toHaveAttribute('href', '/products?store=alpha');
  });
});
