import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrdersPage from '@/app/dashboard/orders/page';
import OrderDetailPage from '@/app/dashboard/orders/[orderId]/page';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();
let selectedStoreId = 'store-1';
let canManage = true;

vi.mock('next/navigation', () => ({
  useParams: () => ({ orderId: 'ord-1' }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({
    selectedStoreId,
    selectedStore: {
      id: selectedStoreId,
      tenantId: 'tenant-1',
      name: 'Alpha',
      slug: 'alpha',
      status: 'ACTIVE',
      currency: 'USD',
      timezone: 'UTC',
      locale: 'en-US',
      createdAt: '',
      updatedAt: '',
    },
    stores: [],
    loading: false,
    error: null,
    setSelectedStoreId: vi.fn(),
    refreshStores: vi.fn(),
  }),
}));

vi.mock('@/lib/permissions', () => ({
  useCanManageStore: () => canManage,
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ pushToast }),
}));

const api = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>(
    '@/lib/api-client',
  );
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => api.get(...args),
      post: (...args: unknown[]) => api.post(...args),
      patch: (...args: unknown[]) => api.patch(...args),
      delete: (...args: unknown[]) => api.delete(...args),
    },
  };
});

const sampleOrder = {
  id: 'ord-1',
  storeId: 'store-1',
  customerId: null,
  orderNumber: 'EM-100001',
  status: 'PENDING' as const,
  paymentStatus: 'PENDING' as const,
  fulfillmentStatus: 'UNFULFILLED' as const,
  currency: 'USD',
  subtotal: '21.00',
  discountTotal: '1.00',
  shippingTotal: '5.00',
  taxTotal: '0.00',
  grandTotal: '25.00',
  itemCount: 2,
  customer: null,
  customerNote: null,
  internalNote: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  items: [
    {
      id: 'oi-1',
      productId: 'p1',
      variantId: null,
      productName: 'Widget',
      variantName: null,
      sku: 'W-1',
      quantity: 2,
      unitPrice: '10.50',
      totalPrice: '21.00',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  addresses: [
    {
      id: 'oa-1',
      type: 'SHIPPING' as const,
      firstName: 'Ada',
      lastName: 'Lovelace',
      company: null,
      addressLine1: '123 Main',
      addressLine2: null,
      city: 'Dallas',
      state: 'TX',
      postalCode: '75001',
      country: 'US',
      phone: '+1',
      email: 'ada@example.com',
    },
    {
      id: 'oa-2',
      type: 'BILLING' as const,
      firstName: 'Ada',
      lastName: 'Lovelace',
      company: null,
      addressLine1: '123 Main',
      addressLine2: null,
      city: 'Dallas',
      state: 'TX',
      postalCode: '75001',
      country: 'US',
      phone: '+1',
      email: null,
    },
  ],
  payments: [
    {
      id: 'pay-1',
      provider: 'COD',
      amount: '25.00',
      currency: 'USD',
      status: 'PENDING' as const,
      method: 'CASH',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  shipments: [],
  timeline: [
    {
      type: 'ORDER_CREATED' as const,
      label: 'Order placed',
      description: 'Your order was received.',
      occurredAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  publicReference: 'pub-ref-sample-1234567890',
  cancelReason: null,
};

describe('Orders UI', () => {
  beforeEach(() => {
    selectedStoreId = 'store-1';
    canManage = true;
    pushToast.mockReset();
    api.get.mockReset();
    api.patch.mockReset();
  });

  it('loads order list', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleOrder],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<OrdersPage />);
    expect(await screen.findByRole('link', { name: 'EM-100001' })).toBeInTheDocument();
    expect(screen.getAllByText('Guest').length).toBeGreaterThan(0);
  });

  it('shows empty orders state', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
    });
    render(<OrdersPage />);
    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
  });

  it('loads order detail and updates status', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: sampleOrder });
    api.patch.mockResolvedValue({
      success: true,
      data: { ...sampleOrder, status: 'CONFIRMED' },
    });

    render(<OrderDetailPage />);
    expect(await screen.findByText('EM-100001')).toBeInTheDocument();
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText(/grand total/i).parentElement).toHaveTextContent('25.00');

    await user.selectOptions(
      screen.getByLabelText(/update order status/i),
      'CONFIRMED',
    );
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        '/stores/store-1/orders/ord-1/status',
        { status: 'CONFIRMED' },
      );
    });
  });

  it('cancels an order with confirmation and optional reason', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: sampleOrder });
    api.patch.mockResolvedValue({
      success: true,
      data: { ...sampleOrder, status: 'CANCELLED', cancelReason: 'Out of stock' },
    });

    render(<OrderDetailPage />);
    await screen.findByText('EM-100001');
    expect(screen.getByText(/timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/order placed/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel order/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(
      within(dialog).getByPlaceholderText(/out of stock/i),
      'Out of stock',
    );
    await user.click(within(dialog).getByRole('button', { name: /cancel order/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        '/stores/store-1/orders/ord-1/status',
        { status: 'CANCELLED', reason: 'Out of stock' },
      );
    });
    expect(pushToast).toHaveBeenCalledWith('Order cancelled.', 'success');
  });

  it('applies sort and shipping filters on list search', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({
      success: true,
      data: {
        items: [sampleOrder],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });
    render(<OrdersPage />);
    await screen.findByRole('link', { name: 'EM-100001' });

    await user.selectOptions(screen.getByLabelText(/sort orders/i), 'highest');
    await user.type(screen.getByLabelText(/shipping method filter/i), 'Free');
    await user.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      const url = String(api.get.mock.calls.at(-1)?.[0] ?? '');
      expect(url).toContain('sortBy=grandTotal');
      expect(url).toContain('sortOrder=desc');
      expect(url).toContain('shippingMethod=Free');
    });
  });

  it('hides write controls for staff', async () => {
    canManage = false;
    api.get.mockResolvedValue({ success: true, data: sampleOrder });
    render(<OrderDetailPage />);
    await screen.findByText('EM-100001');
    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only access/i)).toBeInTheDocument();
  });

  it('shows API errors', async () => {
    api.get.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'No access'));
    render(<OrdersPage />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
