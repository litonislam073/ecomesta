'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { Category, OffsetPageMeta, Product, ProductStatus } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { StatusBadge } from '@/components/catalog/status-badge';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

function ProductsContent() {
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();

  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [productType, setProductType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        sortBy,
        sortOrder,
      });
      if (query) params.set('search', query);
      if (status) params.set('status', status);
      if (productType) params.set('productType', productType);
      if (categoryId) params.set('categoryId', categoryId);

      const [productsRes, categoriesRes] = await Promise.all([
        api.get<{
          success: true;
          data: { items: Product[]; meta: OffsetPageMeta };
        }>(`/stores/${selectedStoreId}/products?${params}`),
        api.get<{
          success: true;
          data: { items: Category[]; meta: OffsetPageMeta };
        }>(`/stores/${selectedStoreId}/categories?limit=100`),
      ]);
      setItems(productsRes.data.items);
      setMeta(productsRes.data.meta);
      setCategories(categoriesRes.data.items);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load products'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, page, query, status, productType, categoryId, sortBy, sortOrder]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onArchive() {
    if (!selectedStoreId || !archiveId) return;
    setBusy(true);
    try {
      await api.delete(`/stores/${selectedStoreId}/products/${archiveId}`);
      pushToast('Product archived.', 'success');
      setArchiveId(null);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not archive product'), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header to manage products."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Products
          </h1>
          <p className="mt-2 text-[var(--color-muted)]">
            Catalog for the selected store, loaded from the product API.
          </p>
        </div>
        {canWrite && !loading && !error && items.length > 0 ? (
          <Link href="/dashboard/products/new">
            <Button>Add product</Button>
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
          placeholder="Search name or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
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
          <option value="DRAFT">DRAFT</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </Select>
        <Select
          className="w-auto"
          value={productType}
          onChange={(e) => {
            setPage(1);
            setProductType(e.target.value);
          }}
          aria-label="Type filter"
        >
          <option value="">All types</option>
          <option value="PHYSICAL">PHYSICAL</option>
          <option value="DIGITAL">DIGITAL</option>
          <option value="SERVICE">SERVICE</option>
        </Select>
        <Select
          className="w-auto"
          value={categoryId}
          onChange={(e) => {
            setPage(1);
            setCategoryId(e.target.value);
          }}
          aria-label="Category filter"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          className="w-auto"
          value={`${sortBy}:${sortOrder}`}
          onChange={(e) => {
            const [nextSort, nextOrder] = e.target.value.split(':') as [
              string,
              'asc' | 'desc',
            ];
            setSortBy(nextSort);
            setSortOrder(nextOrder);
          }}
          aria-label="Sort"
        >
          <option value="updatedAt:desc">Updated ↓</option>
          <option value="createdAt:desc">Created ↓</option>
          <option value="name:asc">Name A–Z</option>
          <option value="basePrice:asc">Price ↑</option>
          <option value="basePrice:desc">Price ↓</option>
        </Select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {loading ? <LoadingState label="Loading products" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Create your first product to start building the catalog."
          actionLabel={canWrite ? 'Add product' : undefined}
          onAction={
            canWrite
              ? () => {
                  window.location.href = '/dashboard/products/new';
                }
              : undefined
          }
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Inventory</th>
                <th className="px-4 py-3 font-medium">Categories</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/products/${product.id}`}
                    >
                      {product.name}
                    </Link>
                    <p className="text-xs text-[var(--color-muted)]">{product.productType}</p>
                  </td>
                  <td className="px-4 py-3">{product.sku ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={product.status as ProductStatus} />
                  </td>
                  <td className="px-4 py-3">{product.basePrice}</td>
                  <td className="px-4 py-3">
                    {!product.trackInventory
                      ? 'Not tracked'
                      : typeof product.onHandQuantity === 'number'
                        ? product.onHandQuantity
                        : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {product.categories?.length
                      ? product.categories.map((c) => c.name).join(', ')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(product.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/dashboard/products/${product.id}`}>
                        <Button variant="secondary">View</Button>
                      </Link>
                      {canWrite && product.status !== 'ARCHIVED' ? (
                        <Button variant="danger" onClick={() => setArchiveId(product.id)}>
                          Archive
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
        open={Boolean(archiveId)}
        title="Archive this product?"
        description="The product will be marked ARCHIVED. It is not permanently deleted."
        confirmLabel="Archive"
        danger
        busy={busy}
        onCancel={() => setArchiveId(null)}
        onConfirm={() => void onArchive()}
      />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <StoreScoped>
      <ProductsContent />
    </StoreScoped>
  );
}
