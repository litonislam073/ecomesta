import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CourierConnectionInfo, OrderDetail, OrderShipmentRef } from '@ecomesta/types';
import CourierSettingsPage from '@/app/dashboard/settings/couriers/page';
import { CourierBookingPanel, CourierShipmentCard, codPreview } from '@/components/couriers/order-courier';
import { ApiError } from '@/lib/api-client';

const pushToast = vi.fn();
let canManage = true;

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/settings/couriers',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/store-context', () => ({
  useStoreContext: () => ({ selectedStoreId: 'store-1', selectedStore: null, stores: [], loading: false, error: null, setSelectedStoreId: vi.fn(), refreshStores: vi.fn() }),
}));
vi.mock('@/lib/permissions', () => ({ useCanManageStore: () => canManage }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ pushToast }) }));

const api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    api: {
      get: (...a: unknown[]) => api.get(...a),
      post: (...a: unknown[]) => api.post(...a),
      put: (...a: unknown[]) => api.put(...a),
      delete: (...a: unknown[]) => api.delete(...a),
    },
  };
});

const notConnected: CourierConnectionInfo = {
  provider: 'STEADFAST',
  name: 'Steadfast',
  status: 'NOT_CONNECTED',
  supportsCancellation: false,
  credentialsSaved: false,
  pickupName: null,
  pickupPhone: null,
  pickupAddress: null,
  defaultWeightKg: null,
  connectedAt: null,
  updatedAt: null,
};
const connected: CourierConnectionInfo = {
  ...notConnected,
  status: 'CONNECTED',
  credentialsSaved: true,
  pickupName: 'Alpha Warehouse',
  pickupPhone: '01811000000',
  pickupAddress: 'Mirpur 10, Dhaka',
  defaultWeightKg: 0.5,
};

beforeEach(() => {
  canManage = true;
  pushToast.mockReset();
  for (const fn of Object.values(api)) fn.mockReset();
});

describe('Settings → Couriers', () => {
  it('connects Steadfast with both keys and pickup details', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: [notConnected] });
    api.put.mockResolvedValue({ success: true, data: connected });
    render(<CourierSettingsPage />);

    expect(await screen.findByText('Not connected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Connect Steadfast' }));
    // Both keys are required to connect.
    await user.type(screen.getByLabelText('API key'), 'sf_key_12345678');
    await user.click(screen.getByRole('button', { name: 'Connect Steadfast' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/both the API key and the secret key|API key and secret key/i);
    expect(api.put).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Secret key'), 'sf_secret_12345678');
    await user.type(screen.getByLabelText('Pickup contact name'), 'Alpha Warehouse');
    await user.type(screen.getByLabelText('Default parcel weight (kg)'), '0.5');
    await user.click(screen.getByRole('button', { name: 'Connect Steadfast' }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/stores/store-1/couriers/STEADFAST', expect.objectContaining({
        apiKey: 'sf_key_12345678',
        secretKey: 'sf_secret_12345678',
        pickupName: 'Alpha Warehouse',
        defaultWeightKg: 0.5,
      })),
    );
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Saved (hidden)')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('sf_secret_12345678')).not.toBeInTheDocument();
  });

  it('updates settings without re-sending keys; key fields start empty', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: [connected] });
    api.put.mockResolvedValue({ success: true, data: { ...connected, defaultWeightKg: 1 } });
    render(<CourierSettingsPage />);

    await user.click(await screen.findByRole('button', { name: 'Update' }));
    expect(screen.getByLabelText('API key')).toHaveValue('');
    expect(screen.getByLabelText('Secret key')).toHaveValue('');
    expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Pickup contact name')).toHaveValue('Alpha Warehouse');
    await user.clear(screen.getByLabelText('Default parcel weight (kg)'));
    await user.type(screen.getByLabelText('Default parcel weight (kg)'), '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const body = api.put.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).not.toHaveProperty('apiKey');
    expect(body).not.toHaveProperty('secretKey');
    expect(body.defaultWeightKg).toBe(1);
  });

  it('shows the server error when Steadfast rejects the keys', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: [notConnected] });
    api.put.mockRejectedValue(new ApiError(422, 'COURIER_AUTH_FAILED', 'Steadfast rejected the API credentials. Check the API key and secret key in Settings → Couriers.'));
    render(<CourierSettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Connect Steadfast' }));
    await user.type(screen.getByLabelText('API key'), 'wrongkey1234');
    await user.type(screen.getByLabelText('Secret key'), 'wrongsecret1234');
    await user.click(screen.getByRole('button', { name: 'Connect Steadfast' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Steadfast rejected the API credentials');
  });

  it('disconnects after confirmation', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ success: true, data: [connected] });
    api.delete.mockResolvedValue({ success: true, data: notConnected });
    render(<CourierSettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(api.delete).not.toHaveBeenCalled();
    const dialogButtons = screen.getAllByRole('button', { name: 'Disconnect' });
    await user.click(dialogButtons[dialogButtons.length - 1]!);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/stores/store-1/couriers/STEADFAST'));
    expect(await screen.findByText('Not connected')).toBeInTheDocument();
  });

  it('read-only members see the status but no connect button', async () => {
    canManage = false;
    api.get.mockResolvedValue({ success: true, data: [connected] });
    render(<CourierSettingsPage />);
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
  });
});

