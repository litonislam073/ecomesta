'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AdminBillingPayment, BillingPaymentStatus, OffsetPageMeta } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/components/ui/toast';
import { billingCycleLabel, buildQuery, formatDateTime, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

const METHODS: Record<AdminBillingPayment['method'], { label: string; color: string }> = {
  BKASH: { label: 'bKash', color: '#E2136E' },
  NAGAD: { label: 'Nagad', color: '#EE4023' },
  ROCKET: { label: 'Rocket', color: '#8C3494' },
  UPAY: { label: 'Upay', color: '#0F54A6' },
};

const TABS: { value: BillingPaymentStatus | ''; label: string }[] = [
  { value: 'PENDING', label: 'Waiting for review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: '', label: 'All' },
];

const STATUS_STYLE: Record<BillingPaymentStatus, string> = {
  PENDING: 'bg-[#fff6e0] text-[#8a5a00]',
  APPROVED: 'bg-[#e3f1ec] text-[#1b6b53]',
  REJECTED: 'bg-[#fdeee8] text-[#a3441f]',
};

function taka(amount: number) {
  return `৳${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
}

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => setCopied(false));
      }}
      className="ml-2 rounded border border-[var(--color-border)] px-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function PaymentCard({
  payment,
  onApprove,
  onReject,
}: {
  payment: AdminBillingPayment;
  onApprove: (payment: AdminBillingPayment) => void;
  onReject: (payment: AdminBillingPayment, reason: string) => Promise<void>;
}) {
  const method = METHODS[payment.method];
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <li className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: method.color }}
          >
            {method.label[0]}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-[var(--color-ink)]">
              <Link href={`/dashboard/tenants/${payment.tenant.id}`} className="hover:underline">
                {payment.tenant.name}
              </Link>
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              {payment.submittedBy.name ? `${payment.submittedBy.name} · ` : ''}
              {payment.submittedBy.email}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-tight">{taka(payment.amount)}</p>
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[payment.status]}`}>
            {payment.status === 'PENDING' ? 'Waiting for review' : payment.status === 'APPROVED' ? 'Approved' : 'Rejected'}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 rounded-lg bg-[#f6f8f7] p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-[var(--color-muted)]">Plan</dt>
          <dd className="font-semibold">
            {payment.planName} · {billingCycleLabel(payment.billingCycle)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Method</dt>
          <dd className="font-semibold">
            {method.label} to {payment.payToNumber}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Sender number</dt>
          <dd className="font-semibold">
            {payment.senderNumber}
            <CopyValue value={payment.senderNumber} label="sender number" />
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Transaction ID</dt>
          <dd className="font-mono font-semibold">
            {payment.transactionId}
            <CopyValue value={payment.transactionId} label="transaction ID" />
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Submitted</dt>
          <dd className="font-semibold">{formatDateTime(payment.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Current subscription</dt>
          <dd className="font-semibold">
            {payment.currentSubscription
              ? `${payment.currentSubscription.planName} · ${payment.currentSubscription.status.replace('_', ' ').toLowerCase()}`
              : 'None'}
          </dd>
        </div>
      </dl>

      {payment.status !== 'PENDING' ? (
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          {payment.status === 'APPROVED' ? 'Approved' : 'Rejected'}
          {payment.reviewedBy ? ` by ${payment.reviewedBy.email}` : ''}
          {payment.reviewedAt ? ` on ${formatDateTime(payment.reviewedAt)}` : ''}
          {payment.rejectionReason ? ` — ${payment.rejectionReason}` : ''}
        </p>
      ) : rejecting ? (
        <div className="mt-4 space-y-2">
          <label className="block text-sm">
            <span className="font-medium">Reason (sent to the merchant)</span>
            <textarea
              className="mt-1 block min-h-20 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. No payment with this transaction ID reached our bKash number."
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={busy || reason.trim().length < 3}
              onClick={() => {
                setBusy(true);
                void onReject(payment, reason.trim()).finally(() => setBusy(false));
              }}
            >
              {busy ? 'Rejecting…' : 'Reject payment'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => onApprove(payment)}>Approve &amp; activate plan</Button>
          <Button variant="secondary" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      )}
    </li>
  );
}

export default function AdminPaymentsPage() {
  const { pushToast } = useToast();
  const [status, setStatus] = useState<BillingPaymentStatus | ''>('PENDING');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminBillingPayment[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<AdminBillingPayment | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{
        success: true;
        data: { items: AdminBillingPayment[]; meta: OffsetPageMeta; pendingCount: number };
      }>(`/admin/billing-payments?${buildQuery({ page, limit: 20, status: status || undefined })}`);
      setItems(result.data.items);
      setMeta(result.data.meta);
      setPendingCount(result.data.pendingCount);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load payments'));
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve() {
    if (!approving) return;
    setBusy(true);
    try {
      await api.post(`/admin/billing-payments/${approving.id}/approve`);
      pushToast(`Approved — ${approving.tenant.name} is now on ${approving.planName}.`, 'success');
      setApproving(null);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not approve the payment'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function reject(payment: AdminBillingPayment, reason: string) {
    try {
      await api.post(`/admin/billing-payments/${payment.id}/reject`, { reason });
      pushToast(`Rejected — ${payment.tenant.name} has been told why.`, 'success');
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not reject the payment'), 'error');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="bKash, Nagad, Rocket and Upay subscription payments reported by merchants. Check each one arrived before approving — approval activates the plan."
      />

      <div role="tablist" aria-label="Payment status" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              status === tab.value
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                : 'border-[var(--color-border)] bg-white text-[var(--color-ink)]'
            }`}
          >
            {tab.label}
            {tab.value === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {loading ? <LoadingState label="Loading payments" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title={status === 'PENDING' ? 'No payments waiting' : 'No payments'}
          description={status === 'PENDING' ? 'New payments appear here and are emailed to the billing inbox.' : 'Nothing to show for this filter.'}
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((payment) => (
            <PaymentCard key={payment.id} payment={payment} onApprove={setApproving} onReject={reject} />
          ))}
        </ul>
      ) : null}
      {meta && meta.totalPages > 1 ? (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
      ) : null}

      <ConfirmDialog
        open={approving !== null}
        title="Approve this payment?"
        description={
          approving
            ? `Only approve if ${taka(approving.amount)} from ${approving.senderNumber} arrived on ${METHODS[approving.method].label} ${approving.payToNumber} with transaction ID ${approving.transactionId}. ${approving.tenant.name} gets the ${approving.planName} plan straight away.`
            : undefined
        }
        confirmLabel="Approve & activate"
        busy={busy}
        onConfirm={() => void approve()}
        onCancel={() => setApproving(null)}
      />
    </div>
  );
}
