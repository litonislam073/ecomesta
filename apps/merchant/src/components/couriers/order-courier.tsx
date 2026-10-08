'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CourierConnectionInfo, CourierShipment, OrderDetail, OrderShipmentRef } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';

const CLOSED = ['CANCELLED', 'RETURNED', 'FAILED'];

/** True while a shipment still counts against the order (not cancelled, returned or failed). */
export function isActiveShipment(s: OrderShipmentRef): boolean {
  return !CLOSED.includes(s.status);
}

/**
 * What the courier will collect, as a preview of the server's rule (the server
 * computes the real amount): nothing for paid orders, the order total for unpaid
 * cash-on-delivery orders, and no booking while an online payment is unsettled.
 */
export function codPreview(order: OrderDetail): { amount: string | null; reason: string | null } {
  if (order.paymentStatus === 'PAID') return { amount: '0.00', reason: 'Paid online — nothing to collect' };
  const latest = [...order.payments].sort((a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0) || b.createdAt.localeCompare(a.createdAt))[0];
  if (order.paymentStatus === 'PENDING' && latest?.provider === 'COD') {
    // Steadfast collects whole taka only; the server refuses a total with paisa rather than rounding it.
    if (!/^\d+(\.0+)?$/.test(order.grandTotal)) {
      return { amount: null, reason: `Steadfast collects cash in whole taka only, and this order's total (${order.currency} ${order.grandTotal}) includes paisa. Ship this order manually instead.` };
    }
    return { amount: order.grandTotal, reason: 'Cash on delivery — order total' };
  }
  return {
    amount: null,
    reason:
      order.paymentStatus === 'PENDING'
        ? 'The online payment is not complete yet, so this order cannot be sent to a courier.'
        : `Orders with payment status ${order.paymentStatus.toLowerCase().replace(/_/g, ' ')} cannot be sent to a courier.`,
  };
}

