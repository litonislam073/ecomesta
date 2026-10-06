'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PublicOrderConfirmationDetail } from '@ecomesta/types';
import { OrderTimeline } from '@/components/order-timeline';
import { formatMoney } from '@/lib/money';
import { contactProof, lookupPublicOrder, type OrderContact } from '@/lib/order-contact';
import { publicPost, PublicApiError } from '@/lib/public-api';

function CancelOrderPanel({
  storeSlug,
  publicReference,
  contact,
  onCancelled,
}: {
  storeSlug: string;
  publicReference: string;
  contact: OrderContact;
  onCancelled: (order: PublicOrderConfirmationDetail) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await publicPost<{
        success: true;
        data: PublicOrderConfirmationDetail;
      }>(
        `/public/stores/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(publicReference)}/cancel`,
        { ...contactProof(contact), reason: reason.trim() || undefined },
      );
      onCancelled(result.data);
      setConfirming(false);
    } catch (err) {
      setError(
        err instanceof PublicApiError
          ? err.message
          : 'We could not cancel this order. Please contact the store.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-5 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg)]"
      >
        Cancel order
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Confirm order cancellation"
      className="mx-auto mt-5 max-w-md space-y-3 rounded-lg border border-[var(--color-border)] p-4 text-left"
    >
      <p className="text-sm">
        Cancel this order? This cannot be undone. Items return to the store’s stock.
      </p>
      <label className="block space-y-1 text-sm">
        <span className="text-[var(--color-muted)]">Reason (optional)</span>
        <textarea
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={2}
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Cancelling…' : 'Yes, cancel order'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={submitting}
          className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm"
        >
          Keep order
        </button>
      </div>
    </div>
  );
}

const TERMINAL = new Set(['COMPLETED', 'CANCELLED', 'DELIVERED']);
const POLL_MS = 20_000;

function shouldPoll(order: PublicOrderConfirmationDetail): boolean {
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    return false;
  }
  const delivered = order.shipments.some((s) => s.status === 'DELIVERED');
  if (delivered) return false;
  return !TERMINAL.has(order.status);
}

export function OrderTrackingView({
  storeSlug,
  initial,
  contact,
}: {
  storeSlug: string;
  initial: PublicOrderConfirmationDetail;
  /** Email or phone used at checkout; needed to refresh and to cancel. */
  contact?: OrderContact | null;
}) {
  const [order, setOrder] = useState(initial);

  const refresh = useCallback(async () => {
    setOrder(await lookupPublicOrder(storeSlug, order.publicReference, contact ?? {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contact is read by value
  }, [storeSlug, order.publicReference, contact?.email, contact?.phone]);

  useEffect(() => {
    if (!shouldPoll(order)) return;
    const id = window.setInterval(() => {
      void refresh().catch(() => {
        /* keep last good snapshot */
      });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [order, refresh]);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-muted)]">
          Order tracking
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          {order.orderNumber}
        </h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Status: {order.status} · Payment: {order.paymentStatus} · Fulfillment:{' '}
          {order.fulfillmentStatus}
        </p>
        {order.status === 'CANCELLED' && order.cancelReason ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            {order.cancelReason}
          </p>
        ) : null}
        {order.canCancel && contact && contactProof(contact) ? (
          <CancelOrderPanel
            storeSlug={storeSlug}
            publicReference={order.publicReference}
            contact={contact}
            onCancelled={setOrder}
          />
        ) : null}
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-lg font-semibold">Timeline</h2>
        <div className="mt-4">
          <OrderTimeline events={order.timeline ?? []} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-lg font-semibold">Items</h2>
        <ul className="space-y-2 text-sm">
          {order.items.map((item, index) => (
            <li key={`${item.productName}-${index}`} className="flex justify-between gap-3">
              <span>
                {item.productName}
                {item.variantName ? ` · ${item.variantName}` : ''} × {item.quantity}
              </span>
              <span>{formatMoney(item.totalPrice, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-[var(--color-border)] pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotal, order.currency)}</dd>
          </div>
          {Number(order.discountTotal) > 0 ? (
            <div className="flex justify-between">
              <dt>
                Discount
                {order.couponCode ? ` (${order.couponCode})` : ''}
              </dt>
              <dd>−{formatMoney(order.discountTotal, order.currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>
              Shipping
              {order.shippingMethodName ? ` (${order.shippingMethodName})` : ''}
            </dt>
            <dd>{formatMoney(order.shippingTotal, order.currency)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(order.total, order.currency)}</dd>
          </div>
        </dl>
        <p className="text-sm text-[var(--color-muted)]">
          Payment: {order.paymentProvider ?? '—'} / {order.paymentMethod ?? '—'}
        </p>
      </section>

      {order.shipments.length > 0 ? (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Shipment tracking</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {order.shipments.map((shipment, index) => (
              <li key={`${shipment.status}-${index}`}>
                <p>
                  {shipment.provider} · {shipment.status}
                </p>
                {shipment.trackingNumber ? (
                  <p className="text-[var(--color-muted)]">
                    Tracking: {shipment.trackingNumber}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {order.shippingAddress ? (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm">
          <h2 className="text-lg font-semibold">Shipping address</h2>
          <p className="mt-2">{order.shippingAddress.name}</p>
          <p>{order.shippingAddress.addressLine1}</p>
          {order.shippingAddress.addressLine2 ? (
            <p>{order.shippingAddress.addressLine2}</p>
          ) : null}
          <p>
            {[
              order.shippingAddress.city,
              order.shippingAddress.state,
              order.shippingAddress.postalCode,
            ]
              .filter(Boolean)
              .join(', ')}
          </p>
          <p>{order.shippingAddress.country}</p>
        </section>
      ) : null}
    </div>
  );
}
