'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type {
  AffiliateCommissionItem,
  AffiliateMe,
  AffiliatePayoutItem,
  AffiliateReferralItem,
  ManualPaymentMethod,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { Field, SettingsHeader, textareaClass } from '@/components/settings/settings-ui';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';

const METHODS: { value: ManualPaymentMethod; label: string }[] = [
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
  { value: 'ROCKET', label: 'Rocket' },
  { value: 'UPAY', label: 'Upay' },
];
const METHOD_LABEL = Object.fromEntries(METHODS.map((m) => [m.value, m.label])) as Record<string, string>;

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function taka(amount: number): string {
  return `৳${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(amount)}`;
}

function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

interface Lists {
  referrals: AffiliateReferralItem[];
  commissions: AffiliateCommissionItem[];
  payouts: AffiliatePayoutItem[];
}

export default function AffiliateView() {
  const [me, setMe] = useState<AffiliateMe | null>(null);
  const [lists, setLists] = useState<Lists | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await api.get<{ success: true; data: AffiliateMe }>('/affiliate/me');
      setMe(res.data);
      if (res.data.affiliate && res.data.affiliate.status !== 'PENDING') {
        const [referrals, commissions, payouts] = await Promise.all([
          api.get<{ data: { items: AffiliateReferralItem[] } }>('/affiliate/referrals'),
          api.get<{ data: { items: AffiliateCommissionItem[] } }>('/affiliate/commissions'),
          api.get<{ data: { items: AffiliatePayoutItem[] } }>('/affiliate/payouts'),
        ]);
        setLists({ referrals: referrals.data.items, commissions: commissions.data.items, payouts: payouts.data.items });
      } else {
        setLists(null);
      }
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SettingsHeader
        title="Affiliate program"
        description="Refer businesses to Ecomesta and earn a commission when they pay for their first plan."
      />
      {loadError ? (
        <ErrorState title="Could not load the affiliate program" message="Check your connection and try again." onRetry={() => void load()} />
      ) : !me ? (
        <LoadingState label="Loading affiliate program" />
      ) : !me.affiliate || me.affiliate.status === 'REJECTED' ? (
        <ApplyCard me={me} onApplied={setMe} />
      ) : me.affiliate.status === 'PENDING' ? (
        <Card title="Application received">
          <div role="status" className="space-y-2 text-sm">
            <Badge tone="warning">Waiting for review</Badge>
            <p>
              Thanks for applying. The Ecomesta team reviews applications and you will get an email with your referral link
              once you are approved.
            </p>
          </div>
        </Card>
      ) : (
        <AffiliateDashboard me={me} lists={lists} onChange={load} />
      )}
    </div>
  );
}

function ProgramTerms({ me }: { me: AffiliateMe }) {
  const p = me.program;
  const items = [
    { label: 'Commission', value: `${me.affiliate?.commissionRate ?? p.commissionRate}%`, hint: 'of the first plan payment' },
    { label: 'Link remembered', value: `${p.cookieDays} days`, hint: 'after someone clicks your link' },
    { label: 'Hold period', value: `${p.holdDays} days`, hint: 'before a commission can be withdrawn' },
    { label: 'Minimum withdrawal', value: taka(p.minPayout), hint: 'to bKash, Nagad, Rocket or Upay' },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-[var(--color-border)] p-3">
          <dt className="text-xs text-[var(--color-muted)]">{item.label}</dt>
          <dd className="mt-1 text-lg font-semibold">{item.value}</dd>
          <dd className="text-xs text-[var(--color-muted)]">{item.hint}</dd>
        </div>
      ))}
    </dl>
  );
}

