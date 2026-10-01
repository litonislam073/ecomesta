'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type {
  InventoryItem,
  OffsetPageMeta,
  Product,
  ProductVariant,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { InventoryAdjustmentForm } from '@/components/catalog/inventory-adjustment-form';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

function stockLabel(item: InventoryItem): string {
  if (item.availableQuantity <= 0) return 'Out of stock';
  if (
    item.lowStockThreshold != null &&
    item.availableQuantity <= item.lowStockThreshold
  ) {
    return 'Low stock';
  }
  if (item.lowStockThreshold == null && item.availableQuantity > 0 && item.availableQuantity <= 5) {
    return 'Low stock';
  }
  return 'In stock';
}

function InventoryContent() {
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [pendingAdjust, setPendingAdjust] = useState<{
    productId: string;
    variantId: string | null;
    quantity: number;
    type: 'ADJUSTMENT';
    note?: string;
  } | null>(null);

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
      if (stockStatus) params.set('stockStatus', stockStatus);
      if (productId) params.set('productId', productId);

      const [invRes, productsRes] = await Promise.all([
        api.get<{
          success: true;
          data: { items: InventoryItem[]; meta: OffsetPageMeta };
        }>(`/stores/${selectedStoreId}/inventory?${params}`),
        api.get<{
          success: true;
          data: { items: Product[]; meta: OffsetPageMeta };
        }>(`/stores/${selectedStoreId}/products?limit=100&status=ACTIVE`),
      ]);
      setItems(invRes.data.items);
      setMeta(invRes.data.meta);
      setProducts(productsRes.data.items);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load inventory'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, page, query, stockStatus, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedStoreId || !showAdjust || adjustItem || products.length === 0) {
      if (adjustItem) setVariants([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const results = await Promise.all(
          products.slice(0, 30).map((p) =>
            api.get<{ success: true; data: ProductVariant[] }>(
              `/stores/${selectedStoreId}/products/${p.id}/variants`,
            ),
          ),
        );
        if (!cancelled) {
          setVariants(results.flatMap((r) => r.data));
        }
      } catch {
        if (!cancelled) setVariants([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId, showAdjust, adjustItem, products]);

  async function applyAdjustment() {
    if (!selectedStoreId || !pendingAdjust) return;
    setBusy(true);
    try {
      await api.post(`/stores/${selectedStoreId}/inventory/adjust`, pendingAdjust);
      pushToast('Inventory adjusted.', 'success');
      setPendingAdjust(null);
      setAdjustItem(null);
      setShowAdjust(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 422)) {
        pushToast(humanApiError(err, 'Adjustment was rejected by the server'), 'error');
      } else {
        pushToast(humanApiError(err, 'Could not adjust inventory'), 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header to manage inventory."
      />
    );
  }

  const filtersActive = Boolean(query || stockStatus || productId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Inventory
          </h1>
          <p className="mt-2 text-[var(--color-muted)]">
            On-hand, reserved, and available quantities from the inventory API.
          </p>
        </div>
        {canWrite ? (
          <Button
            onClick={() => {
              setAdjustItem(null);
              setShowAdjust(true);
            }}
          >
            Adjust stock
          </Button>
        ) : null}
      </div>

      <FilterBar
        onSubmit={() => {
          setPage(1);
          setQuery(search.trim());
        }}
        search={{
          value: search,
          onChange: setSearch,
          onClear: () => {
            setSearch('');
            setPage(1);
            setQuery('');
          },
          placeholder: 'Search by product, variant or SKU…',
          label: 'Search inventory',
        }}
        summary={
          meta
            ? `${meta.total} ${meta.total === 1 ? 'stock item' : 'stock items'}${
                filtersActive ? (meta.total === 1 ? ' matches your filters' : ' match your filters') : ''
              }`
            : undefined
        }
        onReset={
          filtersActive
            ? () => {
                setSearch('');
                setQuery('');
                setStockStatus('');
                setProductId('');
                setPage(1);
              }
            : undefined
        }
      >
        <FilterField label="Stock status">
          <Select
            className="h-10"
            value={stockStatus}
            onChange={(e) => {
              setPage(1);
              setStockStatus(e.target.value);
            }}
            aria-label="Stock status filter"
          >
            <option value="">All stock</option>
            <option value="in_stock">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </Select>
        </FilterField>
        <FilterField label="Product">
          <Select
            className="h-10"
            value={productId}
            onChange={(e) => {
              setPage(1);
              setProductId(e.target.value);
            }}
            aria-label="Product filter"
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {showAdjust ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-3 font-medium">
            {adjustItem ? 'Adjust selected item' : 'New stock adjustment'}
          </h2>
          <InventoryAdjustmentForm
            item={adjustItem}
            products={products}
            variants={variants}
            busy={busy}
            onCancel={() => {
              setShowAdjust(false);
              setAdjustItem(null);
            }}
            onSubmit={(payload) => {
              setPendingAdjust(payload);
            }}
          />
        </div>
      ) : null}

      {loading ? <LoadingState label="Loading inventory" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No inventory rows"
          description="Inventory appears when products track stock. Adjust stock to create rows."
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Variant</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Quantity</th>
                <th className="px-4 py-3 font-medium">Reserved</th>
                <th className="px-4 py-3 font-medium">Available</th>
                <th className="px-4 py-3 font-medium">Low-stock status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-4 py-3 font-medium">
                    {item.product?.name ?? item.productId}
                  </td>
                  <td className="px-4 py-3">{item.variant?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {item.variant?.sku ?? item.product?.sku ?? '—'}
                  </td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3">{item.reservedQuantity}</td>
                  <td className="px-4 py-3">{item.availableQuantity}</td>
                  <td className="px-4 py-3">{stockLabel(item)}</td>
                  <td className="px-4 py-3">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/dashboard/inventory/${item.id}`}>
                        <Button variant="secondary">Movements</Button>
                      </Link>
                      {canWrite ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setAdjustItem(item);
                            setShowAdjust(true);
                          }}
                        >
                          Adjust
                        </Button>
                      ) : null}
                    </div>
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

      <ConfirmDialog
        open={Boolean(pendingAdjust)}
        title="Apply stock adjustment?"
        description={
          pendingAdjust
            ? `Apply a delta of ${pendingAdjust.quantity} (type ADJUSTMENT). The server calculates the final quantity.`
            : undefined
        }
        confirmLabel="Apply"
        busy={busy}
        onCancel={() => setPendingAdjust(null)}
        onConfirm={() => void applyAdjustment()}
      />
    </div>
  );
}

export default function InventoryPage() {
  return (
    <StoreScoped>
      <InventoryContent />
    </StoreScoped>
  );
}
