'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  StoreTheme,
  StoreThemeConfig,
  ThemeListItem,
} from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { AnnouncementSection } from '@/components/theme/announcement-section';
import { BrandingSection } from '@/components/theme/branding-section';
import { FooterSection } from '@/components/theme/footer-section';
import { HeaderSection } from '@/components/theme/header-section';
import { HeroSection } from '@/components/theme/hero-section';
import { HomepageBlockPanel } from '@/components/theme/homepage-block-panel';
import {
  LivePreview,
  PREVIEW_DEVICES,
  PREVIEW_PAGES,
  useThemePreviewSession,
  type PreviewDevice,
} from '@/components/theme/editor/live-preview';
import {
  SectionsList,
  SettingsList,
  isSectionPanel,
  panelTitle,
  type EditorPanel,
} from '@/components/theme/editor/sections-list';
import { ContentSectionPanel } from '@/components/theme/content-section-panel';
import { DealSectionPanel } from '@/components/theme/deal-section-panel';
import {
  effectiveHomeSections,
  isContentSection,
  sectionKey,
  withThemeSections,
} from '@/components/theme/homepage-block-panel';
import { formatBdt } from '@ecomesta/utils';
import { SeoSection } from '@/components/theme/seo-section';
import { ThemePurchaseDialog } from '@/components/theme/theme-purchase-dialog';
import { ThemeSelector } from '@/components/theme/theme-selector';
import {
  changedThemeConfig,
  invalidThemeColors,
  isThemeDraftDirty,
  sanitizeThemeConfig,
} from '@/components/theme/theme-utils';
import { useUnsavedChangesGuard } from '@/components/theme/use-unsaved-changes-guard';
import { TypographySection } from '@/components/theme/typography-section';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

type PendingAction = 'publish' | 'reset' | null;

/** The draft as the editor lists it (e.g. ShopEase's deal of the day as a section). */
function withSections(storeTheme: StoreTheme): StoreTheme {
  return { ...storeTheme, configuration: withThemeSections(storeTheme.configuration ?? {}, storeTheme.theme.slug) };
}

