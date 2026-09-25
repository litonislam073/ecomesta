'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type {
  FulfillmentStatus,
  OrderDetail,
  OrderStatus,
  PaymentStatus,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { StatusBadge } from '@/components/catalog/status-badge';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

const ORDER_NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'CANCELLED'],
};

const PAYMENT_NEXT: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
  PENDING: ['AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED'],
  AUTHORIZED: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['PARTIALLY_REFUNDED', 'REFUNDED'],
  FAILED: ['PENDING', 'CANCELLED'],
};

const FULFILLMENT_NEXT: Partial<Record<FulfillmentStatus, FulfillmentStatus[]>> = {
  UNFULFILLED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'],
  PARTIALLY_FULFILLED: ['FULFILLED', 'RETURNED', 'CANCELLED'],
  FULFILLED: ['RETURNED'],
};

function formatPerson(
  first: string | null,
  last: string | null,
  fallback = '—',
): string {
  const name = [first, last].filter(Boolean).join(' ');
  return name || fallback;
}

function OrderDetailContent() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    if (!selectedStoreId || !orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: OrderDetail }>(
        `/stores/${selectedStoreId}/orders/${orderId}`,
      );
      setOrder(result.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('Order not found in this store.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have permission to view this order.');
      } else {
        setError(humanApiError(err, 'Failed to load order'));
      }
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStatus(path: string, body: Record<string, string>, success: string) {
    if (!selectedStoreId || !orderId) return;
    setBusy(true);
    try {
      const result = await api.patch<{ success: true; data: OrderDetail }>(
        `/stores/${selectedStoreId}/orders/${orderId}/${path}`,
        body,
      );
      setOrder(result.data);
      pushToast(success, 'success');
    } catch (err) {
      pushToast(humanApiError(err, 'Update failed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    await patchStatus('status', { status: 'CANCELLED' }, 'Order cancelled.');
    setCancelOpen(false);
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header to view this order."
      />
    );
  }

  const shipping = order?.addresses.find((a) => a.type === 'SHIPPING');
  const billing = order?.addresses.find((a) => a.type === 'BILLING');
  const nextStatuses = order ? ORDER_NEXT[order.status] ?? [] : [];
  const nextPayments = order ? PAYMENT_NEXT[order.paymentStatus] ?? [] : [];
  const nextFulfillment = order
    ? FULFILLMENT_NEXT[order.fulfillmentStatus] ?? []
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/orders"
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            ← Orders
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            {order?.orderNumber ?? 'Order'}
          </h1>
          {order ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={order.status} />
              <StatusBadge status={order.paymentStatus} />
              <StatusBadge status={order.fulfillmentStatus} />
            </div>
          ) : null}
        </div>
        {canWrite && order && nextStatuses.includes('CANCELLED') ? (
          <Button variant="danger" onClick={() => setCancelOpen(true)} disabled={busy}>
            Cancel order
          </Button>
        ) : null}
      </div>

      {loading ? <LoadingState label="Loading order" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && order ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="font-semibold">Customer</h2>
              <p className="mt-2 text-sm">
                {order.customer
                  ? formatPerson(order.customer.firstName, order.customer.lastName, 'Customer')
                  : 'Guest'}
              </p>
              <p className="text-sm text-[var(--color-muted)]">
                {order.customer?.email ?? shipping?.email ?? '—'}
              </p>
              <p className="text-sm text-[var(--color-muted)]">
                {order.customer?.phone ?? shipping?.phone ?? '—'}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="font-semibold">Placed</h2>
              <p className="mt-2 text-sm">{new Date(order.createdAt).toLocaleString()}</p>
              <p className="text-sm text-[var(--color-muted)]">
                Updated {new Date(order.updatedAt).toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="font-semibold">Totals</h2>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt>Subtotal</dt>
                  <dd>
                    {order.currency} {order.subtotal}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Discount</dt>
                  <dd>
                    {order.currency} {order.discountTotal}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Shipping</dt>
                  <dd>
                    {order.currency} {order.shippingTotal}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 font-semibold">
                  <dt>Grand total</dt>
                  <dd>
                    {order.currency} {order.grandTotal}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {canWrite ? (
            <section className="grid gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span>Order status</span>
                <Select
                  value=""
                  disabled={busy || nextStatuses.filter((s) => s !== 'CANCELLED').length === 0}
                  onChange={(e) => {
                    const value = e.target.value as OrderStatus;
                    if (value) {
                      void patchStatus('status', { status: value }, 'Order status updated.');
                    }
                  }}
                  aria-label="Update order status"
                >
                  <option value="">Change status…</option>
                  {nextStatuses
                    .filter((s) => s !== 'CANCELLED')
                    .map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                </Select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Payment status</span>
                <Select
                  value=""
                  disabled={busy || nextPayments.length === 0 || order.status === 'CANCELLED'}
                  onChange={(e) => {
                    const value = e.target.value as PaymentStatus;
                    if (value) {
                      void patchStatus(
                        'payment-status',
                        { paymentStatus: value },
                        'Payment status updated.',
                      );
                    }
                  }}
                  aria-label="Update payment status"
                >
                  <option value="">Change payment…</option>
                  {nextPayments.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Fulfillment status</span>
                <Select
                  value=""
                  disabled={
                    busy || nextFulfillment.length === 0 || order.status === 'CANCELLED'
                  }
                  onChange={(e) => {
                    const value = e.target.value as FulfillmentStatus;
                    if (value) {
                      void patchStatus(
                        'fulfillment-status',
                        { fulfillmentStatus: value },
                        'Fulfillment status updated.',
                      );
                    }
                  }}
                  aria-label="Update fulfillment status"
                >
                  <option value="">Change fulfillment…</option>
                  {nextFulfillment.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </label>
            </section>
          ) : (
            <EmptyState
              title="Read-only access"
              description="You can view this order. Status changes require manager access."
            />
          )}

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Items</h2>
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 font-medium">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.productName}</p>
                        {item.variantName ? (
                          <p className="text-xs text-[var(--color-muted)]">
                            {item.variantName}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{item.sku ?? '—'}</td>
                      <td className="px-4 py-3">{item.quantity}</td>
                      <td className="px-4 py-3">{item.unitPrice}</td>
                      <td className="px-4 py-3">{item.totalPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="font-semibold">Shipping address</h2>
              {shipping ? (
                <address className="mt-2 not-italic text-sm leading-6">
                  {formatPerson(shipping.firstName, shipping.lastName)}
                  <br />
                  {shipping.addressLine1}
                  {shipping.addressLine2 ? (
                    <>
                      <br />
                      {shipping.addressLine2}
                    </>
                  ) : null}
                  <br />
                  {[shipping.city, shipping.state, shipping.postalCode]
                    .filter(Boolean)
                    .join(', ')}
                  <br />
                  {shipping.country}
                  {shipping.phone ? (
                    <>
                      <br />
                      {shipping.phone}
                    </>
                  ) : null}
                  {shipping.email ? (
                    <>
                      <br />
                      {shipping.email}
                    </>
                  ) : null}
                </address>
              ) : (
                <p className="mt-2 text-sm text-[var(--color-muted)]">—</p>
              )}
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="font-semibold">Billing address</h2>
              {billing ? (
                <address className="mt-2 not-italic text-sm leading-6">
                  {formatPerson(billing.firstName, billing.lastName)}
                  <br />
                  {billing.addressLine1}
                  <br />
                  {[billing.city, billing.state, billing.postalCode]
                    .filter(Boolean)
                    .join(', ')}
                  <br />
                  {billing.country}
                </address>
              ) : (
                <p className="mt-2 text-sm text-[var(--color-muted)]">—</p>
              )}
            </div>
          </section>

          {order.payments.length > 0 ? (
            <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="font-semibold">Payment</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {p.provider} · {p.method}
                    </span>
                    <span>
                      {p.currency} {p.amount} · {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {order.shipments.length > 0 ? (
            <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="font-semibold">Shipments</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {order.shipments.map((s) => (
                  <li key={s.id}>
                    {s.provider} · {s.status}
                    {s.trackingNumber ? ` · ${s.trackingNumber}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this order?"
        description="Inventory deducted for this order will be restored once. This cannot be undone."
        confirmLabel="Cancel order"
        danger
        busy={busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => void onCancel()}
      />
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <StoreScoped>
      <OrderDetailContent />
    </StoreScoped>
  );
}
