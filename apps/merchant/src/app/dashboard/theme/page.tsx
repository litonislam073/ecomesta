'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { StoreTheme, ThemeListItem } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { formatBdt } from '@ecomesta/utils';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { ThemePurchaseDialog } from '@/components/theme/theme-purchase-dialog';
import { ThemeThumbnail } from '@/components/theme/theme-thumbnail';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';
import { storefrontUrl } from '@/lib/storefront-url';

const EDITOR = '/dashboard/theme/editor';

function AccessBadge({ theme }: { theme: ThemeListItem }) {
  const pill = 'rounded-full px-2 py-0.5 text-[11px] font-semibold';
  if (theme.premium) {
    const price = theme.priceBdt ? ` · ${formatBdt(Number(theme.priceBdt))}` : '';
    if (theme.access === 'included') return <span className={`${pill} bg-[#e3f1ec] text-[#1b6b53]`}>Premium · included</span>;
    if (theme.access === 'owned') return <span className={`${pill} bg-[#e3f1ec] text-[#1b6b53]`}>Premium · purchased</span>;
    if (theme.access === 'pending') return <span className={`${pill} bg-[#fff6e0] text-[#8a5a00]`}>Payment under review</span>;
    return <span className={`${pill} bg-gradient-to-r from-[#f26522] to-[#e0891b] text-white`}>Premium{price}</span>;
  }
  if (theme.access === 'locked') return <span className={`${pill} bg-[#f1f4f7] text-[var(--color-muted)]`}>Growth & Business</span>;
  return <span className={`${pill} bg-[#f1f4f7] text-[var(--color-muted)]`}>Free</span>;
}

/**
 * The theme the storefront shows: the published one, or the default theme
 * while nothing is published (the storefront falls back to it).
 */
function activeThemeOf(storeTheme: StoreTheme | null, themes: ThemeListItem[]): ThemeListItem | null {
  if (!storeTheme) return null;
  const liveId = storeTheme.liveTheme?.id;
  if (liveId) return themes.find((theme) => theme.id === liveId) ?? null;
  return themes.find((theme) => theme.slug === 'default') ?? themes.find((theme) => theme.id === storeTheme.theme.id) ?? null;
}