function ThemeContent() {
  const { selectedStoreId, selectedStore } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();

  const [storeTheme, setStoreTheme] = useState<StoreTheme | null>(null);
  const [themes, setThemes] = useState<ThemeListItem[]>([]);
  const [draft, setDraft] = useState<StoreThemeConfig>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [switchingThemeId, setSwitchingThemeId] = useState<string | null>(null);
  const [buying, setBuying] = useState<ThemeListItem | null>(null);
  // Editor chrome: sidebar tab and open panel, preview page and size, and
  // (on small screens) whether the settings or the preview is shown.
  const [tab, setTab] = useState<'sections' | 'settings'>('sections');
  const [panel, setPanel] = useState<EditorPanel | null>(null);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [page, setPage] = useState({ path: '/', n: 0 });
  const [currentPath, setCurrentPath] = useState('/');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');

  // Full-screen editor: the dashboard page behind it must not scroll.
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const openPanel = useCallback((next: EditorPanel | null) => {
    setPanel(next);
    if (next) setTab(isSectionPanel(next) ? 'sections' : 'settings');
  }, []);
  const selectFromPreview = useCallback(
    (section: string) => {
      if (isSectionPanel(section)) {
        openPanel(section);
        setMobileView('edit');
      }
    },
    [openPanel],
  );
  const pickPage = useCallback((path: string) => {
    if (!path) return;
    setPage((current) => ({ path, n: current.n + 1 }));
    setCurrentPath(path);
  }, []);
  // Remounts the sections that keep raw text buffers when a fresh config lands.
  const [formKey, setFormKey] = useState(0);

  // `storeTheme.configuration` is the last server-saved draft (the baseline);
  // `draft` is what the editor shows. Unsaved = the two differ.
  const applyStoreTheme = useCallback((loaded: StoreTheme) => {
    const next = withSections(loaded);
    setStoreTheme(next);
    setDraft(next.configuration ?? {});
    setFormKey((value) => value + 1);
  }, []);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const dirty =
    canWrite &&
    !loading &&
    storeTheme !== null &&
    isThemeDraftDirty(draft, storeTheme.configuration ?? {});
  const { prompt, askDiscard } = useUnsavedChangesGuard(dirty);
  // Try before you buy: the preview shows a theme the business cannot use yet.
  const [trying, setTrying] = useState<ThemeListItem | null>(null);
  const previewSession = useThemePreviewSession({
    storeId: selectedStoreId,
    themeId: trying?.id ?? storeTheme?.theme.id ?? null,
    draft: trying ? null : draft,
    enabled: !loading && storeTheme !== null,
    allowed: canWrite,
  });

  const load = useCallback(async () => {
    if (!selectedStoreId) {
      setStoreTheme(null);
      setThemes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [themeResult, listResult] = await Promise.all([
        api.get<{ success: true; data: StoreTheme }>(
          `/stores/${selectedStoreId}/theme`,
        ),
        api.get<{
          success: true;
          data: { items: ThemeListItem[] };
        }>(`/stores/${selectedStoreId}/themes`),
      ]);
      applyStoreTheme(themeResult.data);
      setThemes(listResult.data.items);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load theme settings'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, applyStoreTheme]);

  useEffect(() => {
    void load();
  }, [load]);

  // Opened from the theme library with ?try=<themeId>: preview that theme
  // (one the business cannot use yet) instead of editing.
  const tryRequested = useRef(false);
  useEffect(() => {
    if (tryRequested.current || themes.length === 0) return;
    tryRequested.current = true;
    const id = new URLSearchParams(window.location.search).get('try');
    const target = id ? themes.find((theme) => theme.id === id) : undefined;
    if (target && (target.access === 'locked' || target.access === 'pending')) {
      setTrying(target);
    }
  }, [themes]);

  function updateSection<K extends keyof StoreThemeConfig>(
    key: K,
    value: StoreThemeConfig[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  /** Saves the changed fields; resolves true only if the server accepted them. */
  async function saveDraft(): Promise<boolean> {
    if (!selectedStoreId) return false;
    // Never report a save while an entered color would be lost (TE-05): the
    // fields show what is wrong and the merchant's text stays on screen.
    const invalidColors = invalidThemeColors(draft, storeTheme?.configuration ?? {});
    if (invalidColors.length > 0) {
      pushToast(
        `Not saved. Fix the invalid color${invalidColors.length > 1 ? 's' : ''}: ${invalidColors.join(', ')}.`,
        'error',
      );
      return false;
    }
    const sent = draft;
    setSaving(true);
    try {
      const result = await api.patch<{ success: true; data: StoreTheme }>(
        `/stores/${selectedStoreId}/theme`,
        {
          configuration: changedThemeConfig(
            sanitizeThemeConfig(draft),
            storeTheme?.configuration ?? {},
          ),
        },
      );
      if (draftRef.current === sent) {
        // The server's merged draft (it may include another tab's edits).
        applyStoreTheme(result.data);
      } else {
        // Edited while saving: new baseline, but keep what is on screen.
        setStoreTheme(withSections(result.data));
      }
      pushToast('Draft saved', 'success');
      return true;
    } catch (err) {
      // Keep the merchant's edits; they stay unsaved and can be retried.
      pushToast(humanApiError(err, 'Could not save the draft'), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function selectTheme(themeId: string) {
    if (!selectedStoreId) return;
    // Switching loads the other theme's draft, which would drop unsaved edits.
    if (dirty && !(await askDiscard('switch'))) return;
    setSwitchingThemeId(themeId);
    try {
      await api.patch<{ success: true; data: StoreTheme }>(
        `/stores/${selectedStoreId}/theme`,
        { themeId },
      );
      pushToast('Theme selected as draft. Publish to make it live.', 'success');
      await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not switch theme'), 'error');
    } finally {
      setSwitchingThemeId(null);
    }
  }

  async function runPending() {
    if (!selectedStoreId || !pending) return;
    setBusy(true);
    try {
      // Publish what is on screen: unsaved edits are saved first, and nothing
      // is published if that save fails.
      if (pending === 'publish' && dirty && !(await saveDraft())) {
        setPending(null);
        return;
      }
      const result = await api.post<{ success: true; data: StoreTheme }>(
        `/stores/${selectedStoreId}/theme/${pending}`,
      );
      applyStoreTheme(result.data);
      pushToast(
        pending === 'publish' ? 'Theme published' : 'Draft reset to theme defaults',
        'success',
      );
      setPending(null);
    } catch (err) {
      pushToast(
        humanApiError(
          err,
          pending === 'publish'
            ? 'Could not publish the theme'
            : 'Could not reset the draft',
        ),
        'error',
      );
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store from the header to customize its storefront."
      />
    );
  }

  const disabled = !canWrite;
  // While another theme's draft is loading, edits would be replaced by it.
  const fieldsDisabled = disabled || switchingThemeId !== null;
  const onSettingsTab = panel !== null ? !isSectionPanel(panel) : tab === 'settings';
  const contentSections = effectiveHomeSections(draft.homepage)
    .map((section, index) => ({ section, key: sectionKey(section, index) }))
    .filter(({ section }) => isContentSection(section.type));
  // Buying needs the theme's price and a business that does not own it yet.
  const canBuyTrying = Boolean(trying && canWrite && trying.premium && trying.access === 'locked');
  const show = (id: EditorPanel) => (panel === id ? undefined : true);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#eef1f4] text-[var(--color-ink)]">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-white px-2 sm:gap-3 sm:px-3">
        <Link
          href="/dashboard/theme"
          aria-label="Exit theme editor"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[#f1f4f7]"
        >
          <span aria-hidden="true">←</span>
          <span className="hidden sm:inline">Exit</span>
        </Link>
        <span className="h-6 w-px bg-[var(--color-border)]" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold leading-tight">Theme</h1>
          <p className="truncate text-xs text-[var(--color-muted)]">
            {storeTheme ? storeTheme.theme.name : 'Loading…'}
            {storeTheme ? (storeTheme.isLive ? ' · Live' : ' · Draft') : ''}
          </p>
        </div>

        {storeTheme ? (
          <div className="mx-auto hidden items-center gap-2 lg:flex">
            <PagePicker value={currentPath} onChange={pickPage} />
            <DeviceToggle value={device} onChange={setDevice} />
          </div>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {dirty ? (
            <span
              data-testid="unsaved-indicator"
              className="hidden rounded-full border border-[var(--color-danger)] px-2 py-0.5 text-xs font-medium text-[var(--color-danger)] sm:inline"
            >
              Unsaved changes
            </span>
          ) : null}
          <div className="flex rounded-md border border-[var(--color-border)] p-0.5 lg:hidden" role="group" aria-label="Editor view">
            {(['edit', 'preview'] as const).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={mobileView === view}
                onClick={() => setMobileView(view)}
                className={`rounded px-2.5 py-1 text-xs font-semibold capitalize ${
                  mobileView === view ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-muted)]'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
          {trying ? (
            <>
              {canBuyTrying ? (
                <Button onClick={() => setBuying(trying)}>
                  Buy for {trying.priceBdt ? formatBdt(Number(trying.priceBdt)) : 'a one-time price'}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setTrying(null)}>
                Exit preview
              </Button>
            </>
          ) : canWrite && storeTheme ? (
            <>
              <Button variant="danger" className="hidden md:inline-flex" disabled={saving} onClick={() => setPending('reset')}>
                Reset
              </Button>
              <Button variant="secondary" disabled={saving} onClick={() => void saveDraft()}>
                {saving ? 'Saving…' : 'Save draft'}
              </Button>
              <Button disabled={saving} onClick={() => setPending('publish')}>
                Publish
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Theme settings"
          className={`${mobileView === 'edit' ? 'flex' : 'hidden'} w-full min-w-0 flex-col border-r border-[var(--color-border)] bg-white lg:flex lg:w-[340px] lg:shrink-0`}
        >
          {loading ? (
            <div className="p-4">
              <LoadingState label="Loading theme settings" />
            </div>
          ) : null}
          {!loading && error ? (
            <div className="p-4">
              <ErrorState message={error} onRetry={() => void load()} />
            </div>
          ) : null}

          {!loading && !error && storeTheme ? (
            <>
              <div className="space-y-2 border-b border-[var(--color-border)] px-3 py-2.5">
                {!canWrite ? (
                  <p role="status" className="rounded-md bg-[#f6f8f7] px-2.5 py-2 text-xs text-[var(--color-muted)]">
                    You have read-only access to this store, so theme changes are disabled.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]" data-testid="theme-status">
                  <span>
                    Editing: <span className="font-medium text-[var(--color-ink)]">{storeTheme.theme.name}</span>
                  </span>
                  <span>
                    Live on storefront:{' '}
                    <span className="font-medium text-[var(--color-ink)]">
                      {storeTheme.liveTheme ? storeTheme.liveTheme.name : 'Nothing published yet'}
                    </span>
                    {storeTheme.liveTheme?.publishedAt
                      ? ` · published ${new Date(storeTheme.liveTheme.publishedAt).toLocaleString()}`
                      : null}
                  </span>
                  {storeTheme.hasUnpublishedChanges ? (
                    <span className="rounded-full border border-[var(--color-border)] px-2 text-[var(--color-ink)]">
                      Unpublished changes
                    </span>
                  ) : null}
                </div>
              </div>

              {trying ? (
                <TryingPanel
                  theme={trying}
                  canBuy={canBuyTrying}
                  onBuy={() => setBuying(trying)}
                  onExit={() => setTrying(null)}
                />
              ) : null}

              {trying ? null : panel === null ? (
                <div role="tablist" aria-label="Editor" className="grid grid-cols-2 gap-1 border-b border-[var(--color-border)] p-2">
                  {(
                    [
                      ['sections', 'Sections'],
                      ['settings', 'Theme settings'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => setTab(id)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                        tab === id ? 'bg-[#e8f3ef] text-[var(--color-accent)]' : 'text-[var(--color-muted)] hover:bg-[#f1f4f7]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1 border-b border-[var(--color-border)] px-2 py-2">
                  <button
                    type="button"
                    onClick={() => openPanel(null)}
                    aria-label={onSettingsTab ? 'Back to theme settings' : 'Back to sections'}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-[#f1f4f7]"
                  >
                    <span aria-hidden="true">‹</span>
                  </button>
                  <p className="truncate text-sm font-semibold">{panelTitle(panel, draft)}</p>
                </div>
              )}

              <div className={trying ? 'hidden' : 'min-h-0 flex-1 overflow-y-auto'}>
                {panel === null ? (
                  <div className="p-2">
                    {tab === 'sections' ? (
                      <SectionsList draft={draft} disabled={fieldsDisabled} onOpen={openPanel} onChange={updateSection} />
                    ) : (
                      <SettingsList onOpen={openPanel} themeName={storeTheme.theme.name} />
                    )}
                  </div>
                ) : null}

                {/* Every panel stays mounted, so text being typed survives switching panels. */}
                <div className={panel === null ? 'hidden' : 'p-3'}>
                  <div hidden={show('theme')}>
                    <ThemeSelector
                      themes={themes}
                      selectedThemeId={storeTheme.theme.id}
                      liveThemeId={storeTheme.liveTheme?.id ?? null}
                      disabled={disabled || saving}
                      busyThemeId={switchingThemeId}
                      onSelect={(themeId) => void selectTheme(themeId)}
                      onBuy={setBuying}
                      onTry={(theme) => {
                        setTrying(theme);
                        setMobileView('preview');
                      }}
                    />
                  </div>
                  <div hidden={show('identity')}>
                    <BrandingSection
                      part="identity"
                      storeId={selectedStoreId}
                      value={draft.branding ?? {}}
                      saved={storeTheme.configuration?.branding}
                      disabled={fieldsDisabled}
                      onChange={(value) => updateSection('branding', value)}
                    />
                  </div>
                  <div hidden={show('colors')}>
                    <BrandingSection
                      part="colors"
                      storeId={selectedStoreId}
                      value={draft.branding ?? {}}
                      saved={storeTheme.configuration?.branding}
                      disabled={fieldsDisabled}
                      onChange={(value) => updateSection('branding', value)}
                    />
                  </div>
                  <div hidden={show('typography')}>
                    <TypographySection
                      value={draft.typography ?? {}}
                      disabled={fieldsDisabled}
                      onChange={(value) => updateSection('typography', value)}
                    />
                  </div>
                  <div hidden={show('announcement')}>
                    <AnnouncementSection
                      value={draft.announcement ?? {}}
                      saved={storeTheme.configuration?.announcement}
                      disabled={fieldsDisabled}
                      onChange={(value) => updateSection('announcement', value)}
                    />
                  </div>
                  <div hidden={show('header')}>
                    <HeaderSection
                      key={`header-${formKey}`}
                      value={draft.header ?? {}}
                      disabled={fieldsDisabled}
                      onChange={(value) => updateSection('header', value)}
                    />
                  </div>
                  <div hidden={show('hero')}>
                    <HeroSection
                      themeSlug={storeTheme.theme.slug}
                      storeId={selectedStoreId}
                      value={draft.hero ?? {}}
                      disabled={fieldsDisabled}
                      onChange={(value) => updateSection('hero', value)}
                    />
                  </div>
                  {(['featured_categories', 'featured_products'] as const).map((type) => (
                    <div key={type} hidden={show(type)}>
                      <HomepageBlockPanel
                        type={type}
                        active={panel === type}
                        storeId={selectedStoreId}
                        onCatalogChange={previewSession.refresh}
                        value={draft.homepage ?? {}}
                        disabled={fieldsDisabled}
                        onChange={(value) => updateSection('homepage', value)}
                      />
                    </div>
                  ))}
                  <div hidden={show('footer')}>
                    <FooterSection
                      key={`footer-${formKey}`}
                      value={draft.footer ?? {}}
                      disabled={fieldsDisabled}
                      onChange={(value) => updateSection('footer', value)}
                    />
                  </div>
                  <div hidden={show('seo')}>
                    <SeoSection />
                  </div>
                  {effectiveHomeSections(draft.homepage).some((section) => section.type === 'deal_of_day') ? (
                    <div hidden={show('deal_of_day')}>
                      <DealSectionPanel
                        active={panel === 'deal_of_day'}
                        storeId={selectedStoreId}
                        value={draft.homepage ?? {}}
                        disabled={fieldsDisabled}
                        onChange={(value) => updateSection('homepage', value)}
                      />
                    </div>
                  ) : null}
                  {contentSections.map(({ key }) => (
                    <div key={key} hidden={show(key as EditorPanel)}>
                      <ContentSectionPanel
                        sectionId={key}
                        storeId={selectedStoreId}
                        value={draft.homepage ?? {}}
                        disabled={fieldsDisabled}
                        onChange={(value) => updateSection('homepage', value)}
                        onRemove={() => {
                          const homepage = draft.homepage ?? {};
                          updateSection('homepage', {
                            ...homepage,
                            sections: effectiveHomeSections(homepage).filter((section, index) => sectionKey(section, index) !== key),
                          });
                          openPanel(null);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </aside>

        <main className={`${mobileView === 'preview' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col lg:flex`}>
          {storeTheme ? (
            <div className="flex items-center justify-center gap-2 border-b border-[var(--color-border)] bg-white px-2 py-2 lg:hidden">
              <PagePicker value={currentPath} onChange={pickPage} />
              <DeviceToggle value={device} onChange={setDevice} />
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-4">
            {storeTheme ? (
              <LivePreview
                storeSlug={selectedStore?.slug ?? null}
                storeName={selectedStore?.name ?? 'Your store'}
                draft={draft}
                device={device}
                page={page}
                onPathChange={setCurrentPath}
                session={previewSession}
                focusSection={!trying && panel && isSectionPanel(panel) ? panel : null}
                onSelectSection={selectFromPreview}
              />
            ) : null}
          </div>
        </main>
      </div>

      {buying && selectedStoreId ? (
        <ThemePurchaseDialog
          storeId={selectedStoreId}
          theme={buying}
          onClose={() => setBuying(null)}
          onSubmitted={(purchase) => {
            setBuying(null);
            setTrying((current) => (current ? { ...current, access: 'pending' } : current));
            setThemes((current) =>
              current.map((item) =>
                item.id === purchase.theme.id
                  ? {
                      ...item,
                      access: 'pending',
                      purchase: {
                        status: purchase.status,
                        rejectionReason: null,
                        transactionId: purchase.transactionId,
                        createdAt: purchase.createdAt,
                      },
                    }
                  : item,
              ),
            );
            pushToast(`Payment submitted. ${purchase.theme.name} unlocks once our team confirms it.`, 'success');
          }}
        />
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        danger={pending === 'reset'}
        title={
          pending === 'reset'
            ? 'Reset the draft to theme defaults?'
            : 'Publish this theme to the storefront?'
        }
        safeDefault={pending === 'reset'}
        description={
          pending === 'reset'
            ? 'Unsaved and saved draft changes are replaced with the theme defaults. The published storefront is untouched until you publish again.'
            : dirty
              ? `Your unsaved changes are saved first, then ${storeTheme?.theme.name ?? 'this theme'} and its draft become the live storefront.`
              : `${storeTheme?.theme.name ?? 'This theme'} and its saved draft become the live storefront.`
        }
        confirmLabel={
          pending === 'reset' ? 'Reset draft' : dirty ? 'Save and publish' : 'Publish theme'
        }
        onConfirm={() => void runPending()}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        open={prompt !== null}
        danger
        safeDefault
        title="Discard unsaved theme changes?"
        description={
          prompt?.reason === 'switch'
            ? 'Your theme changes have not been saved. Switching themes discards them. The live storefront is not affected.'
            : 'Your theme changes have not been saved. Leaving this page discards them.'
        }
        cancelLabel={prompt?.reason === 'switch' ? 'Keep editing' : 'Stay on page'}
        confirmLabel="Discard changes"
        onConfirm={() => prompt?.confirm()}
        onCancel={() => prompt?.cancel()}
      />
    </div>
  );
}

/** Sidebar while trying a theme: what it is, and how to get it. */
function TryingPanel({
  theme,
  canBuy,
  onBuy,
  onExit,
}: {
  theme: ThemeListItem;
  canBuy: boolean;
  onBuy: () => void;
  onExit: () => void;
}) {
  return (
    <div role="region" aria-label={`Previewing ${theme.name}`} className="space-y-4 p-4">
      <p className="inline-flex rounded-full bg-[#fff3e8] px-2.5 py-1 text-xs font-semibold text-[#b4530f]">Preview only</p>
      <div>
        <h2 className="text-lg font-semibold">{theme.name}</h2>
        {theme.description ? <p className="mt-1 text-sm text-[var(--color-muted)]">{theme.description}</p> : null}
      </div>
      <p className="text-sm text-[var(--color-ink)]">
        This is how your store looks with {theme.name} and its demo settings. Click around the preview — nothing on
        your live store changes.
      </p>
      {theme.access === 'pending' ? (
        <p role="status" className="rounded-md bg-[#fff7e6] px-3 py-2 text-xs text-[#8a5a00]">
          Your payment is under review. {theme.name} unlocks as soon as our team confirms it.
        </p>
      ) : theme.premium ? (
        <p className="text-sm text-[var(--color-muted)]">
          {theme.priceBdt ? `One-time ${formatBdt(Number(theme.priceBdt))}` : 'One-time payment'}, or included in the
          Business plan.
        </p>
      ) : (
        <p className="text-sm text-[var(--color-muted)]">Available on a higher plan.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {canBuy ? <Button onClick={onBuy}>Buy for {theme.priceBdt ? formatBdt(Number(theme.priceBdt)) : 'a one-time price'}</Button> : null}
        {!theme.premium && theme.access === 'locked' ? (
          <Link href="/dashboard/billing" className="inline-flex items-center rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium">
            See plans
          </Link>
        ) : null}
        <Button variant="secondary" onClick={onExit}>
          Back to editing
        </Button>
      </div>
    </div>
  );
}

function PagePicker({ value, onChange }: { value: string; onChange: (path: string) => void }) {
  const known = PREVIEW_PAGES.some((page) => page.path === value);
  return (
    <select
      aria-label="Preview page"
      value={known ? value : ''}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
    >
      {known ? null : <option value="">Other page</option>}
      {PREVIEW_PAGES.map((page) => (
        <option key={page.path} value={page.path}>
          {page.label}
        </option>
      ))}
    </select>
  );
}

const DEVICE_ICONS: Record<PreviewDevice, string> = {
  desktop: 'M3 4h18v12H3zM8 20h8M12 16v4',
  tablet: 'M6 2h12v20H6zM11 18h2',
  mobile: 'M8 2h8v20H8zM11 18h2',
};

function DeviceToggle({ value, onChange }: { value: PreviewDevice; onChange: (device: PreviewDevice) => void }) {
  return (
    <div className="flex rounded-md border border-[var(--color-border)] bg-white p-0.5" role="group" aria-label="Preview size">
      {PREVIEW_DEVICES.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-label={`${item.label} preview`}
          aria-pressed={value === item.id}
          title={item.label}
          onClick={() => onChange(item.id)}
          className={`flex h-7 w-8 items-center justify-center rounded ${
            value === item.id ? 'bg-[#e8f3ef] text-[var(--color-accent)]' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={DEVICE_ICONS[item.id]} />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function ThemePage() {
  return (
    <StoreScoped>
      <ThemeContent />
    </StoreScoped>
  );
}
