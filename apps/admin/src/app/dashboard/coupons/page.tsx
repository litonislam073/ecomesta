'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AdminBillingCoupon, BillingCouponType, BillingCycle, PublicPlan } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

const CYCLES: { value: BillingCycle; label: string }[] = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'SEMI_ANNUAL', label: '6 months' },
  { value: 'YEARLY', label: 'Yearly' },
];

function taka(amount: number) {
  return `৳${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
}

function discountLabel(coupon: Pick<AdminBillingCoupon, 'type' | 'value'>) {
  return coupon.type === 'PERCENTAGE' ? `${coupon.value}% off` : `${taka(coupon.value)} off`;
}

type Form = {
  code: string;
  description: string;
  type: BillingCouponType;
  value: string;
  planSlugs: string[];
  billingCycles: BillingCycle[];
  maxRedemptions: string;
  maxPerTenant: string;
  startsAt: string;
  endsAt: string;
};

const EMPTY: Form = {
  code: '',
  description: '',
  type: 'PERCENTAGE',
  value: '',
  planSlugs: [],
  billingCycles: [],
  maxRedemptions: '',
  maxPerTenant: '1',
  startsAt: '',
  endsAt: '',
};

/** `datetime-local` value → ISO, or undefined when empty. */
function iso(local: string): string | undefined {
  return local ? new Date(local).toISOString() : undefined;
}

function CreateCoupon({ plans, onCreated }: { plans: PublicPlan[]; onCreated: (coupon: AdminBillingCoupon) => void }) {
  const { pushToast } = useToast();
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = <T extends string>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) return setError('Code: 3–32 letters, numbers, dashes or underscores.');
    const value = Number(form.value);
    if (form.type === 'PERCENTAGE' && !(Number.isInteger(value) && value >= 1 && value <= 99)) {
      return setError('Percentage must be a whole number from 1 to 99.');
    }
    if (form.type === 'FIXED_AMOUNT' && !(Number.isInteger(value) && value >= 1)) return setError('Amount must be at least ৳1, in whole taka.');
    setBusy(true);
    try {
      const res = await api.post<{ success: true; data: AdminBillingCoupon }>('/admin/billing-coupons', {
        code,
        type: form.type,
        value,
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        planSlugs: form.planSlugs,
        billingCycles: form.billingCycles,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
        maxPerTenant: form.maxPerTenant ? Number(form.maxPerTenant) : null,
        ...(iso(form.startsAt) ? { startsAt: iso(form.startsAt) } : {}),
        ...(iso(form.endsAt) ? { endsAt: iso(form.endsAt) } : {}),
      });
      onCreated(res.data);
      setForm(EMPTY);
      pushToast(`Coupon ${res.data.code} created.`, 'success');
    } catch (err) {
      setError(humanApiError(err, 'Could not create the coupon'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      aria-labelledby="new-coupon"
      className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <div>
        <h2 id="new-coupon" className="text-lg font-semibold">
          New coupon
        </h2>
        <p className="text-sm text-[var(--color-muted)]">
          Merchants enter the code when they pay for a plan (on Plan &amp; billing or at sign-up) and pay the lower amount.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <label className="space-y-1 text-sm md:col-span-1">
          <span className="font-medium">Code</span>
          <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="EID25" maxLength={32} className="font-mono uppercase" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Discount type</span>
          <Select value={form.type} onChange={(e) => set('type', e.target.value as BillingCouponType)}>
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="FIXED_AMOUNT">Fixed amount (৳)</option>
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{form.type === 'PERCENTAGE' ? 'Percent off' : 'Taka off'}</span>
          <Input inputMode="numeric" value={form.value} onChange={(e) => set('value', e.target.value)} placeholder={form.type === 'PERCENTAGE' ? '25' : '100'} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Note (optional)</span>
          <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Eid offer" maxLength={200} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-1.5 text-sm">
          <legend className="font-medium">Plans</legend>
          <p className="text-xs text-[var(--color-muted)]">None ticked = every plan.</p>
          <div className="flex flex-wrap gap-3">
            {plans.map((plan) => (
              <label key={plan.slug} className="flex items-center gap-1.5">
                <input type="checkbox" checked={form.planSlugs.includes(plan.slug)} onChange={() => set('planSlugs', toggle(form.planSlugs, plan.slug))} />
                {plan.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-1.5 text-sm">
          <legend className="font-medium">Billing periods</legend>
          <p className="text-xs text-[var(--color-muted)]">None ticked = every period.</p>
          <div className="flex flex-wrap gap-3">
            {CYCLES.map((cycle) => (
              <label key={cycle.value} className="flex items-center gap-1.5">
                <input type="checkbox" checked={form.billingCycles.includes(cycle.value)} onChange={() => set('billingCycles', toggle(form.billingCycles, cycle.value))} />
                {cycle.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Total uses</span>
          <Input inputMode="numeric" value={form.maxRedemptions} onChange={(e) => set('maxRedemptions', e.target.value)} placeholder="Unlimited" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Uses per business</span>
          <Input inputMode="numeric" value={form.maxPerTenant} onChange={(e) => set('maxPerTenant', e.target.value)} placeholder="Unlimited" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Starts (optional)</span>
          <Input type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Ends (optional)</span>
          <Input type="datetime-local" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? 'Creating…' : 'Create coupon'}
      </Button>
    </form>
  );
}

function scopeLabel(coupon: AdminBillingCoupon, plans: PublicPlan[]) {
  const planNames = coupon.planSlugs.length ? coupon.planSlugs.map((slug) => plans.find((p) => p.slug === slug)?.name ?? slug).join(', ') : 'All plans';
  const periods = coupon.billingCycles.length ? coupon.billingCycles.map((c) => CYCLES.find((x) => x.value === c)?.label ?? c).join(', ') : 'any period';
  return `${planNames} · ${periods}`;
}

function validity(coupon: AdminBillingCoupon) {
  const now = Date.now();
  if (!coupon.active) return { label: 'Off', style: 'bg-[#f1f4f7] text-[var(--color-muted)]' };
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() <= now) return { label: 'Expired', style: 'bg-[#fdeee8] text-[#a3441f]' };
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return { label: 'Scheduled', style: 'bg-[#fff6e0] text-[#8a5a00]' };
  if (coupon.maxRedemptions !== null && coupon.usedCount >= coupon.maxRedemptions) return { label: 'Used up', style: 'bg-[#fff6e0] text-[#8a5a00]' };
  return { label: 'Active', style: 'bg-[#e3f1ec] text-[#1b6b53]' };
}

export default function CouponsPage() {
  const { pushToast } = useToast();
  const [coupons, setCoupons] = useState<AdminBillingCoupon[]>([]);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, planList] = await Promise.all([
        api.get<{ success: true; data: AdminBillingCoupon[] }>('/admin/billing-coupons'),
        api.get<{ success: true; data: PublicPlan[] }>('/public/plans'),
      ]);
      setCoupons(list.data);
      setPlans(planList.data);
    } catch (err) {
      setError(humanApiError(err, 'Could not load coupons'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setActive(coupon: AdminBillingCoupon, active: boolean) {
    setBusyId(coupon.id);
    try {
      const res = await api.patch<{ success: true; data: AdminBillingCoupon }>(`/admin/billing-coupons/${coupon.id}`, { active });
      setCoupons((list) => list.map((item) => (item.id === coupon.id ? res.data : item)));
      pushToast(active ? `${coupon.code} is on again.` : `${coupon.code} is turned off.`, 'success');
    } catch (err) {
      pushToast(humanApiError(err, 'Could not change the coupon'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Coupons" description="Discount codes merchants can use when they pay for an Ecomesta plan." />
      {loading ? <LoadingState label="Loading coupons" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error ? (
        <>
          <CreateCoupon plans={plans} onCreated={(coupon) => setCoupons((list) => [coupon, ...list])} />
          {coupons.length === 0 ? (
            <EmptyState title="No coupons yet" description="Create one above to give merchants a discount on their plan." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Discount</th>
                    <th className="px-4 py-3">Applies to</th>
                    <th className="px-4 py-3">Used</th>
                    <th className="px-4 py-3">Valid</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => {
                    const state = validity(coupon);
                    return (
                      <tr key={coupon.id} className="border-b border-[var(--color-border)] last:border-b-0">
                        <td className="px-4 py-3">
                          <p className="font-mono font-semibold">{coupon.code}</p>
                          {coupon.description ? <p className="text-xs text-[var(--color-muted)]">{coupon.description}</p> : null}
                        </td>
                        <td className="px-4 py-3 font-medium">{discountLabel(coupon)}</td>
                        <td className="px-4 py-3">{scopeLabel(coupon, plans)}</td>
                        <td className="px-4 py-3">
                          {coupon.usedCount}
                          {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ''}
                          {coupon.pendingCount ? <span className="text-xs text-[var(--color-muted)]"> ({coupon.pendingCount} under review)</span> : null}
                          <p className="text-xs text-[var(--color-muted)]">
                            {coupon.maxPerTenant !== null ? `${coupon.maxPerTenant} per business` : 'no per-business limit'}
                            {coupon.approvedDiscountTotal ? ` · ${taka(coupon.approvedDiscountTotal)} given` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {coupon.startsAt ? <p>From {formatDateTime(coupon.startsAt)}</p> : null}
                          {coupon.endsAt ? <p>Until {formatDateTime(coupon.endsAt)}</p> : null}
                          {!coupon.startsAt && !coupon.endsAt ? <p className="text-[var(--color-muted)]">No end date</p> : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${state.style}`}>{state.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busyId === coupon.id}
                            onClick={() => void setActive(coupon, !coupon.active)}
                          >
                            {coupon.active ? 'Turn off' : 'Turn on'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