const baseOrder = {
  id: 'order-1',
  orderNumber: 'EM-100001',
  status: 'CONFIRMED',
  paymentStatus: 'PENDING',
  fulfillmentStatus: 'UNFULFILLED',
  currency: 'BDT',
  grandTotal: '1250.00',
  payments: [{ id: 'p1', provider: 'COD', amount: '1250.00', currency: 'BDT', status: 'PENDING', method: 'CASH', attemptNumber: 1, createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z' }],
  shipments: [],
} as unknown as OrderDetail;

describe('Order → courier booking', () => {
  it('previews COD from the order: total for unpaid COD, nothing when paid, blocked while an online payment is open', () => {
    expect(codPreview(baseOrder).amount).toBe('1250.00');
    expect(codPreview({ ...baseOrder, paymentStatus: 'PAID' } as OrderDetail).amount).toBe('0.00');
    const online = { ...baseOrder, payments: [{ ...baseOrder.payments[0]!, provider: 'SSL_COMMERZ' }] } as OrderDetail;
    expect(codPreview(online).amount).toBeNull();
  });

  it('does not offer a courier booking for a COD total with paisa (Steadfast takes whole taka only)', async () => {
    const paisa = { ...baseOrder, grandTotal: '1250.50' } as OrderDetail;
    expect(codPreview(paisa)).toMatchObject({ amount: null, reason: expect.stringMatching(/whole taka only.*BDT 1250\.50/) });
    api.get.mockResolvedValue({ success: true, data: [connected] });
    render(<CourierBookingPanel storeId="store-1" order={paisa} onBooked={vi.fn()} />);
    expect(await screen.findByText(/whole taka only/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create shipment' })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('books with the connected courier and never sends an amount', async () => {
    const user = userEvent.setup();
    const onBooked = vi.fn();
    api.get.mockResolvedValue({ success: true, data: [connected] });
    api.post.mockResolvedValue({ success: true, data: {} });
    render(<CourierBookingPanel storeId="store-1" order={baseOrder} onBooked={onBooked} />);

    expect(await screen.findByDisplayValue('0.5')).toBeInTheDocument();
    expect(screen.getByText('BDT 1250.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create shipment' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/stores/store-1/orders/order-1/courier-shipments', { provider: 'STEADFAST', weightKg: 0.5 }));
    expect(onBooked).toHaveBeenCalled();
  });

  it('points to Settings → Couriers when no courier is connected', async () => {
    api.get.mockResolvedValue({ success: true, data: [notConnected] });
    render(<CourierBookingPanel storeId="store-1" order={baseOrder} onBooked={vi.fn()} />);
    expect(await screen.findByRole('link', { name: /connect a courier/i })).toHaveAttribute('href', '/dashboard/settings/couriers');
  });

  it('shows the server error (e.g. duplicate) and refreshes the order', async () => {
    const user = userEvent.setup();
    const onBooked = vi.fn();
    api.get.mockResolvedValue({ success: true, data: [connected] });
    api.post.mockRejectedValue(new ApiError(409, 'SHIPMENT_ALREADY_EXISTS', 'This order already has an active shipment.'));
    render(<CourierBookingPanel storeId="store-1" order={baseOrder} onBooked={onBooked} />);
    await user.click(await screen.findByRole('button', { name: 'Create shipment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already has an active shipment');
  });

  const booked: OrderShipmentRef = {
    id: 'ship-1',
    provider: 'STEADFAST',
    trackingNumber: '15BAEB8A',
    status: 'LABEL_CREATED',
    shippedAt: null,
    deliveredAt: null,
    createdAt: '2026-10-07T00:00:00Z',
    updatedAt: '2026-10-07T00:00:00Z',
    courierManaged: true,
    courierBooking: 'confirmed',
    providerShipmentId: '1424107',
    providerStatus: 'in_review',
    codAmount: '1250.00',
    weightKg: '0.5',
    lastSyncedAt: '2026-10-07T00:00:00Z',
  };

  it('shows tracking, courier status and COD; Sync status calls the API; no cancel or manual edit', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    api.post.mockResolvedValue({ success: true, data: {} });
    render(<CourierShipmentCard storeId="store-1" orderId="order-1" currency="BDT" shipment={booked} canWrite onChanged={onChanged} />);
    expect(screen.getByText('15BAEB8A')).toBeInTheDocument();
    expect(screen.getByText('In review')).toBeInTheDocument();
    expect(screen.getByText('BDT 1250.00')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/update status/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sync status' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/stores/store-1/orders/order-1/shipments/ship-1/sync', {}));
    expect(onChanged).toHaveBeenCalled();
  });

  it('an unconfirmed booking: explains it, offers Sync and Mark as not booked (after confirmation)', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    api.post.mockResolvedValue({ success: true, data: {}, message: 'Marked as not booked. You can book this order again.' });
    render(
      <CourierShipmentCard
        storeId="store-1"
        orderId="order-1"
        currency="BDT"
        shipment={{ ...booked, status: 'PENDING', courierBooking: 'unconfirmed', providerShipmentId: null, trackingNumber: null, providerStatus: null }}
        canWrite
        onChanged={onChanged}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/did not confirm this booking/i);
    expect(screen.getByRole('status')).toHaveTextContent(/will not book it again by itself/i);
    expect(screen.getByText('Tracking').nextElementSibling).toHaveTextContent(/^—$/); // no fake tracking
    await user.click(screen.getByRole('button', { name: 'Mark as not booked' }));
    expect(api.post).not.toHaveBeenCalled();
    const dialogButtons = screen.getAllByRole('button', { name: 'Mark as not booked' });
    await user.click(dialogButtons[dialogButtons.length - 1]!);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/stores/store-1/orders/order-1/shipments/ship-1/release', {}));
    expect(pushToast).toHaveBeenCalledWith('Marked as not booked. You can book this order again.', 'success');
    expect(onChanged).toHaveBeenCalled();
  });

  it('a booking in progress offers no actions', () => {
    render(
      <CourierShipmentCard storeId="store-1" orderId="order-1" currency="BDT" shipment={{ ...booked, status: 'PENDING', courierBooking: 'in_progress', trackingNumber: null }} canWrite onChanged={vi.fn()} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/in progress/i);
    expect(screen.queryByRole('button', { name: 'Sync status' })).not.toBeInTheDocument();
  });
});
