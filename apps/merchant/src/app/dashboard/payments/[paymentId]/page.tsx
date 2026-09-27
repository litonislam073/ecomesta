'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PaymentDetail, PaymentStatus } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

const PAYMENT_NEXT: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
  PENDING: ['AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED'],
  AUTHORIZED: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['PARTIALLY_REFUNDED', 'REFUNDED'],
  PARTIALLY_PAID: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED'],
  FAILED: ['PENDING', 'CANCELLED'],
  PARTIALLY_REFUNDED: ['REFUNDED'],
};

export default function PaymentDetailPage() {
  const params = useParams<{ paymentId: string }>();
  const paymentId = params.paymentId;
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!selectedStoreId || !paymentId) {
      setPayment(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: PaymentDetail }>(
        `/stores/${selectedStoreId}/payments/${paymentId}`,
      );
      setPayment(result.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load payment');
      setPayment(null);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, paymentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const nextStatuses = useMemo(
    () => (payment ? PAYMENT_NEXT[payment.status] ?? [] : []),
    [payment],
  );

  async function updateStatus(status: PaymentStatus) {
    if (!selectedStoreId || !paymentId || !canWrite) return;
    setBusy(true);
    try {
      const result = await api.patch<{ success: true; data: PaymentDetail }>(
        `/stores/${selectedStoreId}/payments/${paymentId}/status`,
        { status },
      );
      setPayment(result.data);
      pushToast('Payment status updated', 'success');
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store to view this payment."
      />
    );
  }

  if (loading) return <LoadingState label="Loading payment…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!payment) {
    return (
      <EmptyState title="Payment not found" description="It may belong to another store." />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--color-muted)]">
            <Link href="/dashboard/payments" className="hover:underline">
              Payments
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">{payment.orderNumber}</h1>
        </div>
        <Link
          href={`/dashboard/orders/${payment.orderId}`}
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          View order
        </Link>
      </div>

      <dl className="grid gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-[var(--color-muted)]">Reference</dt>
          <dd className="font-mono text-sm">{payment.internalReference}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--color-muted)]">Provider txn</dt>
          <dd className="font-medium">
            {payment.providerPaymentId ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--color-muted)]">Attempt</dt>
          <dd className="font-medium">#{payment.attemptNumber}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--color-muted)]">Amount</dt>
          <dd className="font-medium">
            {payment.currency} {payment.amount}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--color-muted)]">Status</dt>
          <dd className="font-medium">{payment.status}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--color-muted)]">Provider</dt>
          <dd className="font-medium">{payment.provider}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--color-muted)]">Method</dt>
          <dd className="font-medium">{payment.method}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--color-muted)]">Created</dt>
          <dd className="font-medium">
            {new Date(payment.createdAt).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--color-muted)]">Updated</dt>
          <dd className="font-medium">
            {new Date(payment.updatedAt).toLocaleString()}
          </dd>
        </div>
      </dl>

      {canWrite ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <label className="space-y-1 text-sm">
            <span>Update status</span>
            <Select
              value=""
              disabled={busy || nextStatuses.length === 0}
              onChange={(e) => {
                const value = e.target.value as PaymentStatus;
                if (value) void updateStatus(value);
              }}
            >
              <option value="">Change status…</option>
              {nextStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </label>
          {nextStatuses.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              No further transitions available.
            </p>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title="Read-only access"
          description="Payment status changes require manager access."
        />
      )}

      <Button type="button" variant="secondary" onClick={() => void load()}>
        Refresh
      </Button>
    </div>
  );
}
