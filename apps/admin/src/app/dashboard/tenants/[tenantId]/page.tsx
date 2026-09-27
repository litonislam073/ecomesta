'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminTenantDetail } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import { displayName, formatDate, formatDateTime, humanApiError } from '@/lib/admin-utils';
import { api } from '@/lib/api-client';

export default function AdminTenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { pushToast } = useToast();

  const [tenant, setTenant] = useState<AdminTenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<'ACTIVE' | 'SUSPENDED' | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: AdminTenantDetail }>(
        `/admin/tenants/${tenantId}`,
      );
      setTenant(result.data);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load tenant'));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyStatus() {
    if (!pending || !tenantId) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.patch(`/admin/tenants/${tenantId}/status`, { status: pending });
      pushToast(
        pending === 'SUSPENDED' ? 'Tenant suspended' : 'Tenant activated',
        'success',
      );
      setPending(null);
      await load();
    } catch (err) {
      const message = humanApiError(err, 'Could not update the tenant');
      setActionError(message);
      pushToast(message, 'error');
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  const suspended = tenant?.status === 'SUSPENDED';

  return (
    <div className="space-y-6">
      <PageHeader
        title={tenant?.name ?? 'Tenant'}
        description={tenant?.slug}
        backHref="/dashboard/tenants"
        backLabel="Tenants"
        actions={
          tenant ? (
            suspended ? (
              <Button onClick={() => setPending('ACTIVE')}>Activate tenant</Button>
            ) : (
              <Button variant="danger" onClick={() => setPending('SUSPENDED')}>
                Suspend tenant
              </Button>
            )
          ) : null
        }
      />

      {loading ? <LoadingState label="Loading tenant" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && tenant ? (
        <>
          {actionError ? <ErrorState message={actionError} /> : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Tenant">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-[var(--color-muted)]">Status</dt>
                <dd>
                  <StatusBadge status={tenant.status} />
                </dd>
                <dt className="text-[var(--color-muted)]">Stores</dt>
                <dd>{tenant.counts.stores}</dd>
                <dt className="text-[var(--color-muted)]">Users</dt>
                <dd>{tenant.counts.users}</dd>
                <dt className="text-[var(--color-muted)]">Orders</dt>
                <dd>{tenant.counts.orders}</dd>
                <dt className="text-[var(--color-muted)]">Created</dt>
                <dd>{formatDateTime(tenant.createdAt)}</dd>
              </dl>
            </Card>

            <Card title="Latest subscription">
              {tenant.latestSubscription ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <dt className="text-[var(--color-muted)]">Plan</dt>
                  <dd>
                    <Link
                      className="text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/plans/${tenant.latestSubscription.plan.id}`}
                    >
                      {tenant.latestSubscription.plan.name}
                    </Link>
                  </dd>
                  <dt className="text-[var(--color-muted)]">Status</dt>
                  <dd>
                    <StatusBadge status={tenant.latestSubscription.status} />
                  </dd>
                  <dt className="text-[var(--color-muted)]">Billing cycle</dt>
                  <dd>{tenant.latestSubscription.billingCycle}</dd>
                  <dt className="text-[var(--color-muted)]">Starts</dt>
                  <dd>{formatDate(tenant.latestSubscription.startsAt)}</dd>
                  <dt className="text-[var(--color-muted)]">Ends</dt>
                  <dd>{formatDate(tenant.latestSubscription.endsAt)}</dd>
                  <dt className="text-[var(--color-muted)]">Manage</dt>
                  <dd>
                    <Link
                      className="text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/subscriptions/${tenant.latestSubscription.id}`}
                    >
                      Open subscription
                    </Link>
                  </dd>
                </dl>
              ) : (
                <EmptyState
                  title="No subscription"
                  description="This tenant has never been assigned a plan."
                />
              )}
            </Card>
          </div>

          <Card title="Stores">
            {tenant.stores.length === 0 ? (
              <EmptyState title="No stores" />
            ) : (
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {tenant.stores.map((store) => (
                  <li
                    key={store.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <Link
                      className="font-medium text-[var(--color-accent)] hover:underline"
                      href={`/dashboard/stores/${store.id}`}
                    >
                      {store.name}
                    </Link>
                    <span className="text-[var(--color-muted)]">{store.slug}</span>
                    <StatusBadge status={store.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Members">
            {tenant.memberships.length === 0 ? (
              <EmptyState title="No members" />
            ) : (
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {tenant.memberships.map((membership) => (
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

          <Card
            title="Recent audit activity"
            actions={
              <Link
                href={`/dashboard/audit-logs?tenantId=${tenant.id}`}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                View all
              </Link>
            }
          >
            {tenant.recentAuditLogs.length === 0 ? (
              <EmptyState title="No audit entries" />
            ) : (
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {tenant.recentAuditLogs.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="font-medium">{entry.action}</span>
                    <span className="text-[var(--color-muted)]">
                      {entry.user?.email ?? 'system'}
                    </span>
                    <span className="text-xs text-[var(--color-muted)]">
                      {formatDateTime(entry.createdAt)}
                    </span>
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
        title={pending === 'SUSPENDED' ? 'Suspend this tenant?' : 'Activate this tenant?'}
        description={
          pending === 'SUSPENDED'
            ? 'Every store under this tenant stops serving requests. Store rows keep their own status so reactivating restores the previous storefront state.'
            : 'Stores return to serving requests using their own saved status.'
        }
        confirmLabel="Update status"
        onConfirm={() => void applyStatus()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
