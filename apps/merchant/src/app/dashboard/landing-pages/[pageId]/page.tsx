'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LANDING_SLUG_PATTERN,
  LANDING_TEMPLATES,
  type LandingContent,
  type LandingPageDetail,
  type LandingSection,
  type LandingValue,
} from '@ecomesta/utils';
import { Button } from '@ecomesta/ui';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { LandingFieldsForm, ProductPicker, useStoreProducts } from '@/components/landing/landing-fields';
import { LANDING_PREVIEW_MESSAGE, landingPageUrl } from '@/components/landing/landing-utils';
import { ImageField } from '@/components/media/image-field';
import { NumberField, TextAreaField, TextField } from '@/components/theme/theme-fields';
import { useUnsavedChangesGuard } from '@/components/theme/use-unsaved-changes-guard';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

type Device = 'desktop' | 'mobile';
type Panel = { kind: 'section'; type: string } | null;
const HEX = /^#[0-9a-f]{6}$/i;

/** Keeps a storefront preview of the unsaved content (debounced while typing). */
function usePreviewSession(storeId: string | null, pageId: string, content: LandingContent | null, enabled: boolean) {
  const [token, setToken] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !storeId || !content) return;
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        try {
          const result = await api.post<{ success: true; data: { token: string } }>(`/stores/${storeId}/landing-pages/${pageId}/preview`, {
            content,
            ...(tokenRef.current ? { token: tokenRef.current } : {}),
          });
          if (cancelled) return;
          if (result.data.token !== tokenRef.current) {
            tokenRef.current = result.data.token;
            setToken(result.data.token);
          }
          setVersion((v) => v + 1);
          setFailed(false);
        } catch {
          if (!cancelled) setFailed(true);
        }
      },
      tokenRef.current ? 400 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [storeId, pageId, content, enabled]);
  return { token, version, failed };
}

