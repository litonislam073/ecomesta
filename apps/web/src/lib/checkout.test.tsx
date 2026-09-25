import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartProvider } from '@/lib/cart';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('store=alpha'),
}));

const postMock = vi.fn();

vi.mock('@/lib/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/public-api')>(
    '@/lib/public-api',
  );
  return {
    ...actual,
    publicPost: (...args: unknown[]) => postMock(...args),
  };
});

function seedCart() {
  window.localStorage.setItem(
    'ecomesta_cart_alpha',
    JSON.stringify({
      storeId: 's1',
      storeSlug: 'alpha',
      currency: 'USD',
      lines: [
        {
          productId: 'p1',
          productSlug: 'widget',
          productName: 'Widget',
          variantId: null,
          variantName: null,
          sku: 'W',
          unitPrice: '10.00',
          quantity: 2,
          imageUrl: null,
        },
      ],
    }),
  );
}

describe('CheckoutForm', () => {
  beforeEach(() => {
    window.localStorage.clear();
    postMock.mockReset();
  });

  it('shows empty cart state', async () => {
    const { CheckoutForm } = await import('@/components/checkout-form');
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="USD">
        <CheckoutForm />
      </CartProvider>,
    );
    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it('validates contact fields and supports billing same-as-shipping', async () => {
    seedCart();
    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="USD">
        <CheckoutForm />
      </CartProvider>,
    );

    expect(await screen.findByRole('heading', { name: /order summary/i })).toBeInTheDocument();
    expect(screen.getByText(/Widget/)).toBeInTheDocument();
    expect(screen.getByLabelText(/same as shipping/i)).toBeChecked();

    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/name and email/i);
    expect(postMock).not.toHaveBeenCalled();
  });

  it('submits checkout with idempotency key and clears cart on success', async () => {
    seedCart();
    postMock.mockResolvedValue({
      success: true,
      data: {
        orderNumber: 'EM-100001',
        publicReference: 'ref-abc',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentProvider: 'COD',
        paymentMethod: 'CASH',
        currency: 'USD',
        subtotal: '20.00',
        shippingTotal: '0.00',
        discountTotal: '0.00',
        taxTotal: '0.00',
        total: '20.00',
      },
    });

    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="USD">
        <CheckoutForm />
      </CartProvider>,
    );

    await screen.findByRole('heading', { name: /order summary/i });
    await user.type(screen.getByLabelText(/^full name$/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^address line 1$/i), '123 Main');
    await user.type(screen.getByLabelText(/^city$/i), 'Dallas');

    await user.click(screen.getByRole('button', { name: /place order/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(1);
    });
    const [, body, init] = postMock.mock.calls[0]!;
    expect(body.items[0]).toEqual({
      productId: 'p1',
      variantId: null,
      quantity: 2,
    });
    expect(init.idempotencyKey).toBeTruthy();
    expect(body).not.toHaveProperty('grandTotal');

    await waitFor(() => {
      const raw = window.localStorage.getItem('ecomesta_cart_alpha');
      const parsed = raw ? JSON.parse(raw) : null;
      expect(parsed?.lines ?? []).toHaveLength(0);
    });
  });

  it('keeps Place Order disabled while submitting and surfaces API errors', async () => {
    seedCart();
    const { PublicApiError } = await import('@/lib/public-api');
    let resolvePost: (value: unknown) => void = () => undefined;
    postMock.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          resolvePost = reject;
        }),
    );

    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="USD">
        <CheckoutForm />
      </CartProvider>,
    );

    await screen.findByRole('heading', { name: /order summary/i });
    await user.type(screen.getByLabelText(/^full name$/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^address line 1$/i), '123 Main');
    await user.type(screen.getByLabelText(/^city$/i), 'Dallas');

    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(screen.getByRole('button', { name: /placing order/i })).toBeDisabled();

    resolvePost(new PublicApiError(422, 'INSUFFICIENT_STOCK', 'Insufficient stock for Widget'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/insufficient stock/i);
  });

  it('shows billing fields when same-as-shipping is unchecked', async () => {
    seedCart();
    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="USD">
        <CheckoutForm />
      </CartProvider>,
    );

    await screen.findByRole('heading', { name: /billing address/i });
    await user.click(screen.getByLabelText(/same as shipping/i));
    expect(screen.getAllByLabelText(/^address line 1$/i).length).toBeGreaterThan(1);
  });
});
