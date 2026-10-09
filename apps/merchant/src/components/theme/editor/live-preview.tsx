'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoreThemeConfig } from '@ecomesta/types';
import { ThemePreview } from '@/components/theme/theme-preview';
import { HEX_COLOR_PATTERN, THEME_COLOR_FIELDS, sanitizeThemeConfig } from '@/components/theme/theme-utils';
import { api } from '@/lib/api-client';
import { storefrontUrl } from '@/lib/storefront-url';

/** Message type shared with the storefront's preview bridge. */
export const THEME_PREVIEW_MESSAGE = 'ecomesta-theme-preview';

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

export const PREVIEW_DEVICES: { id: PreviewDevice; label: string; width: number | null }[] = [
  { id: 'desktop', label: 'Desktop', width: null },
  { id: 'tablet', label: 'Tablet', width: 768 },
  { id: 'mobile', label: 'Mobile', width: 390 },
];

export const PREVIEW_PAGES: { path: string; label: string }[] = [
  { path: '/', label: 'Home page' },
  { path: '/products', label: 'All products' },
  { path: '/cart', label: 'Cart' },
  { path: '/track-order', label: 'Track order' },
];

/** The draft as the preview can show it: like a save, minus colors still being typed. */
export function previewableConfig(draft: StoreThemeConfig): StoreThemeConfig {
  const config = sanitizeThemeConfig(draft) as Record<string, Record<string, unknown> | undefined>;
  for (const { section, key } of THEME_COLOR_FIELDS) {
    const value = config[section]?.[key];
    if (typeof value === 'string' && !HEX_COLOR_PATTERN.test(value.trim())) {
      delete config[section]![key];
    }
  }
  return config as StoreThemeConfig;
}

export type PreviewStatus = 'starting' | 'ready' | 'unavailable';

/**
 * Keeps a storefront preview of the unsaved draft: the first call creates a
 * token, later calls update the same preview (debounced while typing).
 * `version` changes after every successful update.
 */
