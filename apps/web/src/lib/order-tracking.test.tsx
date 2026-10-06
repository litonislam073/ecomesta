import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackOrderForm } from '@/components/track-order-form';
import { OrderTrackingView } from '@/components/order-tracking-view';
import type { PublicOrderConfirmationDetail } from '@ecomesta/types';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('store=alpha'),
}));

const lookupMock = vi.fn();
vi.mock('@/lib/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/public-api')>(
    '@/lib/public-api',
  );
  return {
    ...actual,
    publicPost: (...args: unknown[]) => lookupMock(...args),
  };
});

const sampleOrder: PublicOrderConfirmationDetail = {
  orderNumber: 'EM-100013',
  publicReference: 'abcdefghijklmnopqrstuvwxyz012345',
  status: 'PROCESSING',
  paymentStatus: 'PAID',
  fulfillmentStatus: 'FULFILLED',
  paymentProvider: 'COD',
  paymentMethod: 'CASH',
  currency: 'USD',
  subtotal: '20.00',
  shippingTotal: '0.00',
  shippingMethodName: 'Free Track',
  shippingMethodType: 'FREE',
  discountTotal: '0.00',
  taxTotal: '0.00',
  total: '20.00',
  customerNote: null,
  cancelReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  items: [
    {
      productName: 'Widget',
      variantName: null,
      sku: 'W',
      quantity: 2,
      unitPrice: '10.00',
      totalPrice: '20.00',
    },
  ],
  shippingAddress: {
    name: 'Ada',
    phone: '+1',
    email: 'ada@example.com',
    addressLine1: '1 Main',
    addressLine2: null,
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    country: 'US',
  },
  billingAddress: null,
  shipments: [
    {
      status: 'SHIPPED',
      trackingNumber: 'TRK-1',
      provider: 'MANUAL',
      shippedAt: '2026-01-02T00:00:00.000Z',
      deliveredAt: null,
    },
  ],
  timeline: [
    {
      type: 'ORDER_CREATED',
      label: 'Order placed',
      description: 'Your order was received.',
      occurredAt: '2026-01-01T00:00:00.000Z',
    },
    {
      type: 'SHIPPED',
      label: 'Shipped',
      description: 'Your order is on the way.',
      occurredAt: '2026-01-02T00:00:00.000Z',
    },
  ],
};

describe('Track order + confirmation tracking', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    replace.mockReset();
  });

  it('validates reference and email before lookup', async () => {
    const user = userEvent.setup();
    render(<TrackOrderForm storeSlug="alpha" />);
    await user.type(screen.getByLabelText(/order reference/i), 'short-ref');
    await user.type(screen.getByLabelText(/checkout phone or email/i), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: /track order/i }));
    expect(
      await screen.findByText(/full order reference/i),
    ).toBeInTheDocument();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('looks up an order with email verification and shows timeline', async () => {
    const user = userEvent.setup();
    lookupMock.mockResolvedValue({ success: true, data: sampleOrder });
    render(<TrackOrderForm storeSlug="alpha" />);

    await user.type(
      screen.getByLabelText(/order reference/i),
      sampleOrder.publicReference,
    );
    await user.type(screen.getByLabelText(/checkout phone or email/i), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: /track order/i }));

    await waitFor(() => {
      expect(lookupMock).toHaveBeenCalled();
    });
    expect(await screen.findByText('EM-100013')).toBeInTheDocument();
    expect(screen.getByText(/order placed/i)).toBeInTheDocument();
    expect(screen.getByText(/tracking: TRK-1/i)).toBeInTheDocument();
  });

  it('looks up an order by the checkout phone number', async () => {
    const user = userEvent.setup();
    lookupMock.mockResolvedValue({ success: true, data: sampleOrder });
    render(<TrackOrderForm storeSlug="alpha" />);
    await user.type(screen.getByLabelText(/order reference/i), sampleOrder.publicReference);
    await user.type(screen.getByLabelText(/checkout phone or email/i), '01711 000000');
    await user.click(screen.getByRole('button', { name: /track order/i }));
    await waitFor(() =>
      // The phone goes in the POST body, never in the request URL.
      expect(lookupMock).toHaveBeenCalledWith(
        `/public/stores/alpha/orders/${sampleOrder.publicReference}/lookup`,
        { phone: '01711 000000' },
      ),
    );
    expect(await screen.findByText('EM-100013')).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith(
      `/track-order?store=alpha&ref=${sampleOrder.publicReference}`,
      { scroll: false },
    );
    expect(JSON.stringify(replace.mock.calls)).not.toMatch(/01711/);
  });

  it('shows a non-enumerating error for invalid lookups', async () => {
    const user = userEvent.setup();
    const { PublicApiError } = await import('@/lib/public-api');
    lookupMock.mockRejectedValue(
      new PublicApiError(404, 'NOT_FOUND', 'Order not found'),
    );
    render(<TrackOrderForm storeSlug="alpha" />);
    await user.type(
      screen.getByLabelText(/order reference/i),
      'abcdefghijklmnopqrstuvwxyz012345',
    );
    await user.type(screen.getByLabelText(/checkout phone or email/i), 'nope@example.com');
    await user.click(screen.getByRole('button', { name: /track order/i }));
    expect(
      await screen.findByText(/could not find an order/i),
    ).toBeInTheDocument();
  });

  it('renders cancellation and payment status on tracking view', () => {
    render(
      <OrderTrackingView
        storeSlug="alpha"
        initial={{
          ...sampleOrder,
          status: 'CANCELLED',
          paymentStatus: 'CANCELLED',
          cancelReason: 'Out of stock',
          shipments: [],
          timeline: [
            {
              type: 'CANCELLED',
              label: 'Cancelled',
              description: 'This order was cancelled. Out of stock',
              occurredAt: '2026-01-03T00:00:00.000Z',
            },
          ],
        }}
      />,
    );
    expect(screen.getAllByText(/out of stock/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/payment: CANCELLED/i)).toBeInTheDocument();
  });
});
