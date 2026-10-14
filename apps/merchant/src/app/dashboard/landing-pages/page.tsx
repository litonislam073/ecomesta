'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';
import {
  LANDING_TEMPLATES,
  LANDING_TEMPLATE_LIST,
  type LandingPageDetail,
  type LandingPageSummary,
  type LandingPagesUsage,
  type LandingTemplateKey,
} from '@ecomesta/utils';
import { Button } from '@ecomesta/ui';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { landingPageUrl } from '@/components/landing/landing-utils';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

function LockedBanner() {
  return (
    <section aria-labelledby="landing-locked" className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#f1d9a6] bg-[#fff8ea] p-5">
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fde9bd] text-lg">
        🔒
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="landing-locked" className="font-semibold">
          Landing pages are available on the Growth and Business plans
        </h2>
        <p className="mt-0.5 text-sm text-[var(--color-muted)]">
          Build campaign pages for your ads, with their own order form. Growth includes 5 pages; Business is unlimited.
        </p>
      </div>
      <Link href="/dashboard/billing" className="inline-flex h-10 items-center rounded-md bg-[#8a5a00] px-4 text-sm font-semibold text-white hover:bg-[#6f4800]">
        Upgrade in Plan &amp; billing →
      </Link>
    </section>
  );
}

function TemplateCard({ templateKey, selected, onSelect }: { templateKey: LandingTemplateKey; selected: boolean; onSelect: () => void }) {
  const template = LANDING_TEMPLATES[templateKey];
  return (
    <label
      className={`block cursor-pointer overflow-hidden rounded-xl border-2 bg-white transition ${selected ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20' : 'border-[var(--color-border)] hover:border-[#b8c4bf]'}`}
    >
      <input type="radio" name="landing-template" value={templateKey} checked={selected} onChange={onSelect} className="sr-only" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={template.previewImage} alt="" className="aspect-[4/3] w-full bg-[#eef1f4] object-cover object-top" />
      <span className="block p-3">
        <span className="block font-semibold">{template.name}</span>
        <span className="block text-xs font-medium text-[var(--color-accent)]">{template.tagline}</span>
        <span className="mt-1 block text-xs text-[var(--color-muted)]">{template.description}</span>
      </span>
    </label>
  );
}

