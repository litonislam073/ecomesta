'use client';

import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { AdminAuditLog, OffsetPageMeta } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { EntitySearchSelect, isUuid } from '@/components/ui/entity-search-select';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { AUDIT_ACTIONS } from '@/lib/audit-actions';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import {
  buildQuery,
  formatDateTime,
  humanApiError,
  redactMetadata,
} from '@/lib/admin-utils';
import { api } from '@/lib/api-client';
import { useListRequest } from '@/lib/list-request';

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
  const { begin } = useListRequest();

  const load = useCallback(async () => {
    const req = begin();
    setLoading(true);
    setError(null);
    setItems([]);
    setMeta(null);
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
      if (!req.isCurrent()) return;
      setItems(result.data.items);
      setMeta(result.data.meta);
    } catch (err) {
      if (!req.isCurrent()) return;
      setError(humanApiError(err, 'Failed to load audit logs'));
    } finally {
      if (req.isCurrent()) setLoading(false);
    }
  }, [begin, page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (filters.from && filters.to && new Date(filters.to) < new Date(filters.from)) {
      setError('The From date must be on or before the To date.');
      return;
    }
    for (const [label, value] of [
      ['Tenant', filters.tenantId],
      ['Store', filters.storeId],
      ['Actor', filters.userId],
    ] as const) {
      if (value && !isUuid(value)) {
        setError(`${label} must be chosen from the search results (a full UUID).`);
        return;
      }
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
          <Select
            id="audit-action"
            value={filters.action}
            onChange={(e) => update('action', e.target.value)}
          >
            <option value="">Any action</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </Select>
        </label>
        <EntitySearchSelect
          kind="tenant"
          label="Tenant"
          value={filters.tenantId}
          onChange={(id) => update('tenantId', id)}
          help="Search by name or slug. Leave empty for all tenants."
        />
        <EntitySearchSelect
          kind="store"
          label="Store"
          value={filters.storeId}
          onChange={(id) => update('storeId', id)}
          help="Search by name or slug. Leave empty for all stores."
        />
        <EntitySearchSelect
          kind="user"
          label="Actor"
          value={filters.userId}
          onChange={(id) => update('userId', id)}
          help="Search by email. Leave empty for any actor."
        />
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
          <table className="min-w-[44rem] w-full text-left text-sm">
            <thead className="sticky top-14 z-10 border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)] shadow-[0_1px_0_0_var(--color-border)]">
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

      {!loading && meta ? (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
