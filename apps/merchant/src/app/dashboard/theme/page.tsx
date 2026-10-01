'use client';

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
import { HomepageSection } from '@/components/theme/homepage-section';
import { SeoSection } from '@/components/theme/seo-section';
import { ThemePreview } from '@/components/theme/theme-preview';
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
  // Remounts the sections that keep raw text buffers when a fresh config lands.
  const [formKey, setFormKey] = useState(0);

  // `storeTheme.configuration` is the last server-saved draft (the baseline);
  // `draft` is what the editor shows. Unsaved = the two differ.
  const applyStoreTheme = useCallback((next: StoreTheme) => {
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
        setStoreTheme(result.data);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Theme
          </h1>
          <p className="mt-2 text-[var(--color-muted)]">
            Customize the storefront, then publish when it looks right.
          </p>
        </div>
        {canWrite && storeTheme ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={saving} onClick={() => void saveDraft()}>
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
            <Button disabled={saving} onClick={() => setPending('publish')}>
              Publish
            </Button>
            <Button variant="danger" disabled={saving} onClick={() => setPending('reset')}>
              Reset
            </Button>
          </div>
        ) : null}
      </div>

      {!canWrite ? (
        <p
          role="status"
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-muted)]"
        >
          You have read-only access to this store, so theme changes are disabled.
        </p>
      ) : null}

      {loading ? <LoadingState label="Loading theme settings" /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && storeTheme ? (
        <>
          <div
            className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-muted)]"
            data-testid="theme-status"
          >
            <span>
              Editing:{' '}
              <span className="font-medium text-[var(--color-ink)]">
                {storeTheme.theme.name}
              </span>
            </span>
            <span>
              Live on storefront:{' '}
              <span className="font-medium text-[var(--color-ink)]">
                {storeTheme.liveTheme
                  ? storeTheme.liveTheme.name
                  : 'Nothing published yet'}
              </span>
              {storeTheme.liveTheme?.publishedAt
                ? ` · published ${new Date(storeTheme.liveTheme.publishedAt).toLocaleString()}`
                : null}
            </span>
            {dirty ? (
              <span
                data-testid="unsaved-indicator"
                className="rounded-full border border-[var(--color-danger)] px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]"
              >
                Unsaved changes
              </span>
            ) : null}
            {storeTheme.hasUnpublishedChanges ? (
              <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-ink)]">
                Unpublished changes
              </span>
            ) : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <ThemeSelector
                themes={themes}
                selectedThemeId={storeTheme.theme.id}
                liveThemeId={storeTheme.liveTheme?.id ?? null}
                disabled={disabled || saving}
                busyThemeId={switchingThemeId}
                onSelect={(themeId) => void selectTheme(themeId)}
              />
              <BrandingSection
                storeId={selectedStoreId}
                value={draft.branding ?? {}}
                saved={storeTheme.configuration?.branding}
                disabled={fieldsDisabled}
                onChange={(value) => updateSection('branding', value)}
              />
              <TypographySection
                value={draft.typography ?? {}}
                disabled={fieldsDisabled}
                onChange={(value) => updateSection('typography', value)}
              />
              <AnnouncementSection
                value={draft.announcement ?? {}}
                saved={storeTheme.configuration?.announcement}
                disabled={fieldsDisabled}
                onChange={(value) => updateSection('announcement', value)}
              />
              <HeaderSection
                key={`header-${formKey}`}
                value={draft.header ?? {}}
                disabled={fieldsDisabled}
                onChange={(value) => updateSection('header', value)}
              />
              <HeroSection
                storeId={selectedStoreId}
                value={draft.hero ?? {}}
                disabled={fieldsDisabled}
                onChange={(value) => updateSection('hero', value)}
              />
              <HomepageSection
                key={`homepage-${formKey}`}
                value={draft.homepage ?? {}}
                disabled={fieldsDisabled}
                onChange={(value) => updateSection('homepage', value)}
              />
              <FooterSection
                key={`footer-${formKey}`}
                value={draft.footer ?? {}}
                disabled={fieldsDisabled}
                onChange={(value) => updateSection('footer', value)}
              />
              <SeoSection />
            </div>

            <div className="space-y-2 xl:sticky xl:top-6 xl:self-start">
              <h2 className="text-base font-semibold">Live preview</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Rendered from the unsaved draft. The storefront only changes when
                you publish.
              </p>
              <ThemePreview
                config={draft}
                storeName={selectedStore?.name ?? 'Your store'}
              />
            </div>
          </div>
        </>
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

export default function ThemePage() {
  return (
    <StoreScoped>
      <ThemeContent />
    </StoreScoped>
  );
}
