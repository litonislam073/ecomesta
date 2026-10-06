import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicOrderConfirmationDetail } from '@ecomesta/types';
import { OrderConfirmationClient } from '@/components/order-confirmation-client';
import { PaymentResultClient } from '@/components/payment-result-client';
import { rememberOrderContact } from '@/lib/order-contact';

/**
 * The customer's phone (or email) must never be in a URL: not the confirmation
 * link, the payment return link, a client-side redirect, or an API request URL.
 * The proof stays in this tab and travels in POST bodies; the API checks it.
 */

const replace = vi.fn();
let search = 'store=alpha';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const postMock = vi.fn();
const getMock = vi.fn();
vi.mock('@/lib/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/public-api')>('@/lib/public-api');
  return {
    ...actual,
    publicPost: (...args: unknown[]) => postMock(...args),
    publicGet: (...args: unknown[]) => getMock(...args),
  };
});

const { PublicApiError } = await vi.importActual<typeof import('@/lib/public-api')>(
  '@/lib/public-api',
);

const REF = 'abcdefghijklmnopqrstuvwxyz012345';
const PHONE = '01711-000000';

const order = {
  orderNumber: 'EM-100042',
  publicReference: REF,
  status: 'PENDING',
  paymentStatus: 'PENDING',
  fulfillmentStatus: 'UNFULFILLED',
  paymentProvider: 'COD',
  paymentMethod: 'CASH',
  currency: 'BDT',
  subtotal: '500.00',
  shippingTotal: '0.00',
  discountTotal: '0.00',
  taxTotal: '0.00',
  total: '500.00',
  items: [{ productName: 'Panjabi', variantName: null, sku: 'P', quantity: 1, unitPrice: '500.00', totalPrice: '500.00' }],
  shipments: [],
  timeline: [],
  canCancel: false,
} as unknown as PublicOrderConfirmationDetail;

/** Every URL the page navigated to or requested, to prove the phone is in none of them. */
function allUrls() {
  return JSON.stringify([
    window.location.href,
    replace.mock.calls.map((c) => c[0]),
    postMock.mock.calls.map((c) => c[0]),
    getMock.mock.calls.map((c) => c[0]),
  ]);
}

beforeEach(() => {
  replace.mockReset();
  postMock.mockReset();
  getMock.mockReset();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', `/order-confirmation/${REF}?store=alpha`);
  search = 'store=alpha';
});

