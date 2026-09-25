import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartProvider, useCart } from '@/lib/cart';

function Probe() {
  const cart = useCart();
  return (
    <div>
      <p data-testid="count">{cart.itemCount}</p>
      <p data-testid="subtotal">{cart.subtotal}</p>
      <p data-testid="store">{cart.storeSlug}</p>
      <button
        type="button"
        onClick={() =>
          cart.addItem({
            productId: 'p1',
            productSlug: 'widget',
            productName: 'Widget',
            variantId: null,
            variantName: null,
            sku: 'W',
            unitPrice: '10.00',
            quantity: 1,
            imageUrl: null,
          })
        }
      >
        Add
      </button>
      <button type="button" onClick={() => cart.setQuantity('p1:base', 3)}>
        Set3
      </button>
      <button type="button" onClick={() => cart.removeItem('p1:base')}>
        Remove
      </button>
      <button type="button" onClick={() => cart.clear()}>
        Clear
      </button>
    </div>
  );
}

describe('CartProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('adds, updates, removes, and clears lines for a store', async () => {
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="USD">
        <Probe />
      </CartProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('subtotal')).toHaveTextContent('10.00');

    await user.click(screen.getByRole('button', { name: 'Set3' }));
    expect(screen.getByTestId('count')).toHaveTextContent('3');
    expect(screen.getByTestId('subtotal')).toHaveTextContent('30.00');

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('keeps separate localStorage keys per store', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="USD">
        <Probe />
      </CartProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(window.localStorage.getItem('ecomesta_cart_alpha')).toContain('Widget');
    unmount();

    render(
      <CartProvider storeId="s2" storeSlug="beta" currency="BDT">
        <Probe />
      </CartProvider>,
    );
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('store')).toHaveTextContent('beta');
    expect(window.localStorage.getItem('ecomesta_cart_alpha')).toContain('Widget');
  });
});

describe('AddToCartPanel validation', () => {
  it('rejects adding when the selected variant is unavailable', async () => {
    const { AddToCartPanel } = await import('@/components/add-to-cart-panel');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="USD">
        <AddToCartPanel
          product={{
            id: 'p1',
            name: 'Widget',
            slug: 'widget',
            shortDescription: null,
            description: null,
            productType: 'PHYSICAL',
            currency: 'USD',
            price: '10.00',
            compareAtPrice: null,
            sku: null,
            available: true,
            images: [],
            categories: [],
            hasVariants: true,
            variants: [
              {
                id: 'v-ok',
                name: 'OK',
                sku: null,
                price: '10.00',
                compareAtPrice: null,
                available: true,
              },
              {
                id: 'v-bad',
                name: 'Bad',
                sku: null,
                price: '12.00',
                compareAtPrice: null,
                available: false,
              },
            ],
          }}
        />
      </CartProvider>,
    );

    await user.selectOptions(screen.getByLabelText(/choose variant/i), 'v-bad');
    expect(screen.getByText(/currently unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
  });
});

