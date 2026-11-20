'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AdminDomainOrder, DomainOrderStatus, DomainSalesSettings, OffsetPageMeta } from '@ecomesta/types';
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

const METHODS: Record<AdminDomainOrder['method'], { label: string; color: string }> = {
  BKASH: { label: 'bKash', color: '#E2136E' },
  NAGAD: { label: 'Nagad', color: '#EE4023' },
  ROCKET: { label: 'Rocket', color: '#8C3494' },
  UPAY: { label: 'Upay', color: '#0F54A6' },
};

const TABS: { value: DomainOrderStatus | ''; label: string }[] = [
  { value: 'PENDING', label: 'Waiting for review' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: '', label: 'All' },
];

const STATUS: Record<DomainOrderStatus, { label: string; className: string }> = {
  PENDING: { label: 'Waiting for review', className: 'bg-[#fff6e0] text-[#8a5a00]' },
  PROCESSING: { label: 'Registering…', className: 'bg-[#eaf1fa] text-[#0f54a6]' },
  FAILED: { label: 'Failed', className: 'bg-[#fdeee8] text-[#a3441f]' },
  COMPLETED: { label: 'Completed', className: 'bg-[#e3f1ec] text-[#1b6b53]' },
  REJECTED: { label: 'Rejected', className: 'bg-[#f1f1f1] text-[#555]' },
};

function taka(amount: string | number) {
  return `৳${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(amount))}`;
}

