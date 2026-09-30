import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicShippingMethod } from '@ecomesta/types';
import { CartProvider } from '@/lib/cart';
import { quoteFor } from '@/lib/checkout-quote.fixture';
import { PublicApiError } from '@/lib/public-api';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
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

function seedCart() {
  window.localStorage.setItem(
    'ecomesta_cart_alpha',
    JSON.stringify({
      storeId: 's1',
      storeSlug: 'alpha',
      currency: 'BDT',
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

const divisions = [{ id: 'div-1', code: 'DHAKA', name: 'Dhaka' }];
const districts = [
  { id: 'dist-1', code: 'DHAKA_DHAKA', name: 'Dhaka', divisionId: 'div-1' },
];
const upazilas = [
  { id: 'upa-1', code: 'TEJ', name: 'Tejgaon', districtId: 'dist-1' },
];

function mockCheckoutApis(
  methods: PublicShippingMethod[] = [
    {
      id: 'ship-free',
      name: 'Free Shipping',
      type: 'FREE',
      price: '0.00',
      amount: '0.00',
      description: null,
      codAllowed: true,
    },
    {
      id: 'ship-flat',
      name: 'Flat Rate',
      type: 'FLAT',
      price: '5.00',
      amount: '5.00',
      description: 'Standard',
      codAllowed: true,
      freeShippingThreshold: '2000.00',
    },
    {
      id: 'ship-nocod',
      name: 'Express No COD',
      type: 'FLAT',
      price: '15.00',
      amount: '15.00',
      description: null,
      codAllowed: false,
    },
  ],
) {
  getMock.mockImplementation(async (path: string) => {
    const p = String(path);
    if (p.includes('payment-providers')) {
      return {
        success: true,
        data: {
          offline: [
            { provider: 'COD', method: 'CASH' },
            { provider: 'OTHER', method: 'BANK_TRANSFER' },
          ],
          online: [],
        },
      };
    }
    if (p.includes('locations/divisions')) {
      return { success: true, data: divisions };
    }
    if (p.includes('locations/districts')) {
      return { success: true, data: districts };
    }
    if (p.includes('locations/upazilas')) {
      return { success: true, data: upazilas };
    }
    return { success: true, data: methods };
  });

  postMock.mockImplementation(async (path: string, body?: unknown) => {
    if (String(path).includes('/checkout/quote')) {
      return quoteFor(body, { methods, zoneName: 'Dhaka City' });
    }
    throw new Error(`Unexpected POST ${path}`);
  });
}

const isCheckoutCall = (call: unknown[]) => String(call[0]).endsWith('/checkout');
const isQuoteCall = (call: unknown[]) => String(call[0]).endsWith('/checkout/quote');

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^full name$/i), 'Ada Lovelace');
  await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
  await user.selectOptions(screen.getByLabelText(/^division$/i), 'div-1');
  await waitFor(() => expect(screen.getByLabelText(/^district$/i)).not.toBeDisabled());
  await user.selectOptions(screen.getByLabelText(/^district$/i), 'dist-1');
  await waitFor(() => expect(screen.getByLabelText(/upazila/i)).not.toBeDisabled());
  await user.selectOptions(screen.getByLabelText(/upazila/i), 'upa-1');
  await user.type(screen.getByLabelText(/^address line$/i), '123 Main');
  // Let the quote for the chosen location settle before submitting.
  await screen.findByText(/current store prices/i);
}

const confirmation = {
  success: true,
  data: {
    orderNumber: 'EM-100001',
    publicReference: 'ref-abc',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    paymentProvider: 'COD',
    paymentMethod: 'CASH',
    currency: 'BDT',
    subtotal: '24.00',
    shippingTotal: '0.00',
    shippingMethodName: 'Free Shipping',
    shippingMethodType: 'FREE',
    discountTotal: '0.00',
    taxTotal: '0.00',
    total: '24.00',
  },
};

function summaryRow(label: RegExp) {
  return screen.getByText(label, { selector: 'dt' }).closest('div')?.textContent ?? '';
}

describe('CheckoutForm', () => {
  beforeEach(() => {
    window.localStorage.clear();
    postMock.mockReset();
    getMock.mockReset();
    mockCheckoutApis();
  });

  it('shows empty cart state', async () => {
    const { CheckoutForm } = await import('@/components/checkout-form');
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <CheckoutForm />
      </CartProvider>,
    );
    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it('loads location cascade, quotes shipping, and updates estimated total', async () => {
    seedCart();
    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <CheckoutForm />
      </CartProvider>,
    );

    expect(await screen.findByRole('heading', { name: /shipping method/i })).toBeInTheDocument();
    expect(await screen.findByText(/Free Shipping/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^division$/i), 'div-1');
    await waitFor(() => {
      expect(screen.getByLabelText(/^district$/i)).not.toBeDisabled();
    });
    await user.selectOptions(screen.getByLabelText(/^district$/i), 'dist-1');
    await waitFor(() => {
      expect(screen.getByLabelText(/upazila/i)).not.toBeDisabled();
    });
    await user.selectOptions(screen.getByLabelText(/upazila/i), 'upa-1');

    await waitFor(() => {
      expect(screen.getByText(/Delivery zone: Dhaka City/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('radio', { name: /Flat Rate/i }));
    await waitFor(() => {
      const shippingRow = screen.getByText(/^Shipping$/i).closest('div');
      expect(shippingRow?.textContent).toMatch(/5\.00/);
    });
  });

  it('disables COD when selected method has codAllowed false', async () => {
    seedCart();
    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <CheckoutForm />
      </CartProvider>,
    );

    await screen.findByText(/Express No COD/i);
    await user.click(screen.getByRole('radio', { name: /Express No COD/i }));
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Cash on delivery/i })).toBeDisabled();
    });
  });

  it('validates contact fields and supports billing same-as-shipping', async () => {
    seedCart();
    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <CheckoutForm />
      </CartProvider>,
    );

    expect(await screen.findByRole('heading', { name: /order summary/i })).toBeInTheDocument();
    expect(await screen.findByText(/Widget/)).toBeInTheDocument();
    expect(screen.getByLabelText(/same as shipping/i)).toBeChecked();

    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/name and email/i);
  });

  it('submits checkout with location IDs, shippingMethodId, and idempotency key', async () => {
    seedCart();
    mockCheckoutApis();
    postMock.mockImplementation(async (path: string, body?: unknown) => {
      if (String(path).includes('/checkout/quote')) {
        return quoteFor(body, {
          zoneName: 'Dhaka City',
          methods: [
            {
              id: 'ship-free',
              name: 'Free Shipping',
              type: 'FREE',
              price: '0.00',
              amount: '0.00',
              description: null,
              codAllowed: true,
            },
          ],
        });
      }
      if (String(path).endsWith('/checkout')) {
        return {
          success: true,
          data: {
            orderNumber: 'EM-100001',
            publicReference: 'ref-abc',
            status: 'PENDING',
            paymentStatus: 'PENDING',
            paymentProvider: 'COD',
            paymentMethod: 'CASH',
            currency: 'BDT',
            subtotal: '20.00',
            shippingTotal: '0.00',
            shippingMethodName: 'Free Shipping',
            shippingMethodType: 'FREE',
            discountTotal: '0.00',
            taxTotal: '0.00',
            total: '20.00',
          },
        };
      }
      throw new Error(`Unexpected POST ${path} ${JSON.stringify(body)}`);
    });

    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <CheckoutForm />
      </CartProvider>,
    );

    await screen.findByText(/Free Shipping/i);
    await user.type(screen.getByLabelText(/^full name$/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
    await user.selectOptions(screen.getByLabelText(/^division$/i), 'div-1');
    await waitFor(() => expect(screen.getByLabelText(/^district$/i)).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText(/^district$/i), 'dist-1');
    await waitFor(() => expect(screen.getByLabelText(/upazila/i)).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText(/upazila/i), 'upa-1');
    await user.type(screen.getByLabelText(/^address line$/i), '123 Main');
    await screen.findByText(/current store prices/i);

    await user.click(screen.getByRole('button', { name: /place order/i }));

    await waitFor(() => {
      expect(postMock.mock.calls.find(isCheckoutCall)).toBeTruthy();
    });
    const checkoutCall = postMock.mock.calls.find(isCheckoutCall)!;
    const body = checkoutCall[1] as Record<string, unknown>;
    const init = checkoutCall[2] as { idempotencyKey?: string };
    expect(body.shippingMethodId).toBe('ship-free');
    expect((body.shippingAddress as { divisionId: string }).divisionId).toBe('div-1');
    expect((body.shippingAddress as { districtId: string }).districtId).toBe('dist-1');
    expect((body.shippingAddress as { upazilaId: string }).upazilaId).toBe('upa-1');
    expect(init.idempotencyKey).toBeTruthy();
    expect(body).not.toHaveProperty('grandTotal');
    expect(body.expectedTotal).toBe('20.00');
  });
});

