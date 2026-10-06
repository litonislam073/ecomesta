'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { OffsetPageMeta, SubscriptionPlan } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { buildQuery, formatDate, formatPlanMoney, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

function cyclePrice(plan: SubscriptionPlan, cycle: 'SEMI_ANNUAL' | 'YEARLY'): number | null {
  return plan.prices?.find((price) => price.billingCycle === cycle)?.amount ?? null;
}

export default function AdminPlansPage() {
  const [items, setItems] = useState<SubscriptionPlan[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        page,
        limit: 20,
        search: query || undefined,
        active: active || undefined,
      });
      const result = await api.get<{
        success: true;
        data: { items: SubscriptionPlan[]; meta: OffsetPageMeta };
      }>(`/admin/plans?${params}`);
      setItems(result.data.items);
      setMeta(result.data.meta);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load plans'));
    } finally {
      setLoading(false);
    }
  }, [page, query, active]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription plans"
        description="Pricing tiers available to tenants."
        actions={
          <Link href="/dashboard/plans/new">
            <Button>New plan</Button>
          </Link>
        }
      />

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <Input
          className="max-w-xs"
          placeholder="Search name or slug"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search plans"
        />
        <Select
          className="w-auto"
          value={active}
          onChange={(e) => {
            setPage(1);
            setActive(e.target.value);
          }}
          aria-label="Active filter"
        >
          <option value="">All plans</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {loading ? <LoadingState label="Loading plans" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No plans yet"
          description="Create a plan before assigning subscriptions to tenants."
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Monthly</th>
                <th className="px-4 py-3 font-medium">6 months</th>
                <th className="px-4 py-3 font-medium">Yearly</th>
                <th className="px-4 py-3 font-medium">Free trial</th>
                <th className="px-4 py-3 font-medium">Availability</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((plan) => (
                <tr
                  key={plan.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/plans/${plan.id}`}
                    >
                      {plan.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{plan.slug}</td>
                  <td className="px-4 py-3">{formatPlanMoney(plan.monthlyPrice)}</td>
                  <td className="px-4 py-3">{formatPlanMoney(cyclePrice(plan, 'SEMI_ANNUAL'))}</td>
                  <td className="px-4 py-3">{formatPlanMoney(cyclePrice(plan, 'YEARLY'))}</td>
                  <td className="px-4 py-3">{plan.trialMonths > 0 ? `${plan.trialMonths} months` : 'None'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={plan.active ? 'success' : 'neutral'}>
                      {plan.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {formatDate(plan.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {meta ? (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
