'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoCatalogImportResult, DemoCatalogStatus } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import {
  ProvisioningBar,
  ProvisioningSteps,
  type ProvisioningStep,
} from '@/components/onboarding/provisioning-steps';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';

function importSteps(phase: 'importing' | 'finalizing'): ProvisioningStep[] {
  return [
    { label: 'Store created', state: 'done' },
    {
      label: 'Importing demo catalog',
      state: phase === 'importing' ? 'current' : 'done',
      detail: 'Sample categories, products and starting stock are added together.',
    },
    {
      label: 'Finalizing your catalog',
      state: phase === 'importing' ? 'pending' : 'current',
      detail: 'Refreshing your products.',
    },
  ];
}

export function DemoCatalogCta({
  storeId,
  canWrite,
  onImported,
}: {
  storeId: string;
  canWrite: boolean;
  onImported?: () => void | Promise<void>;
}) {
  const { pushToast } = useToast();
  const [available, setAvailable] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** importing = POST …/demo-catalog/import in flight (one transaction); finalizing = onImported refresh. */
  const [phase, setPhase] = useState<'idle' | 'importing' | 'finalizing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const importing = phase !== 'idle';

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get<{ success: true; data: DemoCatalogStatus }>(
        `/stores/${storeId}/demo-catalog/status`,
      );
      setAvailable(res.data?.available === true);
    } catch {
      setAvailable(false);
    }
  }, [storeId]);

  useEffect(() => {
    setAvailable(false);
    setError(null);
    void loadStatus();
  }, [loadStatus]);

  async function onConfirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setConfirmOpen(false);
    setPhase('importing');
    setError(null);
    try {
      await api.post<{ success: true; data: DemoCatalogImportResult }>(
        `/stores/${storeId}/demo-catalog/import`,
      );
      setPhase('finalizing');
      try {
        await onImported?.();
      } catch {
        // The import committed; only the page refresh failed.
      }
      setAvailable(false);
      pushToast('Sample products added successfully.', 'success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAvailable(false);
        pushToast('Sample products have already been added to this store.', 'error');
        await loadStatus();
      } else {
        setError('Could not import sample products. Please try again.');
      }
    } finally {
      setPhase('idle');
      inFlight.current = false;
    }
  }

  if (!available || !canWrite) {
    return null;
  }

  return (
    <section
      aria-labelledby="demo-catalog-title"
      className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <h2 id="demo-catalog-title" className="font-medium">
        {importing ? 'Setting up your demo store' : 'Sample Store Products'}
      </h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {importing
          ? "We're adding a few sample products so you can explore your store."
          : 'Want to preview your storefront with sample products?'}
      </p>
      {importing ? (
        <div className="mt-4 space-y-4">
          <div>
            <ProvisioningBar steps={importSteps(phase)} />
            <p role="status" aria-live="polite" className="mt-2 text-sm text-[var(--color-muted)]">
              {phase === 'importing'
                ? 'Importing demo catalog...'
                : 'Demo catalog imported. Finalizing your catalog...'}
            </p>
          </div>
          <ProvisioningSteps label="Demo catalog progress" steps={importSteps(phase)} />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => setConfirmOpen(true)} disabled={importing}>
          {importing ? 'Importing sample products…' : 'Import Demo Products'}
        </Button>
        <p className="text-xs text-[var(--color-muted)]">
          You can edit or remove these sample products anytime.
        </p>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        title="Add sample products to your store?"
        description="These products are sample content for preview purposes. You can edit or delete them later."
        confirmLabel="Import Demo Products"
        busy={importing}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void onConfirm()}
      />
    </section>
  );
}