export function useThemePreviewSession({
  storeId,
  themeId,
  draft,
  enabled,
  allowed = true,
}: {
  storeId: string | null;
  themeId: string | null;
  /** The unsaved draft; null previews the theme as it ships (trying a theme). */
  draft: StoreThemeConfig | null;
  /** False while the editor is still loading. */
  enabled: boolean;
  /** Only store managers can open a preview session; others get the simple preview. */
  allowed?: boolean;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('starting');
  const [version, setVersion] = useState(0);
  const [stale, setStale] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const storeRef = useRef(storeId);

  // A token belongs to one store.
  if (storeRef.current !== storeId) {
    storeRef.current = storeId;
    tokenRef.current = null;
  }

  useEffect(() => {
    if (!enabled || !allowed || !storeId) return;
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        try {
          const result = await api.put<{ success: true; data: { token: string } }>(
            `/stores/${storeId}/theme/preview-session`,
            {
              ...(themeId ? { themeId } : {}),
              ...(draft ? { configuration: previewableConfig(draft) } : {}),
              ...(tokenRef.current ? { token: tokenRef.current } : {}),
            },
          );
          const next = result?.data?.token;
          if (cancelled) return;
          if (!next) throw new Error('No preview token');
          if (next !== tokenRef.current) {
            tokenRef.current = next;
            setToken(next);
          }
          setVersion((value) => value + 1);
          setStatus('ready');
          setStale(false);
        } catch {
          if (cancelled) return;
          // Without a preview yet the editor falls back to the simple mock;
          // with one, it keeps showing the last good version.
          if (tokenRef.current) setStale(true);
          else setStatus('unavailable');
        }
      },
      tokenRef.current ? 350 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [storeId, themeId, draft, enabled, allowed]);

  /** Re-renders the preview after a change outside the draft (e.g. a category image). */
  const refresh = useCallback(() => {
    if (tokenRef.current) setVersion((value) => value + 1);
  }, []);

  return { token, status: allowed ? status : ('unavailable' as const), version, stale, refresh };
}

/**
 * The real storefront in a frame, showing the editor's unsaved draft. A
 * section clicked in the frame opens its settings (`onSelectSection`).
 */
export function LivePreview({
  storeSlug,
  storeName,
  draft,
  device,
  page,
  onPathChange,
  session,
  focusSection,
  onSelectSection,
}: {
  storeSlug: string | null;
  storeName: string;
  draft: StoreThemeConfig;
  device: PreviewDevice;
  /** The page picked in the editor; `n` changes on every pick (also of the same page). */
  page: { path: string; n: number };
  /** The page the frame is on now (also after clicking links inside it). */
  onPathChange: (path: string) => void;
  session: ReturnType<typeof useThemePreviewSession>;
  /** Scroll the frame to this section (the open settings panel). */
  focusSection: string | null;
  onSelectSection: (section: string) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const base = storeSlug ? storefrontUrl(storeSlug) : null;
  const origin = base ? new URL(base).origin : null;
  const { token, status, version, stale } = session;

  const src = (() => {
    if (!base || !token) return null;
    const url = new URL(base);
    url.pathname = page.path;
    url.searchParams.set('theme_preview', token);
    return url.toString();
  })();

  const post = useCallback(
    (message: Record<string, unknown>) => {
      if (!origin) return;
      frameRef.current?.contentWindow?.postMessage({ type: THEME_PREVIEW_MESSAGE, ...message }, origin);
    },
    [origin],
  );

  // Every draft update after the first load: re-render in place (keeps scroll).
  const firstVersion = useRef<number | null>(null);
  useEffect(() => {
    if (version === 0) return;
    if (firstVersion.current === null) {
      firstVersion.current = version;
      return;
    }
    post({ action: 'refresh' });
  }, [version, post]);

  useEffect(() => {
    if (focusSection) post({ action: 'focus', section: focusSection });
  }, [focusSection, post]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; action?: string; section?: string; path?: string };
      if (data?.type !== THEME_PREVIEW_MESSAGE) return;
      if (data.action === 'ready') {
        setLoading(false);
        if (typeof data.path === 'string') onPathChange(data.path);
      }
      if (data.action === 'select' && typeof data.section === 'string') onSelectSection(data.section);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [origin, onPathChange, onSelectSection]);

  useEffect(() => {
    setLoading(true);
  }, [src]);

  const width = PREVIEW_DEVICES.find((item) => item.id === device)?.width ?? null;

  if (status === 'unavailable' || !base) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-2 p-4">
        <p role="status" className="rounded-md bg-white px-3 py-2 text-xs text-[var(--color-muted)] shadow-sm">
          The live storefront preview is not available right now (your store must be active). Showing a simple preview instead.
        </p>
        <ThemePreview config={draft} storeName={storeName} />
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full justify-center">
      <div
        className="relative h-full overflow-hidden bg-white shadow-[0_2px_16px_rgba(15,23,42,0.12)] transition-[width] duration-300"
        style={{ width: width ? `${width}px` : '100%', maxWidth: '100%', borderRadius: width ? 18 : 6 }}
      >
        {src ? (
          <iframe
            ref={frameRef}
            key={`${token}-${page.n}`}
            src={src}
            title="Storefront preview"
            className="h-full w-full border-0"
            onLoad={() => setLoading(false)}
          />
        ) : null}
        {loading || status === 'starting' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70" aria-live="polite">
            <span className="rounded-full bg-white px-4 py-2 text-sm text-[var(--color-muted)] shadow">Loading preview…</span>
          </div>
        ) : null}
      </div>
      {stale ? (
        <p role="status" className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#fff6e0] px-3 py-1 text-xs text-[#8a5a00] shadow">
          Some changes can&apos;t be previewed yet — check the highlighted fields.
        </p>
      ) : null}
    </div>
  );
}
