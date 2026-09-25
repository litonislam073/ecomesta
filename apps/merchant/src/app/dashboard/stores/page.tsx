'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useStoreContext } from '@/lib/store-context';

export default function StoresPage() {
  const { stores, selectedStoreId, loading, error, setSelectedStoreId } =
    useStoreContext();

  if (loading) {
    return <LoadingState label="Loading stores" />;
  }

  if (error) {
    return <EmptyState title="Unable to load stores" description={error} />;
  }

  if (stores.length === 0) {
    return (
      <EmptyState
        title="No accessible stores"
        description="Onboard a store from the API or ask an owner to invite you."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Stores
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Stores returned by GET /api/v1/stores for your account.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {stores.map((store) => (
          <Card
            key={store.id}
            title={store.name}
            actions={
              selectedStoreId === store.id ? (
                <Badge tone="success">Selected</Badge>
              ) : (
                <button
                  type="button"
                  className="text-sm text-[var(--color-accent)] hover:underline"
                  onClick={() => setSelectedStoreId(store.id)}
                >
                  Select
                </button>
              )
            }
          >
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[var(--color-muted)]">Slug</dt>
                <dd>{store.slug}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Status</dt>
                <dd>{store.status}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Currency / timezone</dt>
                <dd>
                  {store.currency} · {store.timezone}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}