function OrderCard({
  order,
  onApprove,
  onReject,
}: {
  order: AdminDomainOrder;
  onApprove: (order: AdminDomainOrder) => void;
  onReject: (order: AdminDomainOrder, reason: string) => Promise<void>;
}) {
  const method = METHODS[order.method];
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const reviewable = order.status === 'PENDING' || order.status === 'FAILED';
  const profit = Number(order.amount) - Number(order.costUsd) * Number(order.usdRate);
  const r = order.registrant;

  return (
    <li className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-lg font-semibold">{order.domain}</p>
          <p className="text-sm text-[var(--color-muted)]">
            {order.kind === 'RENEW' ? 'Renewal' : 'New registration'} · {order.years} {order.years === 1 ? 'year' : 'years'} ·{' '}
            <Link href={`/dashboard/tenants/${order.tenant.id}`} className="hover:underline">
              {order.tenant.name}
            </Link>
            {order.submittedBy ? ` · ${order.submittedBy.email}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-tight">{taka(order.amount)}</p>
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[order.status].className}`}>
            {STATUS[order.status].label}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 rounded-lg bg-[#f6f8f7] p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-[var(--color-muted)]">Method</dt>
          <dd className="font-semibold">
            <span style={{ color: method.color }}>{method.label}</span> to {order.payToNumber}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Sender number</dt>
          <dd className="font-semibold">{order.senderNumber}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Transaction ID</dt>
          <dd className="font-mono font-semibold">{order.transactionId}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Registrar cost</dt>
          <dd className="font-semibold">
            ${order.costUsd} × ৳{Number(order.usdRate)} = {taka(Number(order.costUsd) * Number(order.usdRate))}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Profit</dt>
          <dd className="font-semibold">{taka(profit)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Submitted</dt>
          <dd className="font-semibold">{formatDateTime(order.createdAt)}</dd>
        </div>
        {r ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-[var(--color-muted)]">Registrant (WHOIS)</dt>
            <dd className="font-semibold">
              {r.name} · {r.email} · {r.phone} · {r.address}, {r.city} {r.postcode}
            </dd>
          </div>
        ) : null}
      </dl>

      {order.status === 'FAILED' && order.failureReason ? (
        <p role="alert" className="mt-3 rounded-md bg-[#fdeee8] px-3 py-2 text-sm text-[#a3441f]">
          Registrar said: {order.failureReason}
        </p>
      ) : null}

      {!reviewable ? (
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          {STATUS[order.status].label}
          {order.reviewedBy ? ` by ${order.reviewedBy.email}` : ''}
          {order.reviewedAt ? ` on ${formatDateTime(order.reviewedAt)}` : ''}
          {order.rejectionReason ? ` — ${order.rejectionReason}` : ''}
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
                void onReject(order, reason.trim()).finally(() => setBusy(false));
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
          <Button onClick={() => onApprove(order)}>
            {order.status === 'FAILED' ? 'Try again' : order.kind === 'RENEW' ? 'Approve & renew' : 'Approve & register'}
          </Button>
          <Button variant="secondary" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      )}
    </li>
  );
}

function SettingsPanel({ mode, onSaved }: { mode: string | null; onSaved: () => void }) {
  const { pushToast } = useToast();
  const [settings, setSettings] = useState<DomainSalesSettings | null>(null);
  const [balance, setBalance] = useState<{ balanceUsd: number | null; error?: string } | null>(null);
  const [tlds, setTlds] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ success: true; data: DomainSalesSettings }>('/admin/domain-sales/settings')
      .then((r) => {
        setSettings(r.data);
        setTlds(r.data.tlds.join(', '));
      })
      .catch((err: unknown) => pushToast(humanApiError(err, 'Could not load domain settings'), 'error'));
    api
      .get<{ success: true; data: { balanceUsd: number | null; error?: string } }>('/admin/domain-sales/balance')
      .then((r) => setBalance(r.data))
      .catch(() => setBalance({ balanceUsd: null, error: 'Could not reach the registrar' }));
  }, [pushToast]);

  if (!settings) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const result = await api.patch<{ success: true; data: DomainSalesSettings }>('/admin/domain-sales/settings', {
        ...settings,
        tlds: tlds.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean),
      });
      setSettings(result.data);
      setTlds(result.data.tlds.join(', '));
      pushToast('Domain settings saved', 'success');
      onSaved();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not save the settings'), 'error');
    } finally {
      setSaving(false);
    }
  }

  const input = 'mt-1 block w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm';
  const example = Math.ceil((11.62 * settings.usdRate) / 10) * 10 + settings.marginBdt;

  return (
    <form onSubmit={save} aria-label="Domain settings" className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Pricing and registrar</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Price per year = registrar USD price × dollar rate (rounded up to ৳10) + profit. A .com at $11.62 sells for {taka(example)}.
          </p>
        </div>
        <div className="text-right text-sm">
          <p>
            Registrar: <strong>Dynadot {mode ?? ''}</strong>
          </p>
          <p>
            Balance:{' '}
            <strong>{balance ? (balance.balanceUsd === null ? balance.error ?? 'unknown' : `$${balance.balanceUsd.toFixed(2)}`) : '…'}</strong>
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="font-medium">Dollar rate (৳ per $)</span>
          <input
            type="number"
            min={1}
            step="0.01"
            className={input}
            value={settings.usdRate}
            onChange={(e) => setSettings({ ...settings, usdRate: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Profit per year (৳)</span>
          <input
            type="number"
            min={0}
            step="1"
            className={input}
            value={settings.marginBdt}
            onChange={(e) => setSettings({ ...settings, marginBdt: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Max years</span>
          <input
            type="number"
            min={1}
            max={10}
            className={input}
            value={settings.maxYears}
            onChange={(e) => setSettings({ ...settings, maxYears: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Extensions</span>
          <input className={input} value={tlds} onChange={(e) => setTlds(e.target.value)} placeholder="com, net, shop" />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
          Sell domains on the website and dashboard
        </label>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save domain settings'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminDomainOrdersPage() {
  const { pushToast } = useToast();
  const [status, setStatus] = useState<DomainOrderStatus | ''>('PENDING');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminDomainOrder[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [mode, setMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<AdminDomainOrder | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{
        success: true;
        data: { items: AdminDomainOrder[]; meta: OffsetPageMeta; pendingCount: number; registrarMode: string };
      }>(`/admin/domain-sales/orders?${buildQuery({ page, limit: 20, status: status || undefined })}`);
      setItems(result.data.items);
      setMeta(result.data.meta);
      setPendingCount(result.data.pendingCount);
      setMode(result.data.registrarMode);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load domain orders'));
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
      const result = await api.post<{ success: true; data: AdminDomainOrder }>(`/admin/domain-sales/orders/${approving.id}/approve`);
      if (result.data.status === 'COMPLETED') {
        pushToast(
          approving.kind === 'RENEW' ? `${approving.domain} renewed.` : `${approving.domain} registered and connected to the store.`,
          'success',
        );
      } else {
        pushToast(`The registrar refused: ${result.data.failureReason ?? 'unknown reason'}`, 'error');
      }
      setApproving(null);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not approve the order'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function reject(order: AdminDomainOrder, reason: string) {
    try {
      await api.post(`/admin/domain-sales/orders/${order.id}/reject`, { reason });
      pushToast(`Rejected — ${order.tenant.name} sees the reason on their Domains page.`, 'success');
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not reject the order'), 'error');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Domain orders"
        description="Domains bought and renewed by merchants with bKash, Nagad, Rocket and Upay. Check the payment arrived, then approve — the domain is registered at Dynadot in the merchant's name and connected to their store."
      />

      <SettingsPanel mode={mode} onSaved={() => void load()} />

      <div role="tablist" aria-label="Order status" className="flex flex-wrap gap-2">
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

      {loading ? <LoadingState label="Loading domain orders" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title={status === 'PENDING' ? 'No domain orders waiting' : 'No domain orders'}
          description={status === 'PENDING' ? 'New domain payments appear here.' : 'Nothing to show for this filter.'}
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((order) => (
            <OrderCard key={order.id} order={order} onApprove={setApproving} onReject={reject} />
          ))}
        </ul>
      ) : null}
      {meta && meta.totalPages > 1 ? <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} /> : null}

      <ConfirmDialog
        open={approving !== null}
        title={approving?.kind === 'RENEW' ? 'Approve and renew this domain?' : 'Approve and register this domain?'}
        description={
          approving
            ? `Only approve if ${taka(approving.amount)} from ${approving.senderNumber} arrived on ${METHODS[approving.method].label} ${approving.payToNumber} with transaction ID ${approving.transactionId}. Dynadot (${mode ?? 'registrar'}) is charged about $${approving.costUsd} from the account balance.`
            : undefined
        }
        confirmLabel={approving?.kind === 'RENEW' ? 'Approve & renew' : 'Approve & register'}
        busy={busy}
        onConfirm={() => void approve()}
        onCancel={() => setApproving(null)}
      />
    </div>
  );
}
