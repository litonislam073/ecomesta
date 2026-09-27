import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartProvider } from '@/lib/cart';

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
  methods = [
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

  postMock.mockImplementation(async (path: string) => {
    if (String(path).includes('/shipping/quote')) {
      return {
        success: true,
        data: {
          zone: { id: 'z1', name: 'Dhaka City', priority: 100 },
          subtotal: '20.00',
          discountTotal: '0.00',
          subtotalAfterDiscount: '20.00',
          couponCode: null,
          methods,
        },
      };
    }
    throw new Error(`Unexpected POST ${path}`);
  });
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
    expect(screen.getByText(/Widget/)).toBeInTheDocument();
    expect(screen.getByLabelText(/same as shipping/i)).toBeChecked();

    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/name and email/i);
  });

  it('submits checkout with location IDs, shippingMethodId, and idempotency key', async () => {
    seedCart();
    mockCheckoutApis();
    postMock.mockImplementation(async (path: string, body?: unknown) => {
      if (String(path).includes('/shipping/quote')) {
        return {
          success: true,
          data: {
            zone: { id: 'z1', name: 'Dhaka City', priority: 100 },
            subtotal: '20.00',
            discountTotal: '0.00',
            subtotalAfterDiscount: '20.00',
            couponCode: null,
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
          },
        };
      }
      if (String(path).includes('/checkout')) {
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

    await user.click(screen.getByRole('button', { name: /place order/i }));

    await waitFor(() => {
      const checkoutCall = postMock.mock.calls.find((c) =>
        String(c[0]).includes('/checkout'),
      );
      expect(checkoutCall).toBeTruthy();
    });
    const checkoutCall = postMock.mock.calls.find((c) =>
      String(c[0]).includes('/checkout'),
    )!;
    const body = checkoutCall[1] as Record<string, unknown>;
    const init = checkoutCall[2] as { idempotencyKey?: string };
    expect(body.shippingMethodId).toBe('ship-free');
    expect((body.shippingAddress as { divisionId: string }).divisionId).toBe('div-1');
    expect((body.shippingAddress as { districtId: string }).districtId).toBe('dist-1');
    expect((body.shippingAddress as { upazilaId: string }).upazilaId).toBe('upa-1');
    expect(init.idempotencyKey).toBeTruthy();
    expect(body).not.toHaveProperty('grandTotal');
  });
});