function prettyStatus(raw: string | null | undefined): string {
  if (!raw) return '—';
  return raw.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** "Create shipment with a courier" for an order that has no active shipment. */
export function CourierBookingPanel({ storeId, order, onBooked }: { storeId: string; order: OrderDetail; onBooked: () => void }) {
  const { pushToast } = useToast();
  const [couriers, setCouriers] = useState<CourierConnectionInfo[] | null>(null);
  const [provider, setProvider] = useState('');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ success: true; data: CourierConnectionInfo[] }>(`/stores/${storeId}/couriers`)
      .then((res) => {
        if (cancelled) return;
        const connected = res.data.filter((c) => c.status === 'CONNECTED');
        setCouriers(connected);
        if (connected[0]) {
          setProvider(connected[0].provider);
          setWeight(connected[0].defaultWeightKg?.toString() ?? '');
        }
      })
      .catch(() => !cancelled && setCouriers([]));
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const cod = codPreview(order);

  async function book() {
    const w = weight.trim();
    if (w && !(Number(w) > 0 && Number(w) <= 100)) return setError('Weight must be between 0.01 and 100 kg.');
    setBusy(true);
    setError(null);
    try {
      await api.post<{ success: true; data: CourierShipment }>(`/stores/${storeId}/orders/${order.id}/courier-shipments`, {
        provider,
        ...(w ? { weightKg: Number(w) } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      pushToast('Shipment booked with the courier', 'success');
      onBooked();
    } catch (err) {
      setError(humanApiError(err, 'Could not book the shipment'));
      // A lost answer leaves an unconfirmed booking: show it so the merchant can retry or sync.
      onBooked();
    } finally {
      setBusy(false);
    }
  }

  if (couriers === null) return <p className="text-sm text-[var(--color-muted)]">Loading couriers…</p>;
  if (couriers.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Book a courier parcel from here after you{' '}
        <Link href="/dashboard/settings/couriers" className="text-[var(--color-accent)] hover:underline">
          connect a courier in Settings → Couriers
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-[var(--color-border)] p-3" aria-label="Book with a courier" role="group">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,8rem)_minmax(0,1fr)]">
        <label className="space-y-1 text-sm">
          <span className="text-xs text-[var(--color-muted)]">Courier</span>
          <Select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={busy}>
            {couriers.map((c) => (
              <option key={c.provider} value={c.provider}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs text-[var(--color-muted)]">Weight (kg)</span>
          <Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} disabled={busy} placeholder="0.5" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs text-[var(--color-muted)]">Note for the courier (optional)</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={250} disabled={busy} />
        </label>
      </div>
      <p className="text-sm">
        <span className="text-[var(--color-muted)]">COD amount: </span>
        {cod.amount !== null ? (
          <strong>
            {order.currency} {cod.amount}
          </strong>
        ) : null}
        {cod.reason ? <span className="text-[var(--color-muted)]"> {cod.amount !== null ? `(${cod.reason})` : cod.reason}</span> : null}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <Button type="button" disabled={busy || cod.amount === null || !provider} onClick={() => void book()}>
        {busy ? 'Booking…' : 'Create shipment'}
      </Button>
    </div>
  );
}

/** A courier-booked shipment: tracking, courier status and "Sync status". No manual edits. */
export function CourierShipmentCard({
  storeId,
  orderId,
  currency,
  shipment,
  canWrite,
  onChanged,
}: {
  storeId: string;
  orderId: string;
  currency: string;
  shipment: OrderShipmentRef;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const { pushToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const booking = shipment.courierBooking ?? null;
  const courier = shipment.provider === 'STEADFAST' ? 'Steadfast' : shipment.provider;

  async function act(path: 'sync' | 'release', fallback: string) {
    setBusy(true);
    try {
      const res = await api.post<{ success: true; data: CourierShipment | null; message?: string }>(
        `/stores/${storeId}/orders/${orderId}/shipments/${shipment.id}/${path}`,
        {},
      );
      pushToast(res.message ?? 'Status refreshed', 'success');
      setConfirmRelease(false);
      onChanged();
    } catch (err) {
      pushToast(humanApiError(err, fallback), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!shipment.trackingNumber) return;
    try {
      await navigator.clipboard.writeText(shipment.trackingNumber);
      pushToast('Tracking code copied', 'success');
    } catch {
      pushToast('Copy failed — select the code instead', 'error');
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{courier}</span>
        <Badge tone={shipment.status === 'DELIVERED' ? 'success' : CLOSED.includes(shipment.status) ? 'danger' : 'neutral'}>{shipment.status}</Badge>
      </div>
      {booking === 'unconfirmed' ? (
        <p role="status" className="rounded-md bg-[#fff1d6] px-3 py-2 text-[#8a5a00]">
          {courier} did not confirm this booking (its answer was lost), so there is no tracking code yet. Ecomesta will
          not book it again by itself. Use “Sync status” to ask {courier}; if the parcel is not in your {courier} account,
          use “Mark as not booked” to book the order again.
        </p>
      ) : null}
      {booking === 'in_progress' ? (
        <p role="status" className="rounded-md bg-[#e8eeeb] px-3 py-2">
          Booking with {courier} is in progress…
        </p>
      ) : null}
      {booking === 'released' ? (
        <p className="text-[var(--color-muted)]">Marked as not booked after checking {courier}.</p>
      ) : null}
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <dt className="text-[var(--color-muted)]">Tracking</dt>
          <dd className="min-w-0 break-all font-mono">{shipment.trackingNumber ?? '—'}</dd>
          {shipment.trackingNumber ? (
            <button type="button" className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => void copy()}>
              Copy
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-[var(--color-muted)]">Courier status</dt>
          <dd>{prettyStatus(shipment.providerStatus)}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-[var(--color-muted)]">COD</dt>
          <dd>{shipment.codAmount !== null && shipment.codAmount !== undefined ? `${currency} ${shipment.codAmount}` : '—'}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-[var(--color-muted)]">Weight</dt>
          <dd>{shipment.weightKg ? `${shipment.weightKg} kg` : '—'}</dd>
        </div>
        {shipment.lastSyncedAt ? (
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <dt className="text-[var(--color-muted)]">Last checked</dt>
            <dd>{new Date(shipment.lastSyncedAt).toLocaleString()}</dd>
          </div>
        ) : null}
      </dl>
      {shipment.trackingNumber ? (
        <p className="text-xs text-[var(--color-muted)]">Track this code in your {courier} account or app.</p>
      ) : booking === 'confirmed' ? (
        <p className="text-xs text-[var(--color-muted)]">
          {courier} confirmed this parcel but did not return a tracking code here — find it in your {courier} account.
        </p>
      ) : null}
      {canWrite && booking !== 'released' && booking !== 'in_progress' ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void act('sync', 'Could not refresh the status')}>
            {busy && !confirmRelease ? 'Checking…' : 'Sync status'}
          </Button>
          {booking === 'unconfirmed' ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmRelease(true)}>
              Mark as not booked
            </Button>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmRelease}
        title={`Is this parcel missing from ${courier}?`}
        description={`Only continue if you checked your ${courier} account and this order's parcel is NOT there. Ecomesta will ask ${courier} once more; if it has the parcel, the booking is confirmed instead. Otherwise you can book the order again (with a new reference).`}
        confirmLabel="Mark as not booked"
        danger
        safeDefault
        busy={busy}
        onConfirm={() => void act('release', 'Could not mark the booking as not booked')}
        onCancel={() => setConfirmRelease(false)}
      />
    </div>
  );
}
