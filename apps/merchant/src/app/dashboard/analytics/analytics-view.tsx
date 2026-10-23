'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { StoreAnalytics } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { BarChart, BarList } from '@/components/analytics/charts';
import { KpiCard } from '@/components/analytics/kpi-card';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import {
  RANGE_PRESETS,
  type RangePreset,
  formatCount,
  formatMoney,
  percentChange,
  presetRange,
  shiftDate,
  todayInZone,
  useStoreAnalytics,
} from '@/lib/analytics';
import { ApiError, apiDownload } from '@/lib/api-client';
import { useStoreContext } from '@/lib/store-context';

type Metric = 'revenue' | 'orders' | 'visitors';

const PAYMENT_LABELS: Record<string, string> = {
  COD: 'Cash on delivery',
  SSLCOMMERZ: 'SSLCommerz',
  STRIPE: 'Stripe',
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  OTHER: 'Bank transfer / other',
  TEST: 'Test payments',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const DEVICE_LABELS: Record<string, string> = { MOBILE: 'Mobile', TABLET: 'Tablet', DESKTOP: 'Desktop' };

export default function AnalyticsView() {
  const { selectedStore, loading: storesLoading } = useStoreContext();
  const timezone = selectedStore?.timezone ?? 'Asia/Dhaka';
  const [preset, setPreset] = useState<RangePreset>('30d');
  const today = todayInZone(timezone);
  const [custom, setCustom] = useState({ from: shiftDate(today, -29), to: today });
  const range = useMemo(
    () => (preset === 'custom' ? custom : presetRange(preset, timezone)),
    [preset, custom, timezone],
  );
  const { data, error, loading, reload } = useStoreAnalytics(selectedStore?.id ?? null, range);
  const full = data?.full ?? true;
  // A plan that locks long ranges can't keep a stale 90d/12m/custom choice: fall back to 30 days.
  useEffect(() => {
    const locked = (data && !data.full) || error?.upgrade;
    if (locked && RANGE_PRESETS.find((p) => p.value === preset)?.full) setPreset('30d');
  }, [data, error, preset]);

  if (storesLoading) return <LoadingState label="Loading analytics" />;
  if (!selectedStore) {
    return <p className="text-sm text-[var(--color-muted)]">Select a store to see its analytics.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            How {selectedStore.name} is selling and who is visiting. Days follow the store’s time zone ({timezone}).
          </p>
        </div>
        {data?.full ? <ExportButton storeId={selectedStore.id} range={range} /> : null}
      </div>

      <RangePicker
        preset={preset}
        full={full}
        custom={custom}
        today={today}
        onPreset={setPreset}
        onCustom={setCustom}
      />

      {error ? (
        error.upgrade ? (
          <UpgradeCard />
        ) : (
          <ErrorState title="Could not load analytics" message={error.message} onRetry={() => void reload()} />
        )
      ) : !data ? (
        <LoadingState label="Loading analytics" />
      ) : (
        <div className={`space-y-6 ${loading ? 'opacity-60 transition-opacity' : ''}`} aria-busy={loading}>
          <Report data={data} />
        </div>
      )}
    </div>
  );
}

function RangePicker({
  preset,
  full,
  custom,
  today,
  onPreset,
  onCustom,
}: {
  preset: RangePreset;
  full: boolean;
  custom: { from: string; to: string };
  today: string;
  onPreset: (preset: RangePreset) => void;
  onCustom: (range: { from: string; to: string }) => void;
}) {
  const [draft, setDraft] = useState(custom);
  const invalid = !draft.from || !draft.to || draft.from > draft.to || draft.to > today;
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Date range" className="flex flex-wrap gap-2">
        {RANGE_PRESETS.map((p) => {
          const locked = p.full && !full;
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={preset === p.value}
              disabled={locked}
              title={locked ? 'Growth and Business plans' : undefined}
              onClick={() => onPreset(p.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                preset === p.value
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[#e8eeeb]'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {p.label}
              {locked ? <span aria-hidden="true"> 🔒</span> : null}
            </button>
          );
        })}
      </div>
      {preset === 'custom' ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalid) onCustom(draft);
          }}
        >
          <label className="text-sm">
            <span className="block text-[var(--color-muted)]">From</span>
            <input
              type="date"
              value={draft.from}
              max={today}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-[var(--color-muted)]">To</span>
            <input
              type="date"
              value={draft.to}
              max={today}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
            />
          </label>
          <Button type="submit" variant="secondary" disabled={invalid}>
            Apply
          </Button>
          <span className="text-xs text-[var(--color-muted)]">Up to one year at a time.</span>
        </form>
      ) : null}
    </div>
  );
}

