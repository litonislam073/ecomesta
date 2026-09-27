'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AdminStats } from '@ecomesta/types';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { formatDateTime, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

function Metric({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
        {value}
      </p>
      {hint ? <p className="mt-1 text-sm text-[var(--color-muted)]">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block focus-visible:outline focus-visible:outline-2">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: AdminStats }>(
        '/admin/stats',
      );
      setStats(result.data);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load platform stats'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Live counters across every tenant, store and subscription."
      />

      {loading ? <LoadingState label="Loading platform stats" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Metric
              label="Users"
              value={String(stats.users.total)}
              hint={`${stats.users.active} active`}
              href="/dashboard/users"
            />
            <Metric
              label="Tenants"
              value={String(stats.tenants.total)}
              hint={`${stats.tenants.active} active`}
              href="/dashboard/tenants"
            />
            <Metric
              label="Stores"
              value={String(stats.stores.total)}
              hint={`${stats.stores.active} active`}
              href="/dashboard/stores"
            />
            <Metric
              label="Subscriptions"
              value={String(stats.subscriptions.total)}
              hint={`${stats.subscriptions.active} active`}
              href="/dashboard/subscriptions"
            />
            <Metric label="Orders" value={String(stats.orders.total)} />
            <Metric
              label="Order revenue"
              value={stats.orderRevenueSum}
              hint="Excludes cancelled orders"
            />
          </div>

          <Card
            title="Recent activity"
            description="Audit entries recorded in the last 24 hours."
            actions={
              <Link
                href="/dashboard/audit-logs"
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                View audit logs
              </Link>
            }
          >
            <p className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
              {stats.recentAuditCount}
            </p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Generated {formatDateTime(stats.generatedAt)}
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
