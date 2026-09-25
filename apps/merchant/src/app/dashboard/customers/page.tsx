'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { Customer, OffsetPageMeta } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { useStoreContext } from '@/lib/store-context';

export default function CustomersPage() {
  const { selectedStoreId } = useStoreContext();
  const { pushToast } = useToast();
  const [items, setItems] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  });

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
      if (query) {
        params.set('search', query);
      }
      const result = await api.get<{
        success: true;
        data: { items: Customer[]; meta: OffsetPageMeta };
      }>(`/stores/${selectedStoreId}/customers?${params.toString()}`);
      setItems(result.data.items);
      setMeta(result.data.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!selectedStoreId) {
      return;
    }
    setBusy(true);
    try {
      await api.post(`/stores/${selectedStoreId}/customers`, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      pushToast('Customer created', 'success');
      setShowCreate(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '', notes: '' });
      setPage(1);
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Create failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selectedStoreId || !deleteId) {
      return;
    }
    setBusy(true);
    try {
      await api.delete(`/stores/${selectedStoreId}/customers/${deleteId}`);
      pushToast('Customer deleted', 'success');
      setDeleteId(null);
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header to manage customers."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Customers
          </h1>
          <p className="mt-2 text-[var(--color-muted)]">
            Store-scoped customer records for the selected store.
          </p>
        </div>
        <Button onClick={() => setShowCreate((open) => !open)}>
          {showCreate ? 'Close form' : 'Add customer'}
        </Button>
      </div>

      {showCreate ? (
        <form
          onSubmit={onCreate}
          className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-2"
        >
          <label className="space-y-1 text-sm">
            <span>First name</span>
            <Input
              required
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Last name</span>
            <Input
              required
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Email</span>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Phone</span>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Notes</span>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Create customer'}
            </Button>
          </div>
        </form>
      ) : null}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <Input
          className="max-w-sm"
          placeholder="Search name, email, or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search customers"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {loading ? <LoadingState label="Loading customers" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add your first customer for this store."
          actionLabel="Add customer"
          onAction={() => setShowCreate(true)}
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      className="text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/customers/${customer.id}`}
                    >
                      {[customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
                        'Unnamed'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{customer.email ?? '—'}</td>
                  <td className="px-4 py-3">{customer.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/dashboard/customers/${customer.id}`}>
                        <Button variant="secondary">View</Button>
                      </Link>
                      <Button
                        variant="danger"
                        onClick={() => setDeleteId(customer.id)}
                      >
                        Delete
                      </Button>
                    </div>
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

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete customer?"
        description="This permanently removes the customer when they have no order history."
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