describe('order confirmation without the phone in the URL', () => {
  it('loads the customer’s own order with the proof kept by checkout, sent in the body', async () => {
    rememberOrderContact('alpha', REF, { phone: PHONE });
    postMock.mockResolvedValue({ success: true, data: order });

    render(<OrderConfirmationClient storeSlug="alpha" storeName="Alpha" reference={REF} />);

    expect(await screen.findByText('Order confirmed')).toBeInTheDocument();
    expect(screen.getByText('EM-100042')).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledWith(`/public/stores/alpha/orders/${REF}/lookup`, { phone: PHONE });
    expect(replace).not.toHaveBeenCalled();
    expect(allUrls()).not.toMatch(/01711|phone=|email=/);
  });

  it('still loads after a direct refresh of the confirmation page', async () => {
    rememberOrderContact('alpha', REF, { phone: PHONE });
    postMock.mockResolvedValue({ success: true, data: order });

    const first = render(<OrderConfirmationClient storeSlug="alpha" storeName="Alpha" reference={REF} />);
    await screen.findByText('EM-100042');
    first.unmount();

    // A refresh mounts the page again from the same clean URL.
    render(<OrderConfirmationClient storeSlug="alpha" storeName="Alpha" reference={REF} />);
    expect(await screen.findByText('EM-100042')).toBeInTheDocument();
    expect(allUrls()).not.toMatch(/01711/);
  });

  it('asks a visitor without the proof (another customer) for it and shows nothing on a wrong one', async () => {
    const user = userEvent.setup();
    postMock.mockRejectedValue(new PublicApiError(404, 'NOT_FOUND', 'Order not found'));

    render(<OrderConfirmationClient storeSlug="alpha" storeName="Alpha" reference={REF} />);

    expect(await screen.findByRole('heading', { name: 'View your order' })).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/checkout phone or email/i), '01999 999999');
    await user.click(screen.getByRole('button', { name: 'View order' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not find this order/i);
    expect(postMock).toHaveBeenCalledWith(`/public/stores/alpha/orders/${REF}/lookup`, { phone: '01999 999999' });
    expect(screen.queryByText('EM-100042')).not.toBeInTheDocument();
    expect(screen.queryByText('Order confirmed')).not.toBeInTheDocument();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('lets the customer in another tab confirm with their own phone', async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({ success: true, data: order });

    render(<OrderConfirmationClient storeSlug="alpha" storeName="Alpha" reference={REF} />);
    await user.type(await screen.findByLabelText(/checkout phone or email/i), PHONE);
    await user.click(screen.getByRole('button', { name: 'View order' }));

    expect(await screen.findByText('EM-100042')).toBeInTheDocument();
    expect(allUrls()).not.toMatch(/01711/);
  });

  it('drops the phone from an old link’s URL and still shows the order', async () => {
    window.history.replaceState(null, '', `/order-confirmation/${REF}?store=alpha&phone=${PHONE}`);
    postMock.mockResolvedValue({ success: true, data: order });

    render(<OrderConfirmationClient storeSlug="alpha" storeName="Alpha" reference={REF} />);

    expect(await screen.findByText('EM-100042')).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith(`/order-confirmation/${REF}?store=alpha`, { scroll: false });
    expect(postMock).toHaveBeenCalledWith(`/public/stores/alpha/orders/${REF}/lookup`, { phone: PHONE });
  });
});

describe('payment result page without the phone in the URL', () => {
  it('reads payment status with the proof in the body, not the request URL', async () => {
    window.history.replaceState(null, '', `/payment/success?store=alpha&order=${REF}&ref=pay_123`);
    search = `store=alpha&order=${REF}&ref=pay_123`;
    rememberOrderContact('alpha', REF, { phone: PHONE });
    postMock.mockResolvedValue({
      success: true,
      data: { status: 'PAID', orderNumber: 'EM-100042', amount: '500.00', currency: 'BDT', provider: 'TEST', attemptNumber: 1, internalReference: 'pay_123' },
    });

    render(<PaymentResultClient tone="success" title="Payment return" />);

    expect(await screen.findByText('PAID')).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledWith('/public/stores/alpha/payments/pay_123/status', { phone: PHONE });
    expect(getMock).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /view order confirmation/i })).toHaveAttribute(
      'href',
      `/order-confirmation/${REF}?store=alpha`,
    );
    expect(allUrls()).not.toMatch(/01711|phone=|email=/);
  });

  const statusOf = (status: string) => ({
    success: true,
    data: { status, orderNumber: 'EM-100042', amount: '500.00', currency: 'BDT', provider: 'STRIPE', attemptNumber: 1, internalReference: 'pay_123' },
  });

  it('on a provider failure/cancel return, offers to pay again with the proof in the body', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', `/payment/cancel?store=alpha&order=${REF}&ref=pay_123`);
    search = `store=alpha&order=${REF}&ref=pay_123`;
    rememberOrderContact('alpha', REF, { phone: PHONE });
    postMock.mockImplementation(async (path: string) =>
      path.endsWith('/status')
        ? statusOf('CANCELLED')
        : { success: true, data: { redirectUrl: null, internalReference: 'pay_456' } },
    );

    render(<PaymentResultClient tone="cancel" title="Payment cancelled" />);

    expect(await screen.findByText('CANCELLED')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pay again' }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/public/stores/alpha/payments/retry', {
        publicReference: REF,
        provider: 'STRIPE',
        phone: PHONE,
      }),
    );
    expect(allUrls()).not.toMatch(/01711|phone=|email=/);
  });

  it('shows the API’s not-found for an unknown or someone else’s payment reference', async () => {
    window.history.replaceState(null, '', `/payment/success?store=alpha&order=${REF}&ref=pay_unknown`);
    search = `store=alpha&order=${REF}&ref=pay_unknown`;
    rememberOrderContact('alpha', REF, { phone: PHONE });
    postMock.mockRejectedValue(new PublicApiError(404, 'NOT_FOUND', 'Payment not found'));

    render(<PaymentResultClient tone="success" title="Payment return" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Payment not found');
    expect(screen.queryByText('PAID')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view order confirmation/i })).not.toBeInTheDocument();
  });

  it('without this tab’s proof, asks the shopper to track the order instead of guessing', async () => {
    window.history.replaceState(null, '', `/payment/success?store=alpha&order=${REF}&ref=pay_123`);
    search = `store=alpha&order=${REF}&ref=pay_123`;

    render(<PaymentResultClient tone="success" title="Payment return" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/track your order/i);
    expect(postMock).not.toHaveBeenCalled();
  });
});
