'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { Coupon, CouponType, OffsetPageMeta } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

function CouponsContent() {
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const [items, setItems] = useState<Coupon[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('');
  const [type, setType] = useState('');
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
      if (active === 'true' || active === 'false') params.set('active', active);
      if (type) params.set('type', type);
      const result = await api.get<{
        success: true;
        data: { items: Coupon[]; meta: OffsetPageMeta };
      }>(`/stores/${selectedStoreId}/coupons?${params}`);
      setItems(result.data.items);
      setMeta(result.data.meta);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load coupons'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, page, query, active, type]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header to manage coupons."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Coupons
          </h1>
          <p className="mt-2 text-[var(--color-muted)]">
            Store-scoped discount codes for checkout.
          </p>
        </div>
        {canWrite ? (
          <Link href="/dashboard/coupons/new">
            <Button>New coupon</Button>
          </Link>
        ) : null}
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
          placeholder="Search code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search coupons"
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
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
        <Select
          className="w-auto"
          value={type}
          onChange={(e) => {
            setPage(1);
            setType(e.target.value);
          }}
          aria-label="Type filter"
        >
          <option value="">All types</option>
          {(['PERCENTAGE', 'FIXED_AMOUNT'] as CouponType[]).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {loading ? <LoadingState label="Loading coupons" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No coupons yet"
          description="Create a percentage or fixed-amount coupon for this store."
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium">Window</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((coupon) => (
                <tr
                  key={coupon.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/coupons/${coupon.id}`}
                    >
                      {coupon.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{coupon.type}</td>
                  <td className="px-4 py-3">
                    {coupon.type === 'PERCENTAGE'
                      ? `${coupon.value}%`
                      : coupon.value}
                  </td>
                  <td className="px-4 py-3">
                    {coupon.usageCount}
                    {coupon.usageLimit != null ? ` / ${coupon.usageLimit}` : ''}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {coupon.startsAt
                      ? new Date(coupon.startsAt).toLocaleDateString()
                      : '—'}
                    {' → '}
                    {coupon.expiresAt
                      ? new Date(coupon.expiresAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {coupon.active ? 'Active' : 'Inactive'}
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

export default function CouponsPage() {
  return (
    <StoreScoped>
      <CouponsContent />
    </StoreScoped>
  );
}
