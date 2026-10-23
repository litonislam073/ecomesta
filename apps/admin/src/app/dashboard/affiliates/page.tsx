'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type {
  AdminAffiliateCommissionItem,
  AdminAffiliateItem,
  AdminAffiliatePayoutItem,
  AffiliateProgramSettings,
  AffiliateStatus,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatDateTime, humanApiError } from '@/lib/admin-utils';
import { refreshAdminBadges } from '@/lib/admin-badges';
import { api } from '@/lib/api-client';

type Tab = 'affiliates' | 'payouts' | 'commissions' | 'settings';

const TABS: { value: Tab; label: string }[] = [
  { value: 'affiliates', label: 'Affiliates' },
  { value: 'payouts', label: 'Withdrawals' },
  { value: 'commissions', label: 'Commissions' },
  { value: 'settings', label: 'Settings' },
];

const METHOD_LABEL: Record<string, string> = { BKASH: 'bKash', NAGAD: 'Nagad', ROCKET: 'Rocket', UPAY: 'Upay' };

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-[#fff6e0] text-[#8a5a00]',
  REQUESTED: 'bg-[#fff6e0] text-[#8a5a00]',
  ACTIVE: 'bg-[#e3f1ec] text-[#1b6b53]',
  PAID: 'bg-[#e3f1ec] text-[#1b6b53]',
  APPROVED: 'bg-[#e3f1ec] text-[#1b6b53]',
  REJECTED: 'bg-[#fdeee8] text-[#a3441f]',
  SUSPENDED: 'bg-[#fdeee8] text-[#a3441f]',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Waiting for approval',
  REQUESTED: 'Waiting to be paid',
  ACTIVE: 'Active',
  PAID: 'Paid',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

const inputClass =
  'block w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]';

function taka(amount: number) {
  return `৳${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(amount)}`;
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] ?? ''}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** A reason box shown under an action that needs one (reject, suspend). */
function ReasonForm({
  label,
  confirmLabel,
  placeholder,
  onSubmit,
  onCancel,
}: {
  label: string;
  confirmLabel: string;
  placeholder?: string;
  onSubmit: (reason: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 space-y-2">
      <label className="block text-sm">
        <span className="font-medium">{label}</span>
        <textarea
          className={`mt-1 min-h-16 ${inputClass}`}
          value={reason}
          maxLength={500}
          placeholder={placeholder}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          disabled={busy || reason.trim().length < 3}
          onClick={() => {
            setBusy(true);
            void onSubmit(reason.trim()).finally(() => setBusy(false));
          }}
        >
          {busy ? 'Saving…' : confirmLabel}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function AdminAffiliatesPage() {
  const [tab, setTab] = useState<Tab>('affiliates');
  return (
    <div className="space-y-6">
      <PageHeader
        title="Affiliates"
        description="People who refer businesses to Ecomesta. Approve applications, pay withdrawals to their wallets and set the program terms."
      />
      <div role="tablist" aria-label="Affiliate sections" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              tab === t.value
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                : 'border-[var(--color-border)] bg-white text-[var(--color-ink)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'affiliates' ? <AffiliatesTab /> : null}
      {tab === 'payouts' ? <PayoutsTab /> : null}
      {tab === 'commissions' ? <CommissionsTab /> : null}
      {tab === 'settings' ? <SettingsTab /> : null}
    </div>
  );
}

function useList<T>(path: string, errorLabel: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Only the latest request may write state, so a slow response for a previous
  // filter can never overwrite (or leave stuck) the current one.
  const latest = useRef(0);
  const load = useCallback(async () => {
    const id = ++latest.current;
    setError(null);
    try {
      const res = await api.get<{ success: true; data: { items: T[] } }>(path);
      if (id === latest.current) setItems(res.data.items);
    } catch (err) {
      if (id === latest.current) setError(humanApiError(err, errorLabel));
    }
  }, [path, errorLabel]);
  useEffect(() => {
    setItems(null);
    void load();
    return () => {
      latest.current += 1;
    };
  }, [load]);
  return { items, error, load };
}

const AFFILIATE_FILTERS: { value: AffiliateStatus | ''; label: string }[] = [
  { value: 'PENDING', label: 'Waiting for approval' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: '', label: 'All' },
];

function AffiliatesTab() {
  const [filter, setFilter] = useState<AffiliateStatus | ''>('PENDING');
  const { items, error, load } = useList<AdminAffiliateItem>(
    `/admin/affiliates${filter ? `?status=${filter}` : ''}`,
    'Failed to load affiliates',
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Affiliate status">
        {AFFILIATE_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-md border px-3 py-1 text-sm ${
              filter === f.value ? 'border-[var(--color-ink)] font-semibold' : 'border-[var(--color-border)] text-[var(--color-muted)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!error && !items ? <LoadingState label="Loading affiliates" /> : null}
      {items && items.length === 0 ? (
        <EmptyState title="No affiliates here" description="Applications from the merchant app appear under Waiting for approval." />
      ) : null}
      {items && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((a) => (
            <AffiliateCard key={a.id} affiliate={a} onChanged={load} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AffiliateCard({ affiliate: a, onChanged }: { affiliate: AdminAffiliateItem; onChanged: () => Promise<void> }) {
  const { pushToast } = useToast();
  const [asking, setAsking] = useState<'reject' | 'suspend' | null>(null);
  const [busy, setBusy] = useState(false);
  const [rate, setRate] = useState(a.customRate == null ? '' : String(a.customRate));

  async function act(action: 'approve' | 'reject' | 'suspend' | 'reactivate', reason?: string) {
    setBusy(true);
    try {
      await api.post(`/admin/affiliates/${a.id}/${action}`, reason ? { reason } : undefined);
      refreshAdminBadges();
      pushToast(
        action === 'approve'
          ? `${a.user.name} is approved and was emailed their link.`
          : action === 'reactivate'
            ? `${a.user.name} is active again.`
            : `${a.user.name} is ${action === 'reject' ? 'rejected' : 'suspended'}.`,
        'success',
      );
      setAsking(null);
      await onChanged();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not update the affiliate'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = rate.trim() === '' ? null : Number(rate);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      pushToast('Enter a percent from 0 to 100, or leave it empty for the program rate.', 'error');
      return;
    }
    try {
      await api.patch(`/admin/affiliates/${a.id}/rate`, { rate: value });
      pushToast(value === null ? 'Uses the program rate.' : `Commission set to ${value}%.`, 'success');
      await onChanged();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not save the rate'), 'error');
    }
  }

  return (
    <li className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{a.user.name}</p>
          <p className="break-all text-sm text-[var(--color-muted)]">{a.user.email}</p>
          <p className="mt-1 text-sm">
            Code <span className="font-mono font-semibold">{a.code}</span> · Applied {formatDate(a.createdAt)}
          </p>
        </div>
        <StatusPill status={a.status} />
      </div>

      {a.applicationNote ? (
        <p className="mt-3 whitespace-pre-line rounded-lg bg-[#f6f8f7] p-3 text-sm">
          <span className="font-medium">How they will promote: </span>
          {a.applicationNote}
        </p>
      ) : null}
      {a.statusReason ? <p className="mt-2 text-sm text-[var(--color-muted)]">Reason: {a.statusReason}</p> : null}

      {a.status !== 'PENDING' ? (
        <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-lg bg-[#f6f8f7] p-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <dt className="text-[var(--color-muted)]">Clicks</dt>
            <dd className="font-semibold">{a.stats.clicks}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Sign-ups</dt>
            <dd className="font-semibold">{a.stats.signups}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Paying</dt>
            <dd className="font-semibold">{a.stats.paidCustomers}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Earned</dt>
            <dd className="font-semibold">{taka(a.balance.totalEarned)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Available</dt>
            <dd className="font-semibold">{taka(a.balance.available)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Paid</dt>
            <dd className="font-semibold">{taka(a.balance.paid)}</dd>
          </div>
        </dl>
      ) : null}

      {asking ? (
        <ReasonForm
          label={asking === 'reject' ? 'Why is the application rejected? (shown to them)' : 'Why is this affiliate suspended? (shown to them)'}
          confirmLabel={asking === 'reject' ? 'Reject application' : 'Suspend affiliate'}
          onSubmit={(reason) => act(asking, reason)}
          onCancel={() => setAsking(null)}
        />
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          {a.status === 'PENDING' || a.status === 'REJECTED' ? (
            <Button disabled={busy} onClick={() => void act('approve')}>
              Approve
            </Button>
          ) : null}
          {a.status === 'PENDING' ? (
            <Button variant="secondary" disabled={busy} onClick={() => setAsking('reject')}>
              Reject
            </Button>
          ) : null}
          {a.status === 'ACTIVE' ? (
            <Button variant="secondary" disabled={busy} onClick={() => setAsking('suspend')}>
              Suspend
            </Button>
          ) : null}
          {a.status === 'SUSPENDED' ? (
            <Button disabled={busy} onClick={() => void act('reactivate')}>
              Reactivate
            </Button>
          ) : null}
          {a.status === 'ACTIVE' || a.status === 'SUSPENDED' ? (
            <form className="ml-auto flex items-end gap-2" onSubmit={saveRate}>
              <label className="text-sm">
                <span className="block text-[var(--color-muted)]">Own rate % (empty = program)</span>
                <input
                  className={`${inputClass} w-28`}
                  inputMode="decimal"
                  value={rate}
                  placeholder={String(a.commissionRate)}
                  onChange={(e) => setRate(e.target.value)}
                />
              </label>
              <Button type="submit" variant="secondary">
                Save rate
              </Button>
            </form>
          ) : null}
        </div>
      )}
    </li>
  );
}

function PayoutsTab() {
  const [filter, setFilter] = useState<'REQUESTED' | 'PAID' | 'REJECTED' | ''>('REQUESTED');
  const { items, error, load } = useList<AdminAffiliatePayoutItem>(
    `/admin/affiliates/payouts${filter ? `?status=${filter}` : ''}`,
    'Failed to load withdrawals',
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Withdrawal status">
        {(
          [
            ['REQUESTED', 'Waiting to be paid'],
            ['PAID', 'Paid'],
            ['REJECTED', 'Rejected'],
            ['', 'All'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-md border px-3 py-1 text-sm ${
              filter === value ? 'border-[var(--color-ink)] font-semibold' : 'border-[var(--color-border)] text-[var(--color-muted)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!error && !items ? <LoadingState label="Loading withdrawals" /> : null}
      {items && items.length === 0 ? <EmptyState title="No withdrawals here" description="Requests from affiliates appear here." /> : null}
      {items && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((p) => (
            <PayoutCard key={p.id} payout={p} onChanged={load} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PayoutCard({ payout: p, onChanged }: { payout: AdminAffiliatePayoutItem; onChanged: () => Promise<void> }) {
  const { pushToast } = useToast();
  const [mode, setMode] = useState<'paid' | 'reject' | null>(null);
  const [trx, setTrx] = useState('');
  const [busy, setBusy] = useState(false);

  async function markPaid() {
    setBusy(true);
    try {
      await api.post(`/admin/affiliates/payouts/${p.id}/paid`, { transactionId: trx.trim() });
      refreshAdminBadges();
      pushToast(`Marked paid — ${p.affiliate.name} was emailed.`, 'success');
      await onChanged();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not mark it paid'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function reject(reason: string) {
    try {
      await api.post(`/admin/affiliates/payouts/${p.id}/reject`, { reason });
      refreshAdminBadges();
      pushToast('Rejected — the amount is back in their balance.', 'success');
      await onChanged();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not reject the withdrawal'), 'error');
    }
  }

  return (
    <li className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{p.affiliate.name}</p>
          <p className="break-all text-sm text-[var(--color-muted)]">
            {p.affiliate.email} · <span className="font-mono">{p.affiliate.code}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-tight">{taka(p.amount)}</p>
          <StatusPill status={p.status} />
        </div>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-lg bg-[#f6f8f7] p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[var(--color-muted)]">Send to</dt>
          <dd className="font-semibold">
            {METHOD_LABEL[p.method] ?? p.method} {p.number}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Account name</dt>
          <dd className="font-semibold">{p.accountName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Requested</dt>
          <dd className="font-semibold">{formatDateTime(p.createdAt)}</dd>
        </div>
      </dl>
      {p.status !== 'REQUESTED' ? (
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          {p.status === 'PAID' ? `Paid · transaction ${p.transactionId ?? ''}` : `Rejected — ${p.rejectionReason ?? ''}`}
          {p.reviewedAt ? ` · ${formatDateTime(p.reviewedAt)}` : ''}
        </p>
      ) : mode === 'reject' ? (
        <ReasonForm
          label="Why can it not be paid? (shown to them)"
          confirmLabel="Reject withdrawal"
          placeholder="e.g. This bKash number is not registered."
          onSubmit={reject}
          onCancel={() => setMode(null)}
        />
      ) : mode === 'paid' ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block font-medium">Transaction ID of the money you sent</span>
            <input className={`${inputClass} w-56 font-mono`} value={trx} maxLength={40} onChange={(e) => setTrx(e.target.value)} />
          </label>
          <Button disabled={busy || trx.trim().length < 4} onClick={() => void markPaid()}>
            {busy ? 'Saving…' : 'Confirm paid'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setMode(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setMode('paid')}>Mark as paid</Button>
          <Button variant="secondary" onClick={() => setMode('reject')}>
            Reject
          </Button>
        </div>
      )}
    </li>
  );
}

function CommissionsTab() {
  const { pushToast } = useToast();
  const { items, error, load } = useList<AdminAffiliateCommissionItem>('/admin/affiliates/commissions', 'Failed to load commissions');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const now = Date.now();

  async function reject(id: string, reason: string) {
    try {
      await api.post(`/admin/affiliates/commissions/${id}/reject`, { reason });
      pushToast('Commission rejected.', 'success');
      setRejecting(null);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not reject the commission'), 'error');
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!items) return <LoadingState label="Loading commissions" />;
  if (items.length === 0) {
    return <EmptyState title="No commissions yet" description="A commission is added when a referred business's first plan payment is approved." />;
  }
  return (
    <ul className="space-y-3">
      {items.map((c) => {
        const held = c.status === 'APPROVED' && new Date(c.availableAt).getTime() > now;
        return (
          <li key={c.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold">{c.tenant.name}</p>
                <p className="text-[var(--color-muted)]">
                  Referred by <span className="font-mono">{c.affiliate.code}</span> · {c.affiliate.email}
                </p>
                <p className="mt-1">
                  {taka(c.amount)} ({c.rate}% of {taka(c.paymentAmount)}) · {formatDate(c.createdAt)}
                </p>
                {c.rejectionReason ? <p className="text-[var(--color-muted)]">Reason: {c.rejectionReason}</p> : null}
              </div>
              <div className="text-right">
                {c.status === 'REJECTED' ? (
                  <StatusPill status="REJECTED" />
                ) : held ? (
                  <span className="inline-block rounded-full bg-[#fff6e0] px-2.5 py-0.5 text-xs font-semibold text-[#8a5a00]">
                    On hold until {formatDate(c.availableAt)}
                  </span>
                ) : (
                  <StatusPill status="APPROVED" />
                )}
                {held && rejecting !== c.id ? (
                  <div className="mt-2">
                    <Button variant="secondary" onClick={() => setRejecting(c.id)}>
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
            {rejecting === c.id ? (
              <ReasonForm
                label="Why is this commission rejected? (e.g. refunded, self-referral)"
                confirmLabel="Reject commission"
                onSubmit={(reason) => reject(c.id, reason)}
                onCancel={() => setRejecting(null)}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function SettingsTab() {
  const { pushToast } = useToast();
  const [settings, setSettings] = useState<AffiliateProgramSettings | null>(null);
  const [form, setForm] = useState<Record<'commissionRate' | 'cookieDays' | 'holdDays' | 'minPayout', string>>({
    commissionRate: '',
    cookieDays: '',
    holdDays: '',
    minPayout: '',
  });
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = (s: AffiliateProgramSettings) => {
    setSettings(s);
    setEnabled(s.enabled);
    setForm({
      commissionRate: String(s.commissionRate),
      cookieDays: String(s.cookieDays),
      holdDays: String(s.holdDays),
      minPayout: String(s.minPayout),
    });
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      apply((await api.get<{ success: true; data: AffiliateProgramSettings }>('/admin/affiliates/settings')).data);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load settings'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch<{ success: true; data: AffiliateProgramSettings }>('/admin/affiliates/settings', {
        enabled,
        commissionRate: Number(form.commissionRate),
        cookieDays: Number(form.cookieDays),
        holdDays: Number(form.holdDays),
        minPayout: Number(form.minPayout),
      });
      apply(res.data);
      pushToast('Affiliate settings saved.', 'success');
    } catch (err) {
      pushToast(humanApiError(err, 'Could not save the settings'), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!settings) return <LoadingState label="Loading settings" />;

  const fields: { key: keyof typeof form; label: string; hint: string }[] = [
    { key: 'commissionRate', label: 'Commission (%)', hint: 'Of a referred business’s first plan payment. Applies to new commissions.' },
    { key: 'cookieDays', label: 'Link remembered (days)', hint: 'How long after a click a sign-up still counts.' },
    { key: 'holdDays', label: 'Hold period (days)', hint: 'Time to catch refunds before a commission can be withdrawn.' },
    { key: 'minPayout', label: 'Minimum withdrawal (৳)', hint: 'Smallest amount an affiliate can withdraw.' },
  ];

  return (
    <form onSubmit={save} className="max-w-2xl space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="h-4 w-4" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Program open (new applications and new commissions)
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="font-medium">{f.label}</span>
            <input
              className={`mt-1 ${inputClass}`}
              inputMode="decimal"
              value={form[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
            <span className="mt-1 block text-xs text-[var(--color-muted)]">{f.hint}</span>
          </label>
        ))}
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </form>
  );
}
