'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { useAuth } from '@/lib/auth-context';
import { useStoreContext } from '@/lib/store-context';

export default function DashboardHomePage() {
  const { user, loading: authLoading } = useAuth();
  const { selectedStore, stores, loading: storesLoading } = useStoreContext();

  if (authLoading || storesLoading) {
    return <LoadingState label="Loading dashboard" />;
  }

  const storeRole =
    user?.memberships.stores.find(
      (membership) => membership.storeId === selectedStore?.id,
    )?.role ??
    user?.memberships.tenants[0]?.role ??
    '—';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Dashboard
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Account and store context for your merchant workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Selected store">
          {selectedStore ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[var(--color-muted)]">Name</dt>
                <dd className="font-medium">{selectedStore.name}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-[var(--color-muted)]">Status</dt>
                <dd>
                  <Badge tone="success">{selectedStore.status}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Currency</dt>
                <dd className="font-medium">{selectedStore.currency}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Timezone</dt>
                <dd className="font-medium">{selectedStore.timezone}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              No store is selected. Create or join a store to continue.
            </p>
          )}
        </Card>

        <Card title="Your account">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">Email</dt>
              <dd className="font-medium">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Role context</dt>
              <dd className="font-medium">{storeRole}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Accessible stores</dt>
              <dd className="font-medium">{stores.length}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Metrics">
          <p className="text-sm text-[var(--color-muted)]">
            Sales and order metrics will appear here once order APIs are available.
            No placeholder numbers are shown.
          </p>
        </Card>
      </div>
    </div>
  );
}