function ApplyCard({ me, onApplied }: { me: AffiliateMe; onApplied: (me: AffiliateMe) => void }) {
  const [note, setNote] = useState(me.affiliate?.applicationNote ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const rejected = me.affiliate?.status === 'REJECTED';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ success: true; data: AffiliateMe }>('/affiliate/apply', {
        applicationNote: note.trim() || undefined,
      });
      onApplied(res.data);
    } catch (err) {
      setError(errorText(err, 'Could not send your application. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!me.program.enabled) {
    return (
      <Card title="Join the affiliate program">
        <p className="text-sm text-[var(--color-muted)]">The affiliate program is not taking applications right now.</p>
      </Card>
    );
  }

  return (
    <Card title="Join the affiliate program" description="No store needed. Share your link — you earn when a business you refer pays.">
      <div className="space-y-5">
        <ProgramTerms me={me} />
        {rejected ? (
          <p role="status" className="rounded-md bg-[#fde8e6] p-3 text-sm text-[var(--color-danger)]">
            Your last application was not approved{me.affiliate?.statusReason ? `: ${me.affiliate.statusReason}` : '.'} You
            can apply again.
          </p>
        ) : null}
        <form className="space-y-4" onSubmit={onSubmit} noValidate aria-busy={submitting}>
          <Field
            id="affiliate-note"
            label="How will you promote Ecomesta? (optional)"
            hint="For example your Facebook page, YouTube channel or business community."
            counter={`${note.length}/1000`}
          >
            <textarea
              id="affiliate-note"
              rows={4}
              className={textareaClass}
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Sending...' : rejected ? 'Apply again' : 'Apply now'}
          </Button>
        </form>
      </div>
    </Card>
  );
}

function AffiliateDashboard({ me, lists, onChange }: { me: AffiliateMe; lists: Lists | null; onChange: () => Promise<void> }) {
  const affiliate = me.affiliate!;
  const balance = me.balance!;
  const stats = me.stats!;
  const { pushToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const openPayout = lists?.payouts.find((p) => p.status === 'REQUESTED');
  const canWithdraw =
    affiliate.status === 'ACTIVE' &&
    !!affiliate.payoutNumber &&
    !openPayout &&
    balance.available > 0 &&
    balance.available >= me.program.minPayout;

  async function copyLink() {
    if (!me.referralUrl) return;
    try {
      await navigator.clipboard.writeText(me.referralUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      pushToast('Could not copy. Select the link and copy it.', 'error');
    }
  }

  async function withdraw() {
    if (withdrawing) return;
    setWithdrawError(null);
    setWithdrawing(true);
    try {
      await api.post('/affiliate/payouts', {});
      pushToast('Withdrawal requested. We will send it to your wallet soon.', 'success');
      await onChange();
    } catch (err) {
      setWithdrawError(errorText(err, 'Could not request the withdrawal. Please try again.'));
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="space-y-6">
      {affiliate.status === 'SUSPENDED' ? (
        <p role="alert" className="rounded-md bg-[#fde8e6] p-3 text-sm text-[var(--color-danger)]">
          Your affiliate account is paused{affiliate.statusReason ? `: ${affiliate.statusReason}` : '.'} Your link does not
          earn new commissions. Contact support if you think this is a mistake.
        </p>
      ) : null}

      {me.referralUrl ? (
        <Card title="Your referral link" description="Anyone who signs up within the link's window counts as your referral.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input aria-label="Referral link" readOnly value={me.referralUrl} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="secondary" className="shrink-0" onClick={() => void copyLink()}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Code <span className="font-mono font-semibold text-[var(--color-ink)]">{affiliate.code}</span> · You earn{' '}
            {affiliate.commissionRate}% of each referred business&apos;s first plan payment.
          </p>
        </Card>
      ) : null}

      <section aria-label="Earnings" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Available to withdraw" value={taka(balance.available)} strong />
        <Stat label="On hold" value={taka(balance.onHold)} hint={`Released after ${me.program.holdDays} days`} />
        <Stat label="Withdrawal requested" value={taka(balance.requested)} />
        <Stat label="Paid to you" value={taka(balance.paid)} />
      </section>

      <section aria-label="Referral stats" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Link clicks" value={String(stats.clicks)} />
        <Stat label="Sign-ups" value={String(stats.signups)} />
        <Stat label="Businesses created" value={String(stats.businesses)} />
        <Stat label="Paying customers" value={String(stats.paidCustomers)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <PayoutMethodCard me={me} onSaved={onChange} />
        <Card title="Withdraw">
          <div className="space-y-3 text-sm">
            {openPayout ? (
              <p role="status">
                Your withdrawal of <strong>{taka(openPayout.amount)}</strong> to {METHOD_LABEL[openPayout.method]}{' '}
                {openPayout.number} is waiting to be paid.
              </p>
            ) : !affiliate.payoutNumber ? (
              <p className="text-[var(--color-muted)]">Add your wallet number to withdraw.</p>
            ) : balance.available < me.program.minPayout || balance.available <= 0 ? (
              <p className="text-[var(--color-muted)]">
                You can withdraw once you have at least {taka(me.program.minPayout)} available. Available now:{' '}
                {taka(balance.available)}.
              </p>
            ) : (
              <p>
                Withdraw <strong>{taka(balance.available)}</strong> to {METHOD_LABEL[affiliate.payoutMethod ?? ''] ?? ''}{' '}
                {affiliate.payoutNumber}.
              </p>
            )}
            {withdrawError ? (
              <p role="alert" className="text-[var(--color-danger)]">
                {withdrawError}
              </p>
            ) : null}
            <Button disabled={!canWithdraw || withdrawing} onClick={() => void withdraw()}>
              {withdrawing ? 'Requesting...' : 'Withdraw'}
            </Button>
          </div>
        </Card>
      </div>

      {!lists ? <LoadingState label="Loading referrals" /> : <Histories lists={lists} />}
    </div>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${strong ? 'border-[var(--color-accent)] bg-[var(--color-surface)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${strong ? 'text-[var(--color-accent)]' : ''}`}>{value}</p>
      {hint ? <p className="text-xs text-[var(--color-muted)]">{hint}</p> : null}
    </div>
  );
}

function PayoutMethodCard({ me, onSaved }: { me: AffiliateMe; onSaved: () => Promise<void> }) {
  const affiliate = me.affiliate!;
  const { pushToast } = useToast();
  const [method, setMethod] = useState<ManualPaymentMethod>(affiliate.payoutMethod ?? 'BKASH');
  const [number, setNumber] = useState(affiliate.payoutNumber ?? '');
  const [name, setName] = useState(affiliate.payoutName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const clean = number.replace(/[\s-]/g, '').replace(/^\+?88/, '');
    if (!/^01[3-9]\d{8}$/.test(clean)) {
      setError('Enter an 11-digit mobile number, e.g. 01712345678.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.put('/affiliate/payout-method', { method, number: clean, name: name.trim() || undefined });
      pushToast('Payout number saved.', 'success');
      await onSaved();
    } catch (err) {
      setError(errorText(err, 'Could not save. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Where we send your money">
      <form className="space-y-3" onSubmit={onSubmit} noValidate aria-busy={saving}>
        <Field id="payout-method" label="Wallet">
          <Select id="payout-method" value={method} onChange={(e) => setMethod(e.target.value as ManualPaymentMethod)}>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="payout-number" label="Wallet number" error={error}>
          <Input
            id="payout-number"
            inputMode="tel"
            placeholder="01712345678"
            value={number}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setNumber(e.target.value)}
          />
        </Field>
        <Field id="payout-name" label="Account name (optional)">
          <Input id="payout-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </form>
    </Card>
  );
}

const REFERRAL_STATUS: Record<AffiliateReferralItem['status'], { label: string; tone: 'neutral' | 'warning' | 'success' }> = {
  SIGNED_UP: { label: 'Signed up', tone: 'neutral' },
  BUSINESS_CREATED: { label: 'Business created', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
};

function Histories({ lists }: { lists: Lists }) {
  const now = Date.now();
  return (
    <div className="space-y-6">
      <Card title="Referrals" description="People who signed up through your link.">
        {lists.referrals.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No referrals yet. Share your link to get started.</p>
        ) : (
          <Table head={['Business', 'Signed up', 'Status', 'Commission']}>
            {lists.referrals.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-3">{r.business ?? <span className="text-[var(--color-muted)]">Not set up yet</span>}</td>
                <td className="py-2 pr-3">{formatDate(r.signedUpAt)}</td>
                <td className="py-2 pr-3">
                  <Badge tone={REFERRAL_STATUS[r.status].tone}>{REFERRAL_STATUS[r.status].label}</Badge>
                </td>
                <td className="py-2 tabular-nums">{r.commission == null ? '—' : taka(r.commission)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Commissions">
        {lists.commissions.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No commissions yet.</p>
        ) : (
          <Table head={['Business', 'Payment', 'Commission', 'Status', 'Date']}>
            {lists.commissions.map((c) => {
              const held = c.status === 'APPROVED' && new Date(c.availableAt).getTime() > now;
              return (
                <tr key={c.id}>
                  <td className="py-2 pr-3">{c.business ?? '—'}</td>
                  <td className="py-2 pr-3 tabular-nums">{taka(c.paymentAmount)}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {taka(c.amount)} <span className="text-xs text-[var(--color-muted)]">({c.rate}%)</span>
                  </td>
                  <td className="py-2 pr-3">
                    {c.status === 'REJECTED' ? (
                      <Badge tone="danger">Rejected</Badge>
                    ) : held ? (
                      <Badge tone="warning">On hold until {formatDate(c.availableAt)}</Badge>
                    ) : (
                      <Badge tone="success">Available</Badge>
                    )}
                    {c.rejectionReason ? <p className="text-xs text-[var(--color-muted)]">{c.rejectionReason}</p> : null}
                  </td>
                  <td className="py-2">{formatDate(c.createdAt)}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Card title="Withdrawals">
        {lists.payouts.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No withdrawals yet.</p>
        ) : (
          <Table head={['Amount', 'Sent to', 'Status', 'Requested']}>
            {lists.payouts.map((p) => (
              <tr key={p.id}>
                <td className="py-2 pr-3 tabular-nums">{taka(p.amount)}</td>
                <td className="py-2 pr-3">
                  {METHOD_LABEL[p.method]} {p.number}
                </td>
                <td className="py-2 pr-3">
                  {p.status === 'PAID' ? (
                    <Badge tone="success">Paid{p.transactionId ? ` · ${p.transactionId}` : ''}</Badge>
                  ) : p.status === 'REJECTED' ? (
                    <Badge tone="danger">Not paid</Badge>
                  ) : (
                    <Badge tone="warning">Waiting</Badge>
                  )}
                  {p.rejectionReason ? <p className="text-xs text-[var(--color-muted)]">{p.rejectionReason}</p> : null}
                </td>
                <td className="py-2">{formatDate(p.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs text-[var(--color-muted)]">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="pb-2 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">{children}</tbody>
      </table>
    </div>
  );
}
