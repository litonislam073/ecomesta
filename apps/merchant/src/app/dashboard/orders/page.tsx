'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type {
  OffsetPageMeta,
  OrderListItem,
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { StatusBadge } from '@/components/catalog/status-badge';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useStoreContext } from '@/lib/store-context';

function customerLabel(order: OrderListItem): string {
  if (order.customer) {
    const name = [order.customer.firstName, order.customer.lastName]
      .filter(Boolean)
      .join(' ');
    return name || order.customer.email || order.customer.phone || 'Customer';
  }
  return 'Guest';
}

function OrdersContent() {
  const { selectedStoreId } = useStoreContext();
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [fulfillmentStatus, setFulfillmentStatus] = useState('');
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
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      if (query) params.set('search', query);
      if (status) params.set('status', status);
      if (paymentStatus) params.set('paymentStatus', paymentStatus);
      if (fulfillmentStatus) params.set('fulfillmentStatus', fulfillmentStatus);

      const result = await api.get<{
        success: true;
        data: { items: OrderListItem[]; meta: OffsetPageMeta };
      }>(`/stores/${selectedStoreId}/orders?${params}`);
      setItems(result.data.items);
      setMeta(result.data.meta);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load orders'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, page, query, status, paymentStatus, fulfillmentStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header to manage orders."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Orders
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Store-scoped order list from the orders API.
        </p>
      </div>

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
          placeholder="Search order #, name, email, phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search orders"
        />
        <Select
          className="w-auto"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          aria-label="Order status filter"
        >
          <option value="">All statuses</option>
          {(
            [
              'PENDING',
              'CONFIRMED',
              'PROCESSING',
              'COMPLETED',
              'CANCELLED',
            ] as OrderStatus[]
          ).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          className="w-auto"
          value={paymentStatus}
          onChange={(e) => {
            setPage(1);
            setPaymentStatus(e.target.value);
          }}
          aria-label="Payment status filter"
        >
          <option value="">All payments</option>
          {(['PENDING', 'PAID', 'FAILED', 'CANCELLED'] as PaymentStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </Select>
        <Select
          className="w-auto"
          value={fulfillmentStatus}
          onChange={(e) => {
            setPage(1);
            setFulfillmentStatus(e.target.value);
          }}
          aria-label="Fulfillment status filter"
        >
          <option value="">All fulfillment</option>
          {(
            [
              'UNFULFILLED',
              'PARTIALLY_FULFILLED',
              'FULFILLED',
              'CANCELLED',
            ] as FulfillmentStatus[]
          ).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {loading ? <LoadingState label="Loading orders" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Orders created for this store will appear here."
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Fulfillment</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/orders/${order.id}`}
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{customerLabel(order)}</td>
                  <td className="px-4 py-3">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{order.itemCount}</td>
                  <td className="px-4 py-3">
                    {order.currency} {order.grandTotal}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.paymentStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.fulfillmentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {meta ? (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
      ) : null}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <StoreScoped>
      <OrdersContent />
    </StoreScoped>
  );
}