describe('CheckoutForm — SF-03 server pricing', () => {
  const freeOnly: PublicShippingMethod[] = [
    { id: 'ship-free', name: 'Free Shipping', type: 'FREE', price: '0.00', amount: '0.00', description: null, codAllowed: true },
  ];

  beforeEach(() => {
    window.localStorage.clear();
    postMock.mockReset();
    getMock.mockReset();
    pushMock.mockReset();
    mockCheckoutApis(freeOnly);
  });

  it('shows the current server price instead of the stale cart price and updates the cart', async () => {
    seedCart(); // cart snapshot: 2 × 10.00
    postMock.mockImplementation(async (path: string, body?: unknown) => {
      if (String(path).endsWith('/checkout/quote')) {
        return quoteFor(body, { methods: freeOnly, prices: { p1: '12.00' } });
      }
      throw new Error(`Unexpected POST ${path}`);
    });
    const { CheckoutForm } = await import('@/components/checkout-form');
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <CheckoutForm />
      </CartProvider>,
    );

    expect(await screen.findByText(/price changed from/i)).toHaveTextContent(/Widget: price changed from BDT\s10\.00 to BDT\s12\.00/);
    expect(summaryRow(/^Subtotal$/)).toMatch(/24\.00/);
    expect(summaryRow(/^Total$/)).toMatch(/24\.00/);
    expect(screen.getByText(/12\.00 each/)).toBeInTheDocument();
    expect(screen.queryByText(/20\.00/)).toBeNull();
    expect(screen.queryByText(/estimate/i)).toBeNull();

    // Only identifiers and quantities are sent — never the cart's price.
    const [, quoteBody] = postMock.mock.calls.find(isQuoteCall)!;
    expect((quoteBody as { items: unknown[] }).items).toEqual([{ productId: 'p1', variantId: null, quantity: 2 }]);
    expect(JSON.stringify(quoteBody)).not.toMatch(/unitPrice|10\.00/);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('ecomesta_cart_alpha') ?? '{}');
      expect(stored.lines[0].unitPrice).toBe('12.00');
    });
  });

  it('sends the quoted total as expectedTotal and places the order at that price', async () => {
    seedCart();
    postMock.mockImplementation(async (path: string, body?: unknown) => {
      if (String(path).endsWith('/checkout/quote')) {
        return quoteFor(body, { methods: freeOnly, prices: { p1: '12.00' } });
      }
      if (String(path).endsWith('/checkout')) return confirmation;
      throw new Error(`Unexpected POST ${path}`);
    });
    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <CheckoutForm />
      </CartProvider>,
    );
    await screen.findByText(/price changed from/i);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /place order/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    const [, body] = postMock.mock.calls.find(isCheckoutCall)!;
    expect((body as { expectedTotal: string }).expectedTotal).toBe('24.00');
    expect(JSON.stringify((body as { items: unknown }).items)).not.toMatch(/Price|Total/);
  });

  it('refreshes the summary when the server refuses a stale total', async () => {
    seedCart();
    let price = '10.00';
    let checkoutAttempts = 0;
    postMock.mockImplementation(async (path: string, body?: unknown) => {
      if (String(path).endsWith('/checkout/quote')) {
        return quoteFor(body, { methods: freeOnly, prices: { p1: price } });
      }
      if (String(path).endsWith('/checkout')) {
        checkoutAttempts += 1;
        const expected = (body as { expectedTotal: string }).expectedTotal;
        if (expected !== '30.00') {
          throw new PublicApiError(
            409,
            'CHECKOUT_TOTAL_CHANGED',
            'Prices or shipping changed since you reviewed your order. Please check the updated total and place your order again.',
          );
        }
        return { ...confirmation, data: { ...confirmation.data, subtotal: '30.00', total: '30.00' } };
      }
      throw new Error(`Unexpected POST ${path}`);
    });
    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <CheckoutForm />
      </CartProvider>,
    );
    await fillRequiredFields(user);
    await waitFor(() => {
      expect(summaryRow(/^Total$/)).toMatch(/20\.00/);
      expect(screen.getByText(/current store prices/i)).toBeInTheDocument();
    });

    // The merchant raises the price after the summary was loaded.
    price = '15.00';
    const quotesBefore = postMock.mock.calls.filter(isQuoteCall).length;
    await user.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByText(/prices or shipping changed/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    await waitFor(() => expect(summaryRow(/^Total$/)).toMatch(/30\.00/));
    expect(postMock.mock.calls.filter(isQuoteCall).length).toBeGreaterThan(quotesBefore);
    expect(await screen.findByText(/price changed from BDT\s10\.00 to BDT\s15\.00/i)).toBeInTheDocument();

    // Confirming again uses the refreshed total and the same idempotency key.
    await user.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    const calls = postMock.mock.calls.filter(isCheckoutCall);
    expect(checkoutAttempts).toBe(2);
    expect((calls[1]![1] as { expectedTotal: string }).expectedTotal).toBe('30.00');
    expect((calls[0]![2] as { idempotencyKey: string }).idempotencyKey).toBe(
      (calls[1]![2] as { idempotencyKey: string }).idempotencyKey,
    );
  });

  it('blocks ordering and explains when a cart item is no longer available', async () => {
    seedCart();
    postMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('/checkout/quote')) {
        throw new PublicApiError(422, 'UNPROCESSABLE_ENTITY', 'Product "Widget" is not available for purchase');
      }
      throw new Error(`Unexpected POST ${path}`);
    });
    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <CheckoutForm />
      </CartProvider>,
    );
    expect(await screen.findByText(/not available for purchase/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review your cart/i })).toHaveAttribute('href', '/cart?store=alpha');
    expect(screen.queryByText(/^Total$/)).toBeNull();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(postMock.mock.calls.find(isCheckoutCall)).toBeUndefined();
  });

  it('drops a coupon the server no longer accepts and shows the undiscounted total', async () => {
    window.localStorage.setItem(
      'ecomesta_cart_alpha',
      JSON.stringify({
        storeId: 's1',
        storeSlug: 'alpha',
        currency: 'BDT',
        couponCode: 'OLD10',
        lines: [{ productId: 'p1', productSlug: 'widget', productName: 'Widget', variantId: null, variantName: null, sku: 'W', unitPrice: '10.00', quantity: 2, imageUrl: null }],
      }),
    );
    postMock.mockImplementation(async (path: string, body?: unknown) => {
      if (String(path).endsWith('/checkout/quote')) {
        return quoteFor(body, { methods: freeOnly, couponError: 'Coupon has expired' });
      }
      throw new Error(`Unexpected POST ${path}`);
    });
    const { CheckoutForm } = await import('@/components/checkout-form');
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <CheckoutForm />
      </CartProvider>,
    );
    expect(await screen.findByText(/Coupon OLD10 was removed: Coupon has expired/)).toBeInTheDocument();
    expect(summaryRow(/^Total$/)).toMatch(/20\.00/);
    expect(screen.queryByText(/Discount/)).toBeNull();
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('ecomesta_cart_alpha') ?? '{}');
      expect(stored.couponCode).toBeNull();
    });
  });
});
