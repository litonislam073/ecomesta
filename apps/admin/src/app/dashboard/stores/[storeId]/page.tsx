'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminStoreDetail } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import { displayName, formatDateTime, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

export default function AdminStoreDetailPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId;
  const { pushToast } = useToast();

  const [store, setStore] = useState<AdminStoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<'ACTIVE' | 'SUSPENDED' | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [removal, setRemoval] = useState<'soft' | 'restore' | 'permanent' | null>(null);
  const [reason, setReason] = useState('');
  const [restoreSlug, setRestoreSlug] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: AdminStoreDetail }>(
        `/admin/stores/${storeId}`,
      );
      setStore(result.data);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load store'));
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyStatus() {
    if (!pending || !storeId) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.patch(`/admin/stores/${storeId}/status`, { status: pending });
      pushToast(
        pending === 'SUSPENDED' ? 'Store suspended' : 'Store activated',
        'success',
      );
      setPending(null);
      await load();
    } catch (err) {
      const message = humanApiError(err, 'Could not update the store');
      setActionError(message);
      pushToast(message, 'error');
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  const suspended = store?.status === 'SUSPENDED';
  const deleted = Boolean(store?.deletedAt);
  /** The address the merchant knows the store by (its old one when deleted). */
  const address = store ? (store.deletedSlug ?? store.slug) : '';

  function openRemoval(kind: 'soft' | 'restore' | 'permanent') {
    setReason('');
    setConfirmText('');
    setRestoreSlug(store?.deletedSlug ?? '');
    setRemoval(kind);
  }

  async function applyRemoval() {
    if (!removal || !storeId) return;
    setBusy(true);
    setActionError(null);
    try {
      if (removal === 'soft') {
        await api.post(`/admin/stores/${storeId}/soft-delete`, { reason: reason.trim() || undefined });
        pushToast('Store deleted. It can be restored from this page.', 'success');
      } else if (removal === 'restore') {
        const slug = restoreSlug.trim().toLowerCase();
        await api.post(`/admin/stores/${storeId}/restore`, slug && slug !== store?.deletedSlug ? { slug } : {});
        pushToast('Store restored', 'success');
      } else {
        await api.post(`/admin/stores/${storeId}/permanent-delete`, { confirmSlug: confirmText.trim() });
        pushToast(`Store "${address}" and all its data were permanently deleted.`, 'success');
        setRemoval(null);
        router.push('/dashboard/stores');
        return;
      }
      setRemoval(null);
      await load();
    } catch (err) {
      const message = humanApiError(err, 'Could not update the store');
      setActionError(message);
      pushToast(message, 'error');
      setRemoval(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={store?.name ?? 'Store'}
        description={store ? (deleted ? `Deleted · was ${address}` : store.slug) : undefined}
        backHref="/dashboard/stores"
        backLabel="Stores"
        actions={
          store && !deleted ? (
            suspended ? (
              <Button onClick={() => setPending('ACTIVE')}>Activate store</Button>
            ) : (
              <Button variant="danger" onClick={() => setPending('SUSPENDED')}>
                Suspend store
              </Button>
            )
          ) : null
        }
      />

      {loading ? <LoadingState label="Loading store" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && store ? (
        <>
          {actionError ? <ErrorState message={actionError} /> : null}
          {deleted ? (
            <div role="status" className="rounded-lg border border-[#f3c4c0] bg-[#fdf1f0] px-4 py-3 text-sm">
              <p className="font-semibold text-[#912018]">This store is deleted.</p>
              <p className="mt-1 text-[var(--color-ink)]">
                Deleted on {formatDateTime(store.deletedAt ?? null)}. It is offline and hidden from its merchant, and its
                address <span className="font-semibold">{address}</span> is free for another store. All its data is kept
                until it is deleted permanently.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Store">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-[var(--color-muted)]">Status</dt>
                <dd>
                  <StatusBadge status={store.status} />
                </dd>
                <dt className="text-[var(--color-muted)]">Tenant</dt>
                <dd>
                  <Link
                    className="text-[var(--color-accent)] hover:underline"
                    href={`/dashboard/tenants/${store.tenant.id}`}
                  >
                    {store.tenant.name}
                  </Link>
                </dd>
                <dt className="text-[var(--color-muted)]">Currency</dt>
                <dd>{store.currency}</dd>
                <dt className="text-[var(--color-muted)]">Timezone</dt>
                <dd>{store.timezone}</dd>
                <dt className="text-[var(--color-muted)]">Locale</dt>
                <dd>{store.locale}</dd>
                <dt className="text-[var(--color-muted)]">Created</dt>
                <dd>{formatDateTime(store.createdAt)}</dd>
                <dt className="text-[var(--color-muted)]">Theme</dt>
                <dd>{store.theme ? store.theme.name : '—'}</dd>
                <dt className="text-[var(--color-muted)]">Theme published</dt>
                <dd>
                  {store.theme?.publishedAt
                    ? formatDateTime(store.theme.publishedAt)
                    : 'Never'}
                </dd>
              </dl>
            </Card>

            <Card title="Catalog and commerce">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-[var(--color-muted)]">Products</dt>
                <dd>{store.counts.products}</dd>
                <dt className="text-[var(--color-muted)]">Customers</dt>
                <dd>{store.counts.customers}</dd>
                <dt className="text-[var(--color-muted)]">Orders</dt>
                <dd>{store.counts.orders}</dd>
                <dt className="text-[var(--color-muted)]">Inventory items</dt>
                <dd>{store.counts.inventoryItems}</dd>
              </dl>
            </Card>
          </div>

          <Card
            title="Domains"
            description="Read-only. DNS verification tokens are merchant-only and are never exposed here."
          >
            {store.domains.length === 0 ? (
              <EmptyState title="No domains" />
            ) : (
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {store.domains.map((domain) => (
                  <li
                    key={domain.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="font-medium">{domain.hostname}</span>
                    <span className="text-[var(--color-muted)]">{domain.type}</span>
                    {domain.isPrimary ? (
                      <span className="text-xs text-[var(--color-muted)]">Primary</span>
                    ) : null}
                    <StatusBadge status={domain.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Members">
            {store.memberships.length === 0 ? (
              <EmptyState title="No members" />
            ) : (
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {store.memberships.map((membership) => (
                  <li
                    key={membership.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <Link
                      className="font-medium text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/users/${membership.user.id}`}
                    >
                      {displayName(membership.user)}
                    </Link>
                    <span className="text-[var(--color-muted)]">{membership.role}</span>
                    <StatusBadge status={membership.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}

      {!loading && !error && store ? (
        <Card
          title="Danger zone"
          description="For a store a merchant opened by mistake. The business, its plan and payments always stay, so the merchant can open a new store on the same plan without paying again."
        >
          <div className="space-y-4 text-sm">
            {deleted ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xl">
                  <span className="font-semibold">Restore store.</span> Brings it back online for its merchant, on its
                  old address if that is still free.
                </p>
                <Button variant="secondary" onClick={() => openRemoval('restore')}>
                  Restore store
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xl">
                  <span className="font-semibold">Delete store.</span> Takes it offline, hides it from the merchant and
                  frees its address. Nothing is erased, and it can be restored.
                </p>
                <Button variant="danger" onClick={() => openRemoval('soft')}>
                  Delete store
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
              <p className="max-w-xl">
                <span className="font-semibold text-[var(--color-danger)]">Delete permanently.</span> Erases the store
                with its products, orders, customers, images, themes and domains. This cannot be undone.
              </p>
              <Button variant="danger" onClick={() => openRemoval('permanent')}>
                Delete permanently
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        open={removal !== null}
        busy={busy}
        danger={removal !== 'restore'}
        title={
          removal === 'restore'
            ? 'Restore this store?'
            : removal === 'permanent'
              ? 'Delete this store permanently?'
              : 'Delete this store?'
        }
        description={
          removal === 'restore'
            ? 'The store comes back with its old status, and its merchant gets access again.'
            : removal === 'permanent'
              ? `Everything in "${address}" is erased for good: ${store?.counts.products ?? 0} products, ${store?.counts.orders ?? 0} orders and ${store?.counts.customers ?? 0} customers, plus images, themes and domains. The business and its plan stay.`
              : 'The store goes offline and its merchant no longer sees it. Its address becomes free. You can restore it later.'
        }
        confirmLabel={
          removal === 'restore' ? 'Restore store' : removal === 'permanent' ? 'Delete permanently' : 'Delete store'
        }
        confirmDisabled={removal === 'permanent' && confirmText.trim().toLowerCase() !== address}
        onConfirm={() => void applyRemoval()}
        onCancel={() => setRemoval(null)}
      >
        {removal === 'soft' ? (
          <label className="block space-y-1.5 text-sm" htmlFor="delete-reason">
            <span className="font-medium">Reason (optional, kept in the audit log)</span>
            <Input id="delete-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Opened by mistake" />
          </label>
        ) : null}
        {removal === 'restore' ? (
          <div className="space-y-1.5 text-sm">
            <label className="block space-y-1.5" htmlFor="restore-slug">
              <span className="font-medium">Store address</span>
              <Input
                id="restore-slug"
                value={restoreSlug}
                aria-describedby="restore-slug-hint"
                onChange={(e) => setRestoreSlug(e.target.value)}
              />
            </label>
            <p id="restore-slug-hint" className="text-xs text-[var(--color-muted)]">
              Keep the old address, or type a new one if another store took it.
            </p>
          </div>
        ) : null}
        {removal === 'permanent' ? (
          <label className="block space-y-1.5 text-sm" htmlFor="confirm-slug">
            <span className="font-medium">
              Type <span className="font-mono">{address}</span> to confirm
            </span>
            <Input id="confirm-slug" autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </label>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        danger={pending === 'SUSPENDED'}
        title={pending === 'SUSPENDED' ? 'Suspend this store?' : 'Activate this store?'}
        description={
          pending === 'SUSPENDED'
            ? 'The storefront stops serving requests and merchant write access is blocked. Catalog and order data are preserved.'
            : 'The storefront returns to serving requests.'
        }
        confirmLabel="Update status"
        onConfirm={() => void applyStatus()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
