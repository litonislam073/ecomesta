'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AdminThemePurchase, BillingPaymentStatus, OffsetPageMeta } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/components/ui/toast';
import { buildQuery, formatDateTime, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

const METHODS: Record<AdminThemePurchase['method'], { label: string; color: string }> = {
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

function taka(amount: string) {
  return `৳${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(amount))}`;
}

function submitterName(purchase: AdminThemePurchase) {
  const by = purchase.submittedBy;
  if (!by) return null;
  return [by.firstName, by.lastName].filter(Boolean).join(' ') || null;
}

function PurchaseCard({
  purchase,
  onApprove,
  onReject,
}: {
  purchase: AdminThemePurchase;
  onApprove: (purchase: AdminThemePurchase) => void;
  onReject: (purchase: AdminThemePurchase, reason: string) => Promise<void>;
}) {
  const method = METHODS[purchase.method];
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const name = submitterName(purchase);

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
              <Link href={`/dashboard/tenants/${purchase.tenant.id}`} className="hover:underline">
                {purchase.tenant.name}
              </Link>
            </p>
            {purchase.submittedBy ? (
              <p className="text-sm text-[var(--color-muted)]">
                {name ? `${name} · ` : ''}
                {purchase.submittedBy.email}
              </p>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-tight">{taka(purchase.amount)}</p>
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[purchase.status]}`}>
            {purchase.status === 'PENDING' ? 'Waiting for review' : purchase.status === 'APPROVED' ? 'Approved' : 'Rejected'}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 rounded-lg bg-[#f6f8f7] p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-[var(--color-muted)]">Theme</dt>
          <dd className="font-semibold">{purchase.theme.name} · one-time</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Method</dt>
          <dd className="font-semibold">
            {method.label} to {purchase.payToNumber}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Sender number</dt>
          <dd className="font-semibold">{purchase.senderNumber}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Transaction ID</dt>
          <dd className="font-mono font-semibold">{purchase.transactionId}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Submitted</dt>
          <dd className="font-semibold">{formatDateTime(purchase.createdAt)}</dd>
        </div>
      </dl>

      {purchase.status !== 'PENDING' ? (
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          {purchase.status === 'APPROVED' ? 'Approved' : 'Rejected'}
          {purchase.reviewedBy ? ` by ${purchase.reviewedBy.email}` : ''}
          {purchase.reviewedAt ? ` on ${formatDateTime(purchase.reviewedAt)}` : ''}
          {purchase.rejectionReason ? ` — ${purchase.rejectionReason}` : ''}
        </p>
      ) : rejecting ? (
        <div className="mt-4 space-y-2">
          <label className="block text-sm">
            <span className="font-medium">Reason (shown to the merchant)</span>
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
                void onReject(purchase, reason.trim()).finally(() => setBusy(false));
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
          <Button onClick={() => onApprove(purchase)}>Approve &amp; unlock theme</Button>
          <Button variant="secondary" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      )}
    </li>
  );
}

export default function AdminThemePurchasesPage() {
  const { pushToast } = useToast();
  const [status, setStatus] = useState<BillingPaymentStatus | ''>('PENDING');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminThemePurchase[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<AdminThemePurchase | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{
        success: true;
        data: { items: AdminThemePurchase[]; meta: OffsetPageMeta; pendingCount: number };
      }>(`/admin/theme-purchases?${buildQuery({ page, limit: 20, status: status || undefined })}`);
      setItems(result.data.items);
      setMeta(result.data.meta);
      setPendingCount(result.data.pendingCount);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load theme purchases'));
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
      await api.post(`/admin/theme-purchases/${approving.id}/approve`);
      pushToast(`Approved — ${approving.tenant.name} can now use ${approving.theme.name}.`, 'success');
      setApproving(null);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not approve the payment'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function reject(purchase: AdminThemePurchase, reason: string) {
    try {
      await api.post(`/admin/theme-purchases/${purchase.id}/reject`, { reason });
      pushToast(`Rejected — ${purchase.tenant.name} sees the reason on their Theme page.`, 'success');
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not reject the payment'), 'error');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Theme purchases"
        description="Premium theme payments by bKash, Nagad, Rocket and Upay. Check each one arrived before approving — approval unlocks the theme for every store of the business."
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

      {loading ? <LoadingState label="Loading theme purchases" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title={status === 'PENDING' ? 'No theme payments waiting' : 'No theme payments'}
          description={status === 'PENDING' ? 'New premium theme payments appear here.' : 'Nothing to show for this filter.'}
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((purchase) => (
            <PurchaseCard key={purchase.id} purchase={purchase} onApprove={setApproving} onReject={reject} />
          ))}
        </ul>
      ) : null}
      {meta && meta.totalPages > 1 ? (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
      ) : null}

      <ConfirmDialog
        open={approving !== null}
        title="Approve this theme payment?"
        description={
          approving
            ? `Only approve if ${taka(approving.amount)} from ${approving.senderNumber} arrived on ${METHODS[approving.method].label} ${approving.payToNumber} with transaction ID ${approving.transactionId}. ${approving.tenant.name} gets ${approving.theme.name} for all its stores.`
            : undefined
        }
        confirmLabel="Approve & unlock"
        busy={busy}
        onConfirm={() => void approve()}
        onCancel={() => setApproving(null)}
      />
    </div>
  );
}
