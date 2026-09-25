'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { InventoryItem, InventoryMovement, OffsetPageMeta } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { ApiError, api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useStoreContext } from '@/lib/store-context';

function MovementsContent() {
  const params = useParams<{ inventoryItemId: string }>();
  const inventoryItemId = params.inventoryItemId;
  const { selectedStoreId } = useStoreContext();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedStoreId || !inventoryItemId) {
      setItem(null);
      setMovements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [itemRes, movRes] = await Promise.all([
        api.get<{ success: true; data: InventoryItem }>(
          `/stores/${selectedStoreId}/inventory/${inventoryItemId}`,
        ),
        api.get<{
          success: true;
          data: { items: InventoryMovement[]; meta: OffsetPageMeta };
        }>(
          `/stores/${selectedStoreId}/inventory/${inventoryItemId}/movements?page=${page}&limit=20`,
        ),
      ]);
      setItem(itemRes.data);
      setMovements(movRes.data.items);
      setMeta(movRes.data.meta);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('Inventory item not found in this store.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have permission to view these movements.');
      } else {
        setError(humanApiError(err, 'Failed to load movements'));
      }
      setItem(null);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, inventoryItemId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header to view movement history."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/inventory"
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          ← Inventory
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Movement history
        </h1>
        {item ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {item.product?.name ?? item.productId}
            {item.variant ? ` · ${item.variant.name}` : ''}
            {' · '}
            On-hand {item.quantity} · Available {item.availableQuantity}
          </p>
        ) : null}
      </div>

      {loading ? <LoadingState label="Loading movements" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && movements.length === 0 ? (
        <EmptyState
          title="No movements yet"
          description="Adjustments and other stock changes will appear here."
        />
      ) : null}

      {!loading && !error && movements.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Quantity</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    {new Date(m.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{m.type}</td>
                  <td className="px-4 py-3">{m.quantity}</td>
                  <td className="px-4 py-3">{m.note ?? '—'}</td>
                  <td className="px-4 py-3">
                    {m.referenceType || m.referenceId
                      ? `${m.referenceType ?? ''} ${m.referenceId ?? ''}`.trim()
                      : '—'}
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

      <Link href="/dashboard/inventory">
        <Button variant="secondary">Back to inventory</Button>
      </Link>
    </div>
  );
}

export default function InventoryMovementsPage() {
  return (
    <StoreScoped>
      <MovementsContent />
    </StoreScoped>
  );
}
