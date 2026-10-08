'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
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
  // Guest checkout: the name and contact are on the order's delivery address.
  return order.contact?.name || order.contact?.phone || order.contact?.email || 'Guest';
}

type SortPreset = 'newest' | 'oldest' | 'highest' | 'lowest';

function sortParams(preset: SortPreset): { sortBy: string; sortOrder: string } {
  switch (preset) {
    case 'oldest':
      return { sortBy: 'createdAt', sortOrder: 'asc' };
    case 'highest':
      return { sortBy: 'grandTotal', sortOrder: 'desc' };
    case 'lowest':
      return { sortBy: 'grandTotal', sortOrder: 'asc' };
    case 'newest':
    default:
      return { sortBy: 'createdAt', sortOrder: 'desc' };
  }
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
  const [shippingMethod, setShippingMethod] = useState('');
  const [shippingQuery, setShippingQuery] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [sortPreset, setSortPreset] = useState<SortPreset>('newest');
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
      const { sortBy, sortOrder } = sortParams(sortPreset);
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sortBy,
        sortOrder,
      });
      if (query) params.set('search', query);
      if (status) params.set('status', status);
      if (paymentStatus) params.set('paymentStatus', paymentStatus);
      if (fulfillmentStatus) params.set('fulfillmentStatus', fulfillmentStatus);
      if (shippingQuery) params.set('shippingMethod', shippingQuery);
      if (createdFrom) params.set('createdFrom', createdFrom);
      if (createdTo) params.set('createdTo', `${createdTo}T23:59:59.999Z`);

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
  }, [
    selectedStoreId,
    page,
    query,
    status,
    paymentStatus,
    fulfillmentStatus,
    shippingQuery,
    createdFrom,
    createdTo,
    sortPreset,
  ]);

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

  const filtersActive = Boolean(
    query ||
      status ||
      paymentStatus ||
      fulfillmentStatus ||
      shippingQuery ||
      createdFrom ||
      createdTo ||
      sortPreset !== 'newest',
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Orders
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Filter, search, and open orders for operational work.
        </p>
      </div>

      <FilterBar
        onSubmit={() => {
          setPage(1);
          setQuery(search.trim());
          setShippingQuery(shippingMethod.trim());
        }}
        search={{
          value: search,
          onChange: setSearch,
          onClear: () => {
            setSearch('');
            setPage(1);
            setQuery('');
          },
          placeholder: 'Search by order #, customer name, email or phone…',
          label: 'Search orders',
        }}
        summary={
          meta
            ? `${meta.total} ${meta.total === 1 ? 'order' : 'orders'}${
                filtersActive ? (meta.total === 1 ? ' matches your filters' : ' match your filters') : ''
              }`
            : undefined
        }
        onReset={
          filtersActive
            ? () => {
                setSearch('');
                setQuery('');
                setStatus('');
                setPaymentStatus('');
                setFulfillmentStatus('');
                setShippingMethod('');
                setShippingQuery('');
                setCreatedFrom('');
                setCreatedTo('');
                setSortPreset('newest');
                setPage(1);
              }
            : undefined
        }
      >
        <FilterField label="Order status">
          <Select
            className="h-10"
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
                {humanize(s)}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Payment">
          <Select
            className="h-10"
            value={paymentStatus}
            onChange={(e) => {
              setPage(1);
              setPaymentStatus(e.target.value);
            }}
            aria-label="Payment status filter"
          >
            <option value="">All payments</option>
            {(['PENDING', 'PAID', 'FAILED', 'CANCELLED'] as PaymentStatus[]).map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Fulfillment">
          <Select
            className="h-10"
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
                {humanize(s)}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Sort by">
          <Select
            className="h-10"
            value={sortPreset}
            onChange={(e) => {
              setPage(1);
              setSortPreset(e.target.value as SortPreset);
            }}
            aria-label="Sort orders"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest total</option>
            <option value="lowest">Lowest total</option>
          </Select>
        </FilterField>
        <FilterField label="Shipping method">
          <Input
            className="h-10"
            placeholder="e.g. Inside Dhaka"
            value={shippingMethod}
            onChange={(e) => setShippingMethod(e.target.value)}
            aria-label="Shipping method filter"
          />
        </FilterField>
        <FilterField label="From date">
          <Input
            type="date"
            className="h-10"
            value={createdFrom}
            max={createdTo || undefined}
            onChange={(e) => {
              setPage(1);
              setCreatedFrom(e.target.value);
            }}
            aria-label="Created from"
          />
        </FilterField>
        <FilterField label="To date">
          <Input
            type="date"
            className="h-10"
            value={createdTo}
            min={createdFrom || undefined}
            onChange={(e) => {
              setPage(1);
              setCreatedTo(e.target.value);
            }}
            aria-label="Created to"
          />
        </FilterField>
      </FilterBar>

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
                  className={`border-b border-[var(--color-border)] last:border-b-0 ${
                    order.viewed === false ? 'bg-[#fff8f6]' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link
                      className={`text-[var(--color-accent)] hover:underline ${
                        order.viewed === false ? 'font-bold' : 'font-medium'
                      }`}
                      href={`/dashboard/orders/${order.id}`}
                    >
                      {order.orderNumber}
                    </Link>
                    {order.viewed === false ? (
                      <span className="ml-2 rounded-full bg-[#d92d20] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        New
                      </span>
                    ) : null}
                    {order.shippingMethodName ? (
                      <p className="text-xs text-[var(--color-muted)]">
                        {order.shippingMethodName}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {customerLabel(order)}
                    {!order.customer ? (
                      <span className="ml-1.5 text-xs text-[var(--color-muted)]">· Guest</span>
                    ) : null}
                    {!order.customer && order.contact?.name && order.contact.phone ? (
                      <p className="text-xs text-[var(--color-muted)]">{order.contact.phone}</p>
                    ) : null}
                  </td>
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

/** PARTIALLY_FULFILLED → "Partially fulfilled". */
function humanize(value: string) {
  const text = value.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