function ThemeLibrary() {
  const { selectedStoreId, selectedStore } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();
  const router = useRouter();
  const [storeTheme, setStoreTheme] = useState<StoreTheme | null>(null);
  const [themes, setThemes] = useState<ThemeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [activating, setActivating] = useState<ThemeListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [buying, setBuying] = useState<ThemeListItem | null>(null);

  const load = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    setError(null);
    try {
      const [themeResult, listResult] = await Promise.all([
        api.get<{ success: true; data: StoreTheme }>(`/stores/${selectedStoreId}/theme`),
        api.get<{ success: true; data: { items: ThemeListItem[] } }>(`/stores/${selectedStoreId}/themes`),
      ]);
      setStoreTheme(themeResult.data);
      setThemes(listResult.data.items);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load themes'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = activeThemeOf(storeTheme, themes);

  /** The editor works on the selected theme: make it the active one first if needed. */
  async function customize() {
    if (!selectedStoreId || !active) return;
    if (storeTheme?.theme.id === active.id) {
      router.push(EDITOR);
      return;
    }
    setOpening(true);
    try {
      await api.patch(`/stores/${selectedStoreId}/theme`, { themeId: active.id });
      router.push(EDITOR);
    } catch (err) {
      pushToast(humanApiError(err, 'Could not open the editor'), 'error');
      setOpening(false);
    }
  }

  /** Puts another theme on the store: select it, then publish it. */
  async function activate() {
    if (!selectedStoreId || !activating) return;
    setBusy(true);
    try {
      if (storeTheme?.theme.id !== activating.id) {
        await api.patch(`/stores/${selectedStoreId}/theme`, { themeId: activating.id });
      }
      await api.post(`/stores/${selectedStoreId}/theme/publish`);
      pushToast(`${activating.name} is now live on your store.`, 'success');
      setActivating(null);
      await load();
    } catch (err) {
      pushToast(humanApiError(err, `Could not activate ${activating.name}`), 'error');
      setActivating(null);
    } finally {
      setBusy(false);
    }
  }

  if (!selectedStoreId) {
    return <EmptyState title="Select a store" description="Choose a store from the header to manage its theme." />;
  }

  const live = storeTheme?.liveTheme ?? null;
  const storeLink = selectedStore ? storefrontUrl(selectedStore.slug) : null;
  const others = themes.filter((theme) => theme.id !== active?.id);
  // Edits saved in the editor but not published yet (only for the active theme's draft).
  const unpublished = Boolean(storeTheme?.hasUnpublishedChanges && storeTheme.theme.id === active?.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Themes</h1>
        <p className="mt-2 text-[var(--color-muted)]">The active theme is what shoppers see. Customize it, or activate another one.</p>
      </div>

      {loading ? <LoadingState label="Loading themes" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && active ? (
        <>
          <section aria-labelledby="current-theme" className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
            <div className="bg-[#eef1f4] p-3 sm:p-4">
              <ThemeThumbnail theme={active} large />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1b6b53]">
                  <span aria-hidden="true">● </span>Active theme
                </p>
                <h2 id="current-theme" className="mt-1 text-xl font-semibold">{active.name}</h2>
                <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                  {live?.publishedAt ? `Live since ${new Date(live.publishedAt).toLocaleString()}.` : 'Shown on your store.'}
                  {unpublished ? ' You have edits that are not published yet.' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={opening} onClick={() => void customize()}>
                  {opening ? 'Opening…' : 'Customize'}
                </Button>
                {storeLink ? (
                  <a
                    href={storeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--color-bg)]"
                  >
                    View store <span aria-hidden="true">&nbsp;↗</span>
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          <section aria-labelledby="theme-library" className="space-y-4">
            <div>
              <h2 id="theme-library" className="text-lg font-semibold">Theme library</h2>
              <p className="text-sm text-[var(--color-muted)]">Activate a theme to put it on your store. You can customize it after.</p>
            </div>
            {others.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No other themes are available yet.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {others.map((theme) => {
                  const usable = theme.access !== 'locked' && theme.access !== 'pending';
                  return (
                    <li key={theme.id} className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                      <ThemeThumbnail theme={theme} />
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">{theme.name}</h3>
                        <AccessBadge theme={theme} />
                      </div>
                      {theme.description ? <p className="mt-1 flex-1 text-sm text-[var(--color-muted)]">{theme.description}</p> : <div className="flex-1" />}
                      {theme.purchase?.status === 'REJECTED' && theme.access === 'locked' ? (
                        <p role="alert" className="mt-2 rounded-md bg-[#fdf3ee] px-2.5 py-1.5 text-xs text-[#a3441f]">
                          Your last payment was not approved{theme.purchase.rejectionReason ? `: ${theme.purchase.rejectionReason}` : '.'}
                        </p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {usable && canWrite ? (
                          <Button variant="secondary" onClick={() => setActivating(theme)}>
                            Activate
                          </Button>
                        ) : null}
                        {!usable ? (
                          <Link
                            href={`${EDITOR}?try=${theme.id}`}
                            className="inline-flex items-center rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg)]"
                          >
                            Preview
                          </Link>
                        ) : null}
                        {theme.access === 'locked' && theme.premium && canWrite ? (
                          <Button onClick={() => setBuying(theme)}>
                            Buy for {theme.priceBdt ? formatBdt(Number(theme.priceBdt)) : 'a one-time price'}
                          </Button>
                        ) : null}
                        {theme.access === 'locked' && !theme.premium ? (
                          <Link href="/dashboard/billing" className="inline-flex items-center px-1 text-sm font-medium text-[var(--color-accent)] hover:underline">
                            Upgrade plan
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <ConfirmDialog
        open={activating !== null}
        busy={busy}
        title={activating ? `Activate ${activating.name}?` : 'Activate theme?'}
        description={
          activating
            ? `${activating.name} replaces ${active?.name ?? 'your current theme'} on your store right away. You can switch back any time.`
            : undefined
        }
        confirmLabel="Activate"
        onConfirm={() => void activate()}
        onCancel={() => setActivating(null)}
      />

      {buying && selectedStoreId ? (
        <ThemePurchaseDialog
          storeId={selectedStoreId}
          theme={buying}
          onClose={() => setBuying(null)}
          onSubmitted={(purchase) => {
            setBuying(null);
            setThemes((items) =>
              items.map((item) =>
                item.id === purchase.theme.id
                  ? {
                      ...item,
                      access: 'pending',
                      purchase: { status: purchase.status, rejectionReason: null, transactionId: purchase.transactionId, createdAt: purchase.createdAt },
                    }
                  : item,
              ),
            );
            pushToast(`Payment submitted. ${purchase.theme.name} unlocks once our team confirms it.`, 'success');
          }}
        />
      ) : null}
    </div>
  );
}

export default function ThemeLibraryPage() {
  return (
    <StoreScoped>
      <ThemeLibrary />
    </StoreScoped>
  );
}
