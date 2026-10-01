'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, OffsetPageMeta } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import {
  CategoryForm,
  type CategoryFormValues,
} from '@/components/catalog/category-form';
import { CategoryTree } from '@/components/catalog/category-tree';
import { SampleBadge } from '@/components/catalog/sample-badge';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

function flattenTree(nodes: Category[]): Category[] {
  const out: Category[] = [];
  const walk = (list: Category[]) => {
    for (const node of list) {
      const { children, ...rest } = node;
      out.push(rest);
      if (children?.length) walk(children);
    }
  };
  walk(nodes);
  return out;
}

function CategoriesContent() {
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();

  const [items, setItems] = useState<Category[]>([]);
  const [treeItems, setTreeItems] = useState<Category[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [parentId, setParentId] = useState('');
  const [view, setView] = useState<'list' | 'tree'>('tree');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const parentOptions = useMemo(() => {
    if (treeItems.length > 0) return flattenTree(treeItems);
    return items;
  }, [treeItems, items]);

  const load = useCallback(async () => {
    if (!selectedStoreId) {
      setItems([]);
      setTreeItems([]);
      setMeta(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (view === 'tree') {
        const treeRes = await api.get<{
          success: true;
          data: { items: Category[] };
        }>(`/stores/${selectedStoreId}/categories?tree=true`);
        setTreeItems(treeRes.data.items);
        setItems(flattenTree(treeRes.data.items));
        setMeta(null);
      } else {
        const params = new URLSearchParams({
          page: String(page),
          limit: '20',
          sortBy: 'name',
          sortOrder: 'asc',
        });
        if (query) params.set('search', query);
        if (parentId) params.set('parentId', parentId);
        const listRes = await api.get<{
          success: true;
          data: { items: Category[]; meta: OffsetPageMeta };
        }>(`/stores/${selectedStoreId}/categories?${params}`);
        setItems(listRes.data.items);
        setMeta(listRes.data.meta);
        const treeRes = await api.get<{
          success: true;
          data: { items: Category[] };
        }>(`/stores/${selectedStoreId}/categories?tree=true`);
        setTreeItems(treeRes.data.items);
      }
    } catch (err) {
      setError(humanApiError(err, 'Failed to load categories'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, view, page, query, parentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(values: CategoryFormValues) {
    if (!selectedStoreId) return;
    setBusy(true);
    try {
      await api.post(`/stores/${selectedStoreId}/categories`, {
        name: values.name.trim(),
        slug: values.slug,
        description: values.description.trim() || undefined,
        imageUrl: values.imageUrl.trim() || undefined,
        parentId: values.parentId || null,
        status: values.status,
      });
      pushToast('Category created.', 'success');
      setShowForm(false);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not create category'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onUpdate(values: CategoryFormValues) {
    if (!selectedStoreId || !editing) return;
    setBusy(true);
    try {
      await api.patch(`/stores/${selectedStoreId}/categories/${editing.id}`, {
        name: values.name.trim(),
        slug: values.slug,
        description: values.description.trim() || null,
        imageUrl: values.imageUrl.trim() || null,
        parentId: values.parentId || null,
        status: values.status,
      });
      pushToast('Category updated.', 'success');
      setEditing(null);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not update category'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selectedStoreId || !deleteTarget) return;
    setBusy(true);
    try {
      await api.delete(`/stores/${selectedStoreId}/categories/${deleteTarget.id}`);
      pushToast('Category deleted.', 'success');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        pushToast(
          'This category cannot be deleted because it is still being used.',
          'error',
        );
      } else {
        pushToast(humanApiError(err, 'Could not delete category'), 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header to manage categories."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Categories
          </h1>
          <p className="mt-2 text-[var(--color-muted)]">
            Nested category tree backed by the store category API.
          </p>
        </div>
        {canWrite && !loading && !error && items.length > 0 ? (
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            Add category
          </Button>
        ) : null}
      </div>

      <FilterBar
        onSubmit={() => {
          setPage(1);
          setQuery(search.trim());
          setView('list');
        }}
        search={{
          value: search,
          onChange: setSearch,
          onClear: () => {
            setSearch('');
            setPage(1);
            setQuery('');
          },
          placeholder: 'Search categories by name…',
          label: 'Search categories',
        }}
        summary={
          view === 'list' && meta
            ? `${meta.total} ${meta.total === 1 ? 'category' : 'categories'}${query || parentId ? (meta.total === 1 ? ' matches your filters' : ' match your filters') : ''}`
            : 'Showing every category as a tree'
        }
        onReset={
          query || parentId
            ? () => {
                setSearch('');
                setQuery('');
                setParentId('');
                setPage(1);
                setView('tree');
              }
            : undefined
        }
      >
        <FilterField label="Parent category">
          <Select
            className="h-10"
            value={parentId}
            onChange={(e) => {
              setPage(1);
              setParentId(e.target.value);
              setView('list');
            }}
            aria-label="Parent filter"
          >
            <option value="">All parents</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="View">
          <div
            role="radiogroup"
            aria-label="View mode"
            className="grid h-10 grid-cols-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-1 text-sm"
          >
            {(['tree', 'list'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={view === mode}
                onClick={() => setView(mode)}
                className={`rounded font-medium transition-colors ${
                  view === mode
                    ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                {mode === 'tree' ? 'Tree' : 'List'}
              </button>
            ))}
          </div>
        </FilterField>
      </FilterBar>

      {showForm ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-3 font-medium">New category</h2>
          <CategoryForm
            categories={parentOptions}
            busy={busy}
            submitLabel="Create category"
            onSubmit={onCreate}
          />
          <Button className="mt-3" variant="secondary" onClick={() => setShowForm(false)}>
            Cancel
          </Button>
        </div>
      ) : null}

      {editing ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-3 font-medium">Edit category</h2>
          <CategoryForm
            key={editing.id}
            editingId={editing.id}
            categories={parentOptions}
            initial={{
              name: editing.name,
              slug: editing.slug,
              description: editing.description ?? '',
              imageUrl: editing.imageUrl ?? '',
              parentId: editing.parentId ?? '',
              status: editing.status,
            }}
            busy={busy}
            submitLabel="Update category"
            onSubmit={onUpdate}
          />
          <Button className="mt-3" variant="secondary" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      {loading ? <LoadingState label="Loading categories" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create categories to organize products in this store."
          actionLabel={canWrite ? 'Add category' : undefined}
          onAction={canWrite ? () => setShowForm(true) : undefined}
        />
      ) : null}

      {!loading && !error && items.length > 0 && view === 'tree' ? (
        <CategoryTree
          categories={parentOptions}
          canWrite={canWrite}
          onEdit={(cat) => {
            setShowForm(false);
            setEditing(cat);
          }}
          onDelete={setDeleteTarget}
        />
      ) : null}

      {!loading && !error && items.length > 0 && view === 'list' ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Parent</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((cat) => (
                <tr
                  key={cat.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-2">
                      {cat.name}
                      {cat.isDemo ? <SampleBadge /> : null}
                    </span>
                  </td>
                  <td className="px-4 py-3">{cat.slug}</td>
                  <td className="px-4 py-3">
                    {cat.parentId
                      ? parentOptions.find((p) => p.id === cat.parentId)?.name ?? '—'
                      : '—'}
                  </td>
                  <td className="px-4 py-3">{cat.status}</td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setShowForm(false);
                            setEditing(cat);
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="danger" onClick={() => setDeleteTarget(cat)}>
                          Delete
                        </Button>
                      </div>
                    ) : (
                      '—'
                    )}
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
        open={Boolean(deleteTarget)}
        title="Delete this category?"
        description="Deletion fails if child categories or products still use it."
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <StoreScoped>
      <CategoriesContent />
    </StoreScoped>
  );
}
