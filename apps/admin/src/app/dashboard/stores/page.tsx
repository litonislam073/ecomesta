'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type {
  AdminStoreListItem,
  OffsetPageMeta,
  StoreStatus,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { buildQuery, formatDate, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

const STORE_STATUSES: StoreStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DRAFT'];

export default function AdminStoresPage() {
  const [items, setItems] = useState<AdminStoreListItem[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
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
        status: status || undefined,
      });
      const result = await api.get<{
        success: true;
        data: { items: AdminStoreListItem[]; meta: OffsetPageMeta };
      }>(`/admin/stores?${params}`);
      setItems(result.data.items);
      setMeta(result.data.meta);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load stores'));
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stores"
        description="Every storefront across all tenants."
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
          aria-label="Search stores"
        />
        <Select
          className="w-auto"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          {STORE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {loading ? <LoadingState label="Loading stores" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No stores found"
          description="Adjust the search or filters to widen the results."
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Currency</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((store) => (
                <tr
                  key={store.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/stores/${store.id}`}
                    >
                      {store.name}
                    </Link>
                    <p className="text-xs text-[var(--color-muted)]">{store.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/tenants/${store.tenant.id}`}
                    >
                      {store.tenant.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{store.currency}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={store.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {formatDate(store.createdAt)}
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
