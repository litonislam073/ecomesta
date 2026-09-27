'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { OffsetPageMeta, PaymentListItem, PaymentStatus } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { ApiError, api } from '@/lib/api-client';
import { useStoreContext } from '@/lib/store-context';

const STATUSES: PaymentStatus[] = [
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'PARTIALLY_PAID',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'CANCELLED',
];

export default function PaymentsPage() {
  const { selectedStoreId } = useStoreContext();
  const [items, setItems] = useState<PaymentListItem[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedStoreId) {
      setItems([]);
      setMeta(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (query) params.set('search', query);
      if (status) params.set('status', status);
      if (provider) params.set('provider', provider);
      const result = await api.get<{
        success: true;
        data: { items: PaymentListItem[]; meta: OffsetPageMeta };
      }>(`/stores/${selectedStoreId}/payments?${params.toString()}`);
      setItems(result.data.items);
      setMeta(result.data.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, page, query, status, provider]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store to view payments."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Offline payment records linked to store orders.
        </p>
      </div>

      <form
        onSubmit={onSearch}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      >
        <label className="space-y-1 text-sm">
          <span>Search order #</span>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="EM-100001"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Status</span>
          <Select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Provider</span>
          <Select
            value={provider}
            onChange={(e) => {
              setPage(1);
              setProvider(e.target.value);
            }}
          >
            <option value="">All</option>
            {['COD', 'OTHER', 'TEST', 'STRIPE', 'BKASH', 'NAGAD', 'SSL_COMMERZ'].map(
              (p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ),
            )}
          </Select>
        </label>
        <Button type="submit">Search</Button>
      </form>

      {loading ? <LoadingState label="Loading payments…" /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No payments"
          description="Payments appear when customers place orders."
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/payments/${item.id}`}
                      className="font-medium text-[var(--color-accent)] hover:underline"
                    >
                      {item.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {item.internalReference}
                    {item.providerPaymentId ? (
                      <span className="block text-[var(--color-muted)]">
                        {item.providerPaymentId}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {item.provider} / {item.method}
                    {item.attemptNumber > 1 ? ` · #${item.attemptNumber}` : ''}
                  </td>
                  <td className="px-4 py-3">{item.status}</td>
                  <td className="px-4 py-3">
                    {item.currency} {item.amount}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(item.createdAt).toLocaleString()}
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
