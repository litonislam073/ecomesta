import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartProvider, useCart } from '@/lib/cart';
import { quoteFor } from '@/lib/checkout-quote.fixture';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('store=alpha'),
}));

const postMock = vi.fn();
const getMock = vi.fn();

vi.mock('@/lib/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/public-api')>(
    '@/lib/public-api',
  );
  return {
    ...actual,
    publicPost: (...args: unknown[]) => postMock(...args),
    publicGet: (...args: unknown[]) => getMock(...args),
  };
});

function CouponProbe() {
  const cart = useCart();
  return (
    <div>
      <p data-testid="coupon">{cart.couponCode ?? ''}</p>
      <p data-testid="store">{cart.storeSlug}</p>
      <button type="button" onClick={() => cart.setCouponCode('summer10')}>
        SetCoupon
      </button>
      <button type="button" onClick={() => cart.setCouponCode(null)}>
        ClearCoupon
      </button>
    </div>
  );
}

function seedCart() {
  window.localStorage.setItem(
    'ecomesta_cart_alpha',
    JSON.stringify({
      storeId: 's1',
      storeSlug: 'alpha',
      currency: 'USD',
      couponCode: null,
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

function mockShipping() {
  getMock.mockImplementation(async (path: string) => {
    if (String(path).includes('payment-providers')) {
      return {
        success: true,
        data: {
          offline: [{ provider: 'COD', method: 'CASH' }],
          online: [],
        },
      };
    }
    return {
      success: true,
      data: [
        {
          id: 'ship-free',
          name: 'Free Shipping',
          type: 'FREE',
          price: '0.00',
          description: null,
        },
      ],
    };
  });
}

describe('Cart couponCode store scoping', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists couponCode in store-scoped cart state', async () => {
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="USD">
        <CouponProbe />
      </CartProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'SetCoupon' }));
    expect(screen.getByTestId('coupon')).toHaveTextContent('SUMMER10');

    const raw = window.localStorage.getItem('ecomesta_cart_alpha');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.couponCode).toBe('SUMMER10');
    expect(parsed.storeSlug).toBe('alpha');

    await user.click(screen.getByRole('button', { name: 'ClearCoupon' }));
    expect(screen.getByTestId('coupon')).toHaveTextContent('');
  });

  it('keeps coupon codes isolated per store cart key', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="USD">
        <CouponProbe />
      </CartProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'SetCoupon' }));
    expect(window.localStorage.getItem('ecomesta_cart_alpha')).toContain('SUMMER10');
    unmount();

    render(
      <CartProvider storeId="s2" storeSlug="beta" currency="BDT">
        <CouponProbe />
      </CartProvider>,
    );
    expect(screen.getByTestId('coupon')).toHaveTextContent('');
    expect(screen.getByTestId('store')).toHaveTextContent('beta');
    expect(window.localStorage.getItem('ecomesta_cart_alpha')).toContain('SUMMER10');
  });
});

describe('Checkout coupon apply UI', () => {
  beforeEach(() => {
    window.localStorage.clear();
    postMock.mockReset();
    getMock.mockReset();
    mockShipping();
    seedCart();
  });

  it('applies a coupon via validate and stores the normalized code', async () => {
    postMock.mockImplementation(async (path: string, body?: unknown) => {
      if (String(path).endsWith('/checkout/quote')) {
        return quoteFor(body, { discount: '2.00', currency: 'USD' });
      }
      return {
        success: true,
        data: {
          valid: true,
          code: 'SUMMER10',
          discount: '2.00',
          subtotal: '20.00',
          finalSubtotal: '18.00',
          currency: 'USD',
        },
      };
    });

    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="USD">
        <CheckoutForm />
      </CartProvider>,
    );

    expect(await screen.findByRole('heading', { name: /^coupon$/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/coupon code/i), 'summer10');
    await user.click(screen.getByRole('button', { name: /^apply$/i }));

    const validateCall = () =>
      postMock.mock.calls.find((c) => String(c[0]).includes('/coupons/validate'));
    await waitFor(() => {
      expect(validateCall()).toBeTruthy();
    });
    const [path, body] = validateCall()!;
    expect(String(path)).toContain('/public/stores/alpha/coupons/validate');
    expect(body.code).toBe('SUMMER10');

    await waitFor(() => {
      const raw = window.localStorage.getItem('ecomesta_cart_alpha');
      const parsed = raw ? JSON.parse(raw) : null;
      expect(parsed?.couponCode).toBe('SUMMER10');
    });
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();

    // SF-03: the discount shown comes from the server quote for the coupon.
    await waitFor(() => {
      const discountRow = screen.getByText(/^Discount \(SUMMER10\)$/).closest('div');
      expect(discountRow?.textContent).toMatch(/2\.00/);
    });
    const quoted = postMock.mock.calls.filter((c) => String(c[0]).endsWith('/checkout/quote'));
    expect(quoted.at(-1)![1].couponCode).toBe('SUMMER10');
  });
});
