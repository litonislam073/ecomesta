'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { BarChart } from '@/components/analytics/charts';
import { KpiCard } from '@/components/analytics/kpi-card';
import { Card } from '@/components/ui/card';
import { formatCount, formatMoney, percentChange, presetRange, useStoreAnalytics } from '@/lib/analytics';

/** Today and the last 7 days at a glance, on the dashboard home. */
export function DashboardSummary({ storeId, timezone }: { storeId: string; timezone: string }) {
  const range = useMemo(() => presetRange('7d', timezone), [timezone]);
  const { data, error } = useStoreAnalytics(storeId, range);

  if (error) {
    return (
      <Card title="Sales overview">
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          Could not load sales numbers. {error.message}
        </p>
      </Card>
    );
  }

  const money = (v: number) => formatMoney(v, data?.currency ?? 'BDT');
  const today = data?.series.at(-1);
  const yesterday = data?.series.at(-2);

  return (
    <section aria-labelledby="overview-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="overview-heading" className="text-lg font-semibold">
          Sales overview
        </h2>
        <Link href="/dashboard/analytics" className="text-sm font-semibold text-[var(--color-accent)] hover:underline">
          View analytics →
        </Link>
      </div>
      {!data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Today’s sales"
              value={money(today?.revenue ?? 0)}
              hint={`${formatCount(today?.orders ?? 0)} orders · yesterday ${money(yesterday?.revenue ?? 0)}`}
            />
            <KpiCard
              label="Sales, last 7 days"
              value={money(data.totals.revenue)}
              change={percentChange(data.totals.revenue, data.previous.revenue)}
            />
            <KpiCard
              label="Orders, last 7 days"
              value={formatCount(data.totals.orders)}
              change={percentChange(data.totals.orders, data.previous.orders)}
            />
            <KpiCard
              label="Visitors, last 7 days"
              value={formatCount(data.totals.visitors ?? 0)}
              change={percentChange(data.totals.visitors, data.previous.visitors)}
              locked={!data.full}
            />
          </div>
          <Card title="Sales, last 7 days">
            <BarChart points={data.series.map((d) => ({ date: d.date, value: d.revenue }))} format={money} label="Sales" />
          </Card>
        </>
      )}
    </section>
  );
}
