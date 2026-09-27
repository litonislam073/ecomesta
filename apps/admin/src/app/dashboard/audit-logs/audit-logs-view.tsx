'use client';

import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { AdminAuditLog, OffsetPageMeta } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import {
  buildQuery,
  formatDateTime,
  humanApiError,
  redactMetadata,
} from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

interface AuditFilters {
  action: string;
  tenantId: string;
  storeId: string;
  userId: string;
  from: string;
  to: string;
}

export default function AuditLogsView() {
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<AuditFilters>(() => ({
    action: searchParams.get('action') ?? '',
    tenantId: searchParams.get('tenantId') ?? '',
    storeId: searchParams.get('storeId') ?? '',
    userId: searchParams.get('userId') ?? '',
    from: '',
    to: '',
  }));
  const [applied, setApplied] = useState<AuditFilters>(filters);
  const [items, setItems] = useState<AdminAuditLog[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        page,
        limit: 20,
        action: applied.action || undefined,
        tenantId: applied.tenantId || undefined,
        storeId: applied.storeId || undefined,
        userId: applied.userId || undefined,
        from: applied.from ? new Date(applied.from).toISOString() : undefined,
        to: applied.to ? new Date(applied.to).toISOString() : undefined,
      });
      const result = await api.get<{
        success: true;
        data: { items: AdminAuditLog[]; meta: OffsetPageMeta };
      }>(`/admin/audit-logs?${params}`);
      setItems(result.data.items);
      setMeta(result.data.meta);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load audit logs'));
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (filters.from && filters.to && new Date(filters.to) < new Date(filters.from)) {
      setError('The "to" date must be after the "from" date.');
      return;
    }
    setPage(1);
    setApplied({
      action: filters.action.trim(),
      tenantId: filters.tenantId.trim(),
      storeId: filters.storeId.trim(),
      userId: filters.userId.trim(),
      from: filters.from,
      to: filters.to,
    });
  }

  function update(key: keyof AuditFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit logs"
        description="Immutable record of every privileged platform action."
      />

      <form
        className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={onSubmit}
      >
        <label className="block space-y-1.5" htmlFor="audit-action">
          <span className="text-sm font-medium">Action</span>
          <Input
            id="audit-action"
            placeholder="TENANT_SUSPENDED"
            value={filters.action}
            onChange={(e) => update('action', e.target.value)}
          />
        </label>
        <label className="block space-y-1.5" htmlFor="audit-tenant">
          <span className="text-sm font-medium">Tenant ID</span>
          <Input
            id="audit-tenant"
            value={filters.tenantId}
            onChange={(e) => update('tenantId', e.target.value)}
          />
        </label>
        <label className="block space-y-1.5" htmlFor="audit-store">
          <span className="text-sm font-medium">Store ID</span>
          <Input
            id="audit-store"
            value={filters.storeId}
            onChange={(e) => update('storeId', e.target.value)}
          />
        </label>
        <label className="block space-y-1.5" htmlFor="audit-user">
          <span className="text-sm font-medium">Actor user ID</span>
          <Input
            id="audit-user"
            value={filters.userId}
            onChange={(e) => update('userId', e.target.value)}
          />
        </label>
        <label className="block space-y-1.5" htmlFor="audit-from">
          <span className="text-sm font-medium">From</span>
          <Input
            id="audit-from"
            type="date"
            value={filters.from}
            onChange={(e) => update('from', e.target.value)}
          />
        </label>
        <label className="block space-y-1.5" htmlFor="audit-to">
          <span className="text-sm font-medium">To</span>
          <Input
            id="audit-to"
            type="date"
            value={filters.to}
            onChange={(e) => update('to', e.target.value)}
          />
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
        </div>
      </form>

      {loading ? <LoadingState label="Loading audit logs" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No audit entries"
          description="Nothing matched these filters. Try widening the date range."
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--color-muted)]">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium">{entry.action}</td>
                  <td className="px-4 py-3">
                    {entry.entityType}
                    {entry.entityId ? (
                      <p className="text-xs text-[var(--color-muted)]">{entry.entityId}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{entry.user?.email ?? 'system'}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {redactMetadata(entry.metadata)}
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