function ExportButton({ storeId, range }: { storeId: string; range: { from: string; to: string } | null }) {
  const { pushToast } = useToast();
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const query = range ? `?from=${range.from}&to=${range.to}` : '';
      const { blob, filename } = await apiDownload(`/stores/${storeId}/analytics/export${query}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename ?? 'analytics.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Could not download the report.', 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="secondary" disabled={busy} onClick={() => void download()}>
      {busy ? 'Preparing…' : 'Export CSV'}
    </Button>
  );
}

function UpgradeCard() {
  return (
    <Card title="Full analytics on Growth and Business">
      <div className="space-y-3 text-sm">
        <p className="text-[var(--color-muted)]">
          Your plan shows sales for the last 30 days. Upgrade to see visitors, conversion rate, best-selling products,
          where your traffic comes from, the shopping funnel, any date range and CSV export.
        </p>
        <Link
          href="/dashboard/billing"
          className="inline-flex rounded-md bg-[var(--color-accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--color-accent-hover)]"
        >
          See plans
        </Link>
      </div>
    </Card>
  );
}

function Report({ data }: { data: StoreAnalytics }) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const money = (v: number) => formatMoney(v, data.currency);
  const t = data.totals;
  const p = data.previous;
  const metrics: { value: Metric; label: string; format: (v: number) => string }[] = [
    { value: 'revenue', label: 'Sales', format: money },
    { value: 'orders', label: 'Orders', format: formatCount },
    ...(data.full ? [{ value: 'visitors' as const, label: 'Visitors', format: formatCount }] : []),
  ];
  const current = metrics.find((m) => m.value === metric) ?? metrics[0]!;
  const points = data.series.map((d) => ({ date: d.date, value: (d[current.value] as number | null) ?? 0 }));

  return (
    <>
      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Sales" value={money(t.revenue)} change={percentChange(t.revenue, p.revenue)} />
        <KpiCard label="Orders" value={formatCount(t.orders)} change={percentChange(t.orders, p.orders)} />
        <KpiCard label="Average order" value={money(t.averageOrder)} change={percentChange(t.averageOrder, p.averageOrder)} />
        <KpiCard label="Items sold" value={formatCount(t.itemsSold)} change={percentChange(t.itemsSold, p.itemsSold)} />
        <KpiCard
          label="Visitors"
          value={formatCount(t.visitors ?? 0)}
          change={percentChange(t.visitors, p.visitors)}
          locked={!data.full}
        />
        <KpiCard
          label="Conversion rate"
          value={`${t.conversionRate ?? 0}%`}
          hint="Orders per 100 visitors"
          locked={!data.full}
        />
      </section>

      <Card
        title="Over time"
        actions={
          <div role="radiogroup" aria-label="Chart" className="flex gap-1">
            {metrics.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={metric === m.value}
                onClick={() => setMetric(m.value)}
                className={`rounded-md px-2.5 py-1 text-sm ${
                  metric === m.value ? 'bg-[#e3f4ec] font-semibold text-[#13684a]' : 'text-[var(--color-muted)] hover:bg-[#e8eeeb]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      >
        <BarChart points={points} format={current.format} label={current.label} />
      </Card>

      {!data.full ? <UpgradeCard /> : null}

      {data.full ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Best-selling products">
              {data.topProducts && data.topProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-[var(--color-muted)]">
                      <tr>
                        <th scope="col" className="pb-2 font-medium">Product</th>
                        <th scope="col" className="pb-2 text-right font-medium">Sold</th>
                        <th scope="col" className="pb-2 text-right font-medium">Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {data.topProducts.map((row) => (
                        <tr key={`${row.productId ?? row.name}`}>
                          <td className="max-w-[16rem] truncate py-2 pr-3">
                            {row.productId ? (
                              <Link href={`/dashboard/products/${row.productId}`} className="hover:underline">
                                {row.name}
                              </Link>
                            ) : (
                              row.name
                            )}
                          </td>
                          <td className="py-2 text-right tabular-nums">{formatCount(row.quantity)}</td>
                          <td className="py-2 text-right tabular-nums">{money(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-muted)]">No sales in this period.</p>
              )}
            </Card>
            <Card title="Where visitors come from">
              <BarList
                rows={(data.sources ?? []).map((s) => ({ label: s.source, value: s.visitors }))}
                format={formatCount}
                empty="No visits recorded in this period yet."
              />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Shopping funnel" description="Visitors who reached each step">
              <Funnel funnel={data.funnel!} />
            </Card>
            <Card title="Devices">
              <BarList
                rows={(data.devices ?? []).map((d) => ({ label: DEVICE_LABELS[d.device] ?? d.device, value: d.visitors }))}
                format={formatCount}
                empty="No visits recorded yet."
              />
            </Card>
            <Card title="Most viewed pages">
              <BarList
                rows={(data.pages ?? []).map((pg) => ({ label: pg.path, value: pg.views }))}
                format={formatCount}
                empty="No page views yet."
              />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Payment methods">
              <BarList
                rows={(data.paymentMethods ?? []).map((m) => ({
                  label: PAYMENT_LABELS[m.provider] ?? m.provider,
                  value: m.orders,
                  hint: money(m.revenue),
                }))}
                format={(v) => `${formatCount(v)} orders`}
                empty="No sales in this period."
              />
            </Card>
            <Card title="Order status">
              <StatusList statuses={data.orderStatuses} />
            </Card>
            <Card title="Customers" description="People who bought in this period">
              <BarList
                rows={[
                  { label: 'New customers', value: data.customers?.new ?? 0 },
                  { label: 'Returning customers', value: data.customers?.returning ?? 0 },
                ]}
                format={formatCount}
                empty=""
              />
            </Card>
          </div>
        </>
      ) : (
        <Card title="Order status">
          <StatusList statuses={data.orderStatuses} />
        </Card>
      )}
    </>
  );
}

function StatusList({ statuses }: { statuses: StoreAnalytics['orderStatuses'] }) {
  return (
    <BarList
      rows={statuses.map((s) => ({ label: STATUS_LABELS[s.status] ?? s.status, value: s.orders }))}
      format={formatCount}
      empty="No orders in this period."
    />
  );
}

function Funnel({ funnel }: { funnel: NonNullable<StoreAnalytics['funnel']> }) {
  const steps = [
    { label: 'Visited the store', value: funnel.visitors },
    { label: 'Viewed a product', value: funnel.productViews },
    { label: 'Added to cart', value: funnel.addToCart },
    { label: 'Started checkout', value: funnel.checkout },
    { label: 'Orders placed', value: funnel.orders },
  ];
  const top = Math.max(1, funnel.visitors);
  return (
    <ol className="space-y-2.5">
      {steps.map((step) => {
        const pct = Math.min(100, Math.round((step.value / top) * 1000) / 10);
        return (
          <li key={step.label} className="text-sm">
            <div className="flex justify-between gap-2">
              <span>{step.label}</span>
              <span className="tabular-nums">
                <span className="font-semibold">{formatCount(step.value)}</span>
                <span className="ml-1.5 text-xs text-[var(--color-muted)]">{pct}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#e8eeeb]" aria-hidden="true">
              <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.max(pct, step.value ? 2 : 0)}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
