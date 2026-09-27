'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminStoreDetail } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={store?.name ?? 'Store'}
        description={store?.slug}
        backHref="/dashboard/stores"
        backLabel="Stores"
        actions={
          store ? (
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