function CreateDialog({ storeId, onClose, onCreated }: { storeId: string; onClose: () => void; onCreated: (page: LandingPageDetail) => void }) {
  const titleId = useId();
  const [template, setTemplate] = useState<LandingTemplateKey>('single_product');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length < 2) {
      setError('Give the page a name (at least 2 characters).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ success: true; data: LandingPageDetail }>(`/stores/${storeId}/landing-pages`, { title: title.trim(), template });
      onCreated(result.data);
    } catch (err) {
      setError(humanApiError(err, 'Could not create the page.'));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6" role="presentation">
      <form role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={(e) => void create(e)} className="w-full max-w-5xl rounded-2xl bg-[var(--color-bg)] p-4 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-semibold">
              New landing page
            </h2>
            <p className="text-sm text-[var(--color-muted)]">Pick a design. It starts with demo text and pictures you can change.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="rounded-md px-2 text-xl text-[var(--color-muted)] hover:bg-[#f1f4f7]">
            ×
          </button>
        </div>
        <fieldset className="mt-4">
          <legend className="sr-only">Design</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {LANDING_TEMPLATE_LIST.map((t) => (
              <TemplateCard key={t.key} templateKey={t.key} selected={template === t.key} onSelect={() => setTemplate(t.key)} />
            ))}
          </div>
        </fieldset>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="min-w-[240px] flex-1 space-y-1 text-sm">
            <span className="block font-medium">Page name</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Eid offer 2026" maxLength={120} autoFocus />
            <span className="block text-xs text-[var(--color-muted)]">For you; it also makes the page address. You can change both later.</span>
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : `Create with ${LANDING_TEMPLATES[template].name}`}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function LandingPagesContent() {
  const router = useRouter();
  const { selectedStoreId, selectedStore } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();
  const [pages, setPages] = useState<LandingPageSummary[] | null>(null);
  const [usage, setUsage] = useState<LandingPagesUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<LandingPageSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!selectedStoreId) return;
    setError(null);
    try {
      const result = await api.get<{ success: true; data: { items: LandingPageSummary[]; usage: LandingPagesUsage } }>(`/stores/${selectedStoreId}/landing-pages`);
      setPages(result.data.items);
      setUsage(result.data.usage);
    } catch (err) {
      setError(humanApiError(err, 'Could not load your landing pages.'));
    }
  }, [selectedStoreId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!selectedStoreId) {
    return <EmptyState title="Select a store" description="Choose a store from the header to manage its landing pages." />;
  }

  const atLimit = !!usage && usage.max !== null && usage.used >= usage.max;
  const canCreate = canWrite && !!usage?.allowed && !atLimit;

  async function remove() {
    if (!deleting || !selectedStoreId) return;
    setBusy(true);
    try {
      await api.delete(`/stores/${selectedStoreId}/landing-pages/${deleting.id}`);
      pushToast(`"${deleting.title}" deleted.`, 'success');
      setDeleting(null);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not delete the page.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Landing pages</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">One-page offers for your ads, each with its own order form. Orders arrive in Orders like any other.</p>
        </div>
        {usage?.allowed ? (
          <span className="text-sm text-[var(--color-muted)]" data-testid="landing-usage">
            {usage.max === null ? `${usage.used} pages · unlimited on your plan` : `${usage.used} of ${usage.max} pages used`}
          </span>
        ) : null}
        {usage?.allowed && canWrite ? (
          <Button onClick={() => setCreating(true)} disabled={!canCreate}>
            + New landing page
          </Button>
        ) : null}
      </div>

      {usage && !usage.allowed ? <LockedBanner /> : null}
      {atLimit && usage?.allowed ? (
        <p role="status" className="rounded-lg border border-[#f1d9a6] bg-[#fff8ea] px-4 py-3 text-sm">
          You have used all {usage.max} landing pages on your plan. Delete one you no longer use, or{' '}
          <Link href="/dashboard/billing" className="font-semibold text-[#8a5a00] underline">
            upgrade to Business
          </Link>{' '}
          for unlimited pages.
        </p>
      ) : null}

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!error && pages === null ? <LoadingState label="Loading landing pages" /> : null}

      {pages && pages.length === 0 && usage?.allowed ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="text-lg font-semibold">No landing pages yet</p>
          <p className="mx-auto mt-1 max-w-lg text-sm text-[var(--color-muted)]">Choose from 5 designs — single product, festival sale, fashion lookbook, food &amp; health or a story sales page — then pick your products and publish.</p>
          {canCreate ? (
            <Button className="mt-4" onClick={() => setCreating(true)}>
              Create your first page
            </Button>
          ) : null}
        </div>
      ) : null}

      {pages && pages.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pages.map((page) => {
            const template = LANDING_TEMPLATES[page.template];
            const url = selectedStore ? landingPageUrl(selectedStore.slug, page.slug) : null;
            return (
              <li key={page.id} className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={template.previewImage} alt="" className="aspect-[16/9] w-full bg-[#eef1f4] object-cover object-top" />
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 font-semibold leading-snug">{page.title}</h2>
                    <Badge tone={page.status === 'PUBLISHED' ? 'success' : 'neutral'}>{page.status === 'PUBLISHED' ? 'Live' : 'Draft'}</Badge>
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">
                    {template.name} · {page.orderCount} {page.orderCount === 1 ? 'order' : 'orders'}
                    {page.hasUnpublishedChanges ? ' · unpublished changes' : ''}
                  </p>
                  {url ? <p className="truncate text-xs text-[var(--color-muted)]">/lp/{page.slug}</p> : null}
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Link href={`/dashboard/landing-pages/${page.id}`} className="inline-flex h-9 items-center rounded-md bg-[var(--color-accent)] px-3 text-sm font-semibold text-white hover:opacity-90">
                      {canWrite ? 'Edit' : 'Open'}
                    </Link>
                    {page.status === 'PUBLISHED' && url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-md border border-[var(--color-border)] px-3 text-sm font-medium hover:bg-[#f1f4f7]">
                        View ↗
                      </a>
                    ) : null}
                    {canWrite ? (
                      <button type="button" onClick={() => setDeleting(page)} className="ml-auto inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-[var(--color-danger)] hover:bg-[#fdecec]">
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {creating && selectedStoreId ? (
        <CreateDialog
          storeId={selectedStoreId}
          onClose={() => setCreating(false)}
          onCreated={(page) => {
            setCreating(false);
            router.push(`/dashboard/landing-pages/${page.id}`);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        busy={busy}
        danger
        safeDefault
        title={`Delete "${deleting?.title ?? ''}"?`}
        description="The page and its link stop working. Orders placed from it stay in Orders."
        confirmLabel="Delete page"
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

export default function LandingPagesPage() {
  return (
    <StoreScoped>
      <LandingPagesContent />
    </StoreScoped>
  );
}
