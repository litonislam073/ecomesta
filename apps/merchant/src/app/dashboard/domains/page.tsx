'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StoreDomain, StoreDomainList } from '@ecomesta/types';
import { AddDomainForm } from '@/components/domains/add-domain-form';
import { DomainList, type DomainAction } from '@/components/domains/domain-list';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

type DestructiveAction = Extract<DomainAction, 'disable' | 'delete'>;

const DESTRUCTIVE: Record<
  DestructiveAction,
  { title: string; description: string; confirmLabel: string }
> = {
  disable: {
    title: 'Disable this domain?',
    description:
      'The storefront stops answering on this hostname. If it was primary, the platform subdomain takes over. DNS records stay untouched.',
    confirmLabel: 'Disable domain',
  },
  delete: {
    title: 'Delete this domain?',
    description:
      'The hostname is released and can be claimed by another store. Verification has to be repeated if you add it back.',
    confirmLabel: 'Delete domain',
  },
};

const SUCCESS_MESSAGES: Record<DomainAction, string> = {
  verify: 'Domain verified',
  activate: 'Domain activated',
  'set-primary': 'Primary domain updated',
  disable: 'Domain disabled',
  delete: 'Domain deleted',
  'regenerate-verification': 'New verification token issued — copy it now',
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function DomainsPage() {
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();

  const [data, setData] = useState<StoreDomainList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyDomainId, setBusyDomainId] = useState<string | null>(null);
  /** Raw TXT values returned once from create/regenerate — merged into list UI. */
  const [revealedTokens, setRevealedTokens] = useState<Record<string, string>>(
    {},
  );
  const [pending, setPending] = useState<{
    action: DestructiveAction;
    domain: StoreDomain;
  } | null>(null);

  const load = useCallback(async () => {
    if (!selectedStoreId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ success: true; data: StoreDomainList }>(
        `/stores/${selectedStoreId}/domains`,
      );
      setData(result.data);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load domains'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addDomain(hostname: string): Promise<boolean> {
    if (!selectedStoreId || !canWrite) {
      return false;
    }
    setAdding(true);
    try {
      const created = await api.post<{ success: true; data: StoreDomain }>(
        `/stores/${selectedStoreId}/domains`,
        { hostname },
      );
      const raw = created.data.verification?.recordValue;
      if (raw) {
        setRevealedTokens((prev) => ({
          ...prev,
          [created.data.id]: raw,
        }));
      }
      pushToast('Domain added — copy the DNS token now (shown once)', 'success');
      await load();
      return true;
    } catch (err) {
      pushToast(errorMessage(err, 'Failed to add domain'), 'error');
      return false;
    } finally {
      setAdding(false);
    }
  }

  const runAction = useCallback(
    async (action: DomainAction, domain: StoreDomain) => {
      if (!selectedStoreId || !canWrite) {
        return;
      }
      setBusyDomainId(domain.id);
      try {
        const base = `/stores/${selectedStoreId}/domains/${domain.id}`;
        if (action === 'delete') {
          await api.delete(base);
          setRevealedTokens((prev) => {
            const next = { ...prev };
            delete next[domain.id];
            return next;
          });
        } else if (action === 'regenerate-verification') {
          const result = await api.post<{ success: true; data: StoreDomain }>(
            `${base}/regenerate-verification`,
          );
          const raw = result.data.verification?.recordValue;
          if (raw) {
            setRevealedTokens((prev) => ({ ...prev, [domain.id]: raw }));
          }
        } else {
          await api.post(`${base}/${action}`);
          if (action === 'verify' || action === 'activate') {
            setRevealedTokens((prev) => {
              const next = { ...prev };
              delete next[domain.id];
              return next;
            });
          }
        }
        pushToast(SUCCESS_MESSAGES[action], 'success');
        await load();
      } catch (err) {
        pushToast(errorMessage(err, `Could not ${action} this domain`), 'error');
        // A failed verify flips the row to FAILED server-side, so refresh.
        if (action === 'verify') {
          await load();
        }
      } finally {
        setBusyDomainId(null);
      }
    },
    [selectedStoreId, canWrite, pushToast, load],
  );

  function onAction(action: DomainAction, domain: StoreDomain) {
    if (action === 'disable' || action === 'delete') {
      setPending({ action, domain });
      return;
    }
    void runAction(action, domain);
  }

  async function confirmPending() {
    if (!pending) {
      return;
    }
    const { action, domain } = pending;
    setPending(null);
    await runAction(action, domain);
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store to manage its storefront domains."
      />
    );
  }

  const domains = (data?.items ?? []).map((domain) => {
    const raw = revealedTokens[domain.id];
    if (!raw || !domain.verification) {
      return domain;
    }
    return {
      ...domain,
      verification: {
        ...domain.verification,
        recordValue: raw,
      },
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Domains</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Every store gets a free{' '}
          <code className="font-mono">
            {data ? `{slug}.${data.meta.platformRootDomain}` : 'platform'}
          </code>{' '}
          subdomain. Attach your own domain to serve the storefront from it.
        </p>
        {data ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Canonical storefront host:{' '}
            <code className="font-mono text-[var(--color-ink)]">
              {data.meta.canonicalHostname}
            </code>
          </p>
        ) : null}
        {!canWrite ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            You have read-only access to this store&apos;s domains.
          </p>
        ) : null}
      </div>

      {canWrite ? <AddDomainForm busy={adding} onSubmit={addDomain} /> : null}

      {loading ? <LoadingState label="Loading domains…" /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && domains.length === 0 ? (
        <EmptyState
          title="No domains yet"
          description="The platform subdomain is provisioned on first load. Refresh if it has not appeared."
        />
      ) : null}
      {!loading && !error && domains.length > 0 ? (
        <DomainList
          domains={domains}
          canWrite={canWrite}
          busyDomainId={busyDomainId}
          onAction={onAction}
        />
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        title={pending ? DESTRUCTIVE[pending.action].title : ''}
        description={
          pending
            ? `${pending.domain.hostname} — ${DESTRUCTIVE[pending.action].description}`
            : undefined
        }
        confirmLabel={pending ? DESTRUCTIVE[pending.action].confirmLabel : 'Confirm'}
        danger
        busy={busyDomainId !== null}
        onConfirm={() => void confirmPending()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