function Preview({
  storeSlug,
  pageSlug,
  session,
  device,
  focus,
}: {
  storeSlug: string;
  pageSlug: string;
  session: ReturnType<typeof usePreviewSession>;
  device: Device;
  focus: string | null;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  // The address is fixed for the session (renaming the page does not reload the frame).
  const [slug] = useState(pageSlug);
  const src = session.token ? landingPageUrl(storeSlug, slug, session.token) : null;
  const origin = src ? new URL(src).origin : null;
  const post = useCallback((message: Record<string, unknown>) => {
    if (origin) frame.current?.contentWindow?.postMessage({ type: LANDING_PREVIEW_MESSAGE, ...message }, origin);
  }, [origin]);
  // The version the frame shows; a newer draft is sent once the frame's page can listen.
  const shown = useRef<number | null>(null);
  const ready = useRef(false);
  const versionRef = useRef(session.version);
  versionRef.current = session.version;
  useEffect(() => {
    if (session.version === 0) return;
    if (shown.current === null) {
      shown.current = session.version;
      return;
    }
    if (!ready.current || shown.current === session.version) return;
    shown.current = session.version;
    post({ action: 'refresh' });
  }, [session.version, post]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type !== LANDING_PREVIEW_MESSAGE || event.data.action !== 'ready') return;
      ready.current = true;
      if (shown.current !== null && shown.current !== versionRef.current) {
        shown.current = versionRef.current;
        post({ action: 'refresh' });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [origin, post]);
  useEffect(() => {
    if (focus) post({ action: 'focus', section: focus });
  }, [focus, post]);

  return (
    <div className="relative flex h-full w-full justify-center">
      <div
        className="relative h-full overflow-hidden bg-white shadow-[0_2px_16px_rgba(15,23,42,0.12)] transition-[width] duration-300"
        style={{ width: device === 'mobile' ? '390px' : '100%', maxWidth: '100%', borderRadius: device === 'mobile' ? 18 : 6 }}
      >
        {src ? <iframe ref={frame} key={session.token} src={src} title="Landing page preview" className="h-full w-full border-0" onLoad={() => setLoading(false)} /> : null}
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70" aria-live="polite">
            <span className="rounded-full bg-white px-4 py-2 text-sm text-[var(--color-muted)] shadow">{session.failed ? 'Preview is not available right now.' : 'Loading preview…'}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EditorContent() {
  const params = useParams<{ pageId: string }>();
  const pageId = params.pageId;
  const { selectedStoreId, selectedStore } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();
  const products = useStoreProducts(selectedStoreId);

  const [page, setPage] = useState<LandingPageDetail | null>(null);
  const [content, setContent] = useState<LandingContent | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'sections' | 'settings'>('sections');
  const [panel, setPanel] = useState<Panel>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [confirm, setConfirm] = useState<'publish' | 'unpublish' | null>(null);
  // Set when Publish is pressed before a product is chosen: points at the product picker.
  const [needProducts, setNeedProducts] = useState(false);
  const productsRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    if (!selectedStoreId) return;
    setError(null);
    try {
      const result = await api.get<{ success: true; data: LandingPageDetail }>(`/stores/${selectedStoreId}/landing-pages/${pageId}`);
      setPage(result.data);
      setContent(result.data.content);
      setTitle(result.data.title);
      setSlug(result.data.slug);
    } catch (err) {
      setError(humanApiError(err, 'Could not load this landing page.'));
    }
  }, [selectedStoreId, pageId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    () => !!page && !!content && (JSON.stringify(content) !== JSON.stringify(page.content) || title !== page.title || slug !== page.slug),
    [page, content, title, slug],
  );
  // Leaving with unsaved edits (links, Back, reload) asks first.
  const { prompt } = useUnsavedChangesGuard(dirty);
  const session = usePreviewSession(selectedStoreId, pageId, content, !!page && canWrite);

  if (!selectedStoreId) return <EmptyState title="Select a store" description="Choose a store from the header." />;
  if (error) {
    return (
      <div className="p-6">
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    );
  }
  if (!page || !content || !selectedStore) return <LoadingState label="Loading landing page" />;

  const template = LANDING_TEMPLATES[page.template];
  const disabled = !canWrite || saving;
  const slugValid = LANDING_SLUG_PATTERN.test(slug) && slug.length <= 80;
  const live = page.status === 'PUBLISHED';
  const liveUrl = landingPageUrl(selectedStore.slug, page.slug);

  const setSection = (type: string, next: Partial<LandingSection>) =>
    setContent((c) => (c ? { ...c, sections: c.sections.map((s) => (s.type === type ? { ...s, ...next } : s)) } : c));
  const moveSection = (index: number, delta: number) =>
    setContent((c) => {
      if (!c) return c;
      const sections = [...c.sections];
      const [item] = sections.splice(index, 1);
      sections.splice(index + delta, 0, item!);
      return { ...c, sections };
    });

  async function save(): Promise<boolean> {
    if (!content || !selectedStoreId) return false;
    if (title.trim().length < 2) {
      pushToast('Give the page a name.', 'error');
      return false;
    }
    if (!slugValid) {
      pushToast('The page address can only use lowercase letters, numbers and hyphens.', 'error');
      return false;
    }
    setSaving(true);
    try {
      const result = await api.patch<{ success: true; data: LandingPageDetail }>(`/stores/${selectedStoreId}/landing-pages/${pageId}`, { title: title.trim(), slug, content });
      setPage(result.data);
      setContent(result.data.content);
      setTitle(result.data.title);
      setSlug(result.data.slug);
      return true;
    } catch (err) {
      pushToast(humanApiError(err, 'Could not save the page.'), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function publishOrUnpublish(action: 'publish' | 'unpublish') {
    if (!selectedStoreId) return;
    if (dirty && !(await save())) return;
    setSaving(true);
    try {
      const result = await api.post<{ success: true; data: LandingPageDetail }>(`/stores/${selectedStoreId}/landing-pages/${pageId}/${action}`);
      setPage(result.data);
      setContent(result.data.content);
      pushToast(action === 'publish' ? 'Your landing page is live.' : 'The page is offline now.', 'success');
    } catch (err) {
      pushToast(humanApiError(err, action === 'publish' ? 'Could not publish the page.' : 'Could not take the page offline.'), 'error');
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  }

  const sectionDef = panel ? template.sections.find((s) => s.type === panel.type) : undefined;
  const section = panel ? content.sections.find((s) => s.type === panel.type) : undefined;
  const singleProduct = template.productMode === 'single';

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#eef1f4] text-[var(--color-ink)]">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-white px-2 sm:gap-3 sm:px-3">
        <Link
          href="/dashboard/landing-pages"
          aria-label="Exit landing page editor"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium hover:bg-[#f1f4f7]"
        >
          <span aria-hidden="true">←</span>
          <span className="hidden sm:inline">Exit</span>
        </Link>
        <span className="h-6 w-px bg-[var(--color-border)]" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold leading-tight">{page.title}</h1>
          <p className="truncate text-xs text-[var(--color-muted)]">
            {template.name} · {live ? (page.hasUnpublishedChanges ? 'Live · unpublished changes' : 'Live') : 'Draft'}
          </p>
        </div>
        <div className="mx-auto hidden rounded-md border border-[var(--color-border)] p-0.5 lg:flex" role="group" aria-label="Preview size">
          {(['desktop', 'mobile'] as const).map((d) => (
            <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={`rounded px-3 py-1 text-xs font-semibold capitalize ${device === d ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-muted)]'}`}>
              {d}
            </button>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {dirty ? <span className="hidden rounded-full border border-[var(--color-danger)] px-2 py-0.5 text-xs font-medium text-[var(--color-danger)] sm:inline">Unsaved changes</span> : null}
          <div className="flex rounded-md border border-[var(--color-border)] p-0.5 lg:hidden" role="group" aria-label="Editor view">
            {(['edit', 'preview'] as const).map((view) => (
              <button key={view} type="button" aria-pressed={mobileView === view} onClick={() => setMobileView(view)} className={`rounded px-2.5 py-1 text-xs font-semibold capitalize ${mobileView === view ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-muted)]'}`}>
                {view}
              </button>
            ))}
          </div>
          {live ? (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="hidden h-9 items-center rounded-md px-2 text-sm font-medium text-[var(--color-accent)] hover:bg-[#f1f4f7] md:inline-flex">
              View live ↗
            </a>
          ) : null}
          {canWrite ? (
            <>
              {live ? (
                <Button variant="secondary" className="hidden md:inline-flex" disabled={saving} onClick={() => setConfirm('unpublish')}>
                  Unpublish
                </Button>
              ) : null}
              <Button variant="secondary" disabled={saving || !dirty} onClick={() => void save().then((ok) => ok && pushToast('Saved.', 'success'))}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                disabled={saving}
                onClick={() => {
                  if (content.productIds.length === 0) {
                    // Nothing to sell yet: show where to choose it instead of a refusal.
                    setPanel(null);
                    setTab('settings');
                    setMobileView('edit');
                    setNeedProducts(true);
                    window.setTimeout(() => productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
                    return;
                  }
                  setConfirm('publish');
                }}
              >
                {live ? 'Publish changes' : 'Publish'}
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside aria-label="Landing page settings" className={`${mobileView === 'edit' ? 'flex' : 'hidden'} w-full min-w-0 flex-col border-r border-[var(--color-border)] bg-white lg:flex lg:w-[360px] lg:shrink-0`}>
          {!canWrite ? <p className="m-3 rounded-md bg-[#f6f8f7] px-2.5 py-2 text-xs text-[var(--color-muted)]">You have read-only access to this store.</p> : null}
          {panel && sectionDef && section ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
                <button type="button" onClick={() => setPanel(null)} className="rounded-md px-2 py-1 text-sm hover:bg-[#f1f4f7]" aria-label="Back to sections">
                  ←
                </button>
                <h2 className="font-semibold">{sectionDef.label}</h2>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
                <p className="text-xs text-[var(--color-muted)]">{sectionDef.description}</p>
                <LandingFieldsForm
                  fields={sectionDef.fields}
                  value={section.settings}
                  storeId={selectedStoreId}
                  products={products}
                  disabled={disabled}
                  onChange={(settings: Record<string, LandingValue>) => setSection(section.type, { settings })}
                />
              </div>
            </div>
          ) : (
            <>
              <div role="tablist" aria-label="Editor" className="grid grid-cols-2 gap-1 border-b border-[var(--color-border)] p-2">
                {(
                  [
                    ['sections', 'Sections'],
                    ['settings', 'Page settings'],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-[#e8f3ef] text-[var(--color-accent)]' : 'text-[var(--color-muted)] hover:bg-[#f1f4f7]'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {tab === 'sections' ? (
                  <>
                    {content.productIds.length === 0 ? (
                      <p role="status" className="mb-3 rounded-md border border-[#f1d9a6] bg-[#fff8ea] px-3 py-2 text-xs">
                        The preview shows demo products. Choose your {singleProduct ? 'product' : 'products'} in{' '}
                        <button type="button" className="font-semibold underline" onClick={() => setTab('settings')}>
                          Page settings
                        </button>{' '}
                        before publishing.
                      </p>
                    ) : null}
                    <ul className="space-y-1.5" aria-label="Sections">
                      {content.sections.map((s, index) => {
                        const def = template.sections.find((d) => d.type === s.type);
                        if (!def) return null;
                        return (
                          <li key={s.type} className={`flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1.5 ${s.enabled ? 'bg-white' : 'bg-[#f6f8f7] text-[var(--color-muted)]'}`}>
                            <button type="button" onClick={() => setPanel({ kind: 'section', type: s.type })} className="min-w-0 flex-1 truncate text-left text-sm font-medium">
                              {def.label}
                              {!s.enabled ? <span className="ml-1 text-xs font-normal">(hidden)</span> : null}
                            </button>
                            <button type="button" disabled={disabled || index === 0} onClick={() => moveSection(index, -1)} aria-label={`Move ${def.label} up`} className="rounded px-1.5 text-[var(--color-muted)] hover:bg-[#f1f4f7] disabled:opacity-30">
                              ↑
                            </button>
                            <button type="button" disabled={disabled || index === content.sections.length - 1} onClick={() => moveSection(index, 1)} aria-label={`Move ${def.label} down`} className="rounded px-1.5 text-[var(--color-muted)] hover:bg-[#f1f4f7] disabled:opacity-30">
                              ↓
                            </button>
                            <button
                              type="button"
                              disabled={disabled || def.required}
                              aria-pressed={s.enabled}
                              onClick={() => setSection(s.type, { enabled: !s.enabled })}
                              aria-label={def.required ? `${def.label} is always shown` : s.enabled ? `Hide ${def.label}` : `Show ${def.label}`}
                              title={def.required ? 'Always shown' : s.enabled ? 'Hide' : 'Show'}
                              className="rounded px-1.5 text-xs font-semibold text-[var(--color-accent)] hover:bg-[#f1f4f7] disabled:opacity-40"
                            >
                              {s.enabled ? 'On' : 'Off'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <div className="space-y-5">
                    <section className="space-y-3">
                      <h2 className="text-sm font-semibold">Page</h2>
                      <TextField label="Page name" value={title} disabled={disabled} onChange={setTitle} />
                      <label className="block space-y-1 text-sm">
                        <span className="block font-medium">Address</span>
                        <span className="flex items-center gap-1">
                          <span className="text-xs text-[var(--color-muted)]">/lp/</span>
                          <Input
                            value={slug}
                            disabled={disabled}
                            aria-invalid={!slugValid}
                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                            className={slugValid ? '' : 'border-[var(--color-danger)]'}
                          />
                        </span>
                        <span className="block text-xs text-[var(--color-muted)]">
                          {slugValid ? 'Lowercase letters, numbers and hyphens. Changing it breaks links you already shared.' : 'Use lowercase letters, numbers and hyphens only.'}
                        </span>
                      </label>
                    </section>
                    <section
                      ref={productsRef}
                      className={`space-y-3 ${needProducts && content.productIds.length === 0 ? '-mx-1 rounded-lg p-1 ring-2 ring-[var(--color-danger)]' : ''}`}
                    >
                      <h2 className="text-sm font-semibold">Products</h2>
                      {needProducts && content.productIds.length === 0 ? (
                        <p role="alert" className="text-sm text-[var(--color-danger)]">
                          Choose {singleProduct ? 'the product this page sells' : 'at least one product'} below, then press Publish again.
                        </p>
                      ) : null}
                      <ProductPicker
                        label={singleProduct ? 'The product this page sells' : 'Products on this page'}
                        hint={
                          singleProduct
                            ? page.template === 'food'
                              ? "Its variants (e.g. 500 g / 1 kg / 2 kg) become the package cards."
                              : page.template === 'story'
                                ? "Its variants (e.g. 1 pc / 2 pc combo / 3 pc combo) become the offer cards."
                                : 'Shoppers pick its size or type (variants) in the order form.'
                            : `Up to ${template.maxProducts}. Shoppers add the ones they want to one order.`
                        }
                        value={content.productIds}
                        max={template.maxProducts}
                        products={products.products}
                        failed={products.failed}
                        disabled={disabled}
                        onChange={(productIds) => setContent((c) => (c ? { ...c, productIds } : c))}
                      />
                    </section>
                    <section className="space-y-3">
                      <h2 className="text-sm font-semibold">Colours</h2>
                      {(['primary', 'accent'] as const).map((key) => {
                        const value = content.colors[key];
                        const fallback = key === 'primary' ? template.colors.primary : template.colors.accent;
                        return (
                          <div key={key} className="flex items-center gap-2 text-sm">
                            <input
                              type="color"
                              aria-label={key === 'primary' ? template.colors.primaryLabel : template.colors.accentLabel}
                              value={value ?? fallback.toLowerCase()}
                              disabled={disabled}
                              onChange={(e) => setContent((c) => (c ? { ...c, colors: { ...c.colors, [key]: HEX.test(e.target.value) ? e.target.value : null } } : c))}
                              className="h-9 w-12 cursor-pointer rounded border border-[var(--color-border)]"
                            />
                            <span className="flex-1">{key === 'primary' ? template.colors.primaryLabel : template.colors.accentLabel}</span>
                            {value ? (
                              <button type="button" disabled={disabled} onClick={() => setContent((c) => (c ? { ...c, colors: { ...c.colors, [key]: null } } : c))} className="text-xs text-[var(--color-accent)] hover:underline">
                                Reset
                              </button>
                            ) : (
                              <span className="text-xs text-[var(--color-muted)]">Design colour</span>
                            )}
                          </div>
                        );
                      })}
                    </section>
                    <section className="space-y-3">
                      <h2 className="text-sm font-semibold">Offer timer</h2>
                      <label className="block space-y-1 text-sm">
                        <span className="block font-medium">Timer</span>
                        <Select
                          value={content.countdown.mode}
                          disabled={disabled}
                          onChange={(e) => setContent((c) => (c ? { ...c, countdown: { ...c.countdown, mode: e.target.value as LandingContent['countdown']['mode'] } } : c))}
                        >
                          <option value="evergreen">Restarts for each visitor</option>
                          <option value="date">Ends on a date</option>
                          <option value="off">No timer</option>
                        </Select>
                      </label>
                      {content.countdown.mode === 'evergreen' ? (
                        <NumberField
                          label="Hours each visitor gets"
                          value={content.countdown.hours}
                          min={1}
                          max={720}
                          disabled={disabled}
                          onChange={(hours) => setContent((c) => (c ? { ...c, countdown: { ...c.countdown, hours: hours ?? 1 } } : c))}
                        />
                      ) : null}
                      {content.countdown.mode === 'date' ? (
                        <label className="block space-y-1 text-sm">
                          <span className="block font-medium">Offer ends</span>
                          <Input
                            type="datetime-local"
                            disabled={disabled}
                            value={content.countdown.endsAt ? toLocalInput(content.countdown.endsAt) : ''}
                            onChange={(e) => setContent((c) => (c ? { ...c, countdown: { ...c.countdown, endsAt: e.target.value ? new Date(e.target.value).toISOString() : null } } : c))}
                          />
                        </label>
                      ) : null}
                    </section>
                    <section className="space-y-3">
                      <h2 className="text-sm font-semibold">Search &amp; sharing</h2>
                      <TextField label="Title" hint="Shown in Google and when the link is shared. Empty: the page name." value={content.seo.title ?? ''} disabled={disabled} onChange={(v) => setContent((c) => (c ? { ...c, seo: { ...c.seo, title: v || null } } : c))} />
                      <TextAreaField label="Description" rows={3} value={content.seo.description ?? ''} disabled={disabled} onChange={(v) => setContent((c) => (c ? { ...c, seo: { ...c.seo, description: v || null } } : c))} />
                      <ImageField label="Share image" purpose="general" storeId={selectedStoreId} value={content.seo.imageUrl ?? ''} disabled={disabled} previewShape="wide" onChange={(v) => setContent((c) => (c ? { ...c, seo: { ...c.seo, imageUrl: v || null } } : c))} />
                    </section>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

        <main className={`${mobileView === 'preview' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col lg:flex`}>
          <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-4">
            {canWrite ? (
              <Preview storeSlug={selectedStore.slug} pageSlug={page.slug} session={session} device={device} focus={panel?.type ?? null} />
            ) : (
              <div className="p-6 text-sm text-[var(--color-muted)]">
                {live ? (
                  <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline">
                    Open the live page
                  </a>
                ) : (
                  'This page is not published yet.'
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        busy={saving}
        danger={confirm === 'unpublish'}
        title={confirm === 'unpublish' ? 'Take this page offline?' : live ? 'Publish your changes?' : 'Publish this landing page?'}
        description={
          confirm === 'unpublish'
            ? 'Its link shows "not found" until you publish it again. Orders already placed stay in Orders.'
            : `${dirty ? 'Your changes are saved first. ' : ''}Shoppers will see this version at ${liveUrl}`
        }
        confirmLabel={confirm === 'unpublish' ? 'Unpublish' : 'Publish'}
        onConfirm={() => confirm && void publishOrUnpublish(confirm)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={prompt !== null}
        danger
        safeDefault
        title="Discard unsaved changes?"
        description="Your edits to this landing page have not been saved."
        confirmLabel="Discard changes"
        cancelLabel="Stay on page"
        onConfirm={() => prompt?.confirm()}
        onCancel={() => prompt?.cancel()}
      />
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LandingPageEditorPage() {
  return (
    <StoreScoped>
      <EditorContent />
    </StoreScoped>
  );
}
