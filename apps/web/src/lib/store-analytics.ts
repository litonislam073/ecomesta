import type { StoreAnalyticsEventType } from '@ecomesta/types';
import { apiBaseUrl } from '@/lib/public-api';

/**
 * Ecomesta's own storefront analytics for the merchant's dashboard. No
 * cookies and nothing personal: the API turns the request into a daily,
 * anonymous visitor id. Off until a storefront page turns it on (never in
 * the theme editor or a landing page preview).
 */
let storeSlug: string | null = null;

export function enableStoreAnalytics(slug: string | null): void {
  storeSlug = slug;
}

const SOURCE_KEY = 'ecomesta_visit_source';

/** Where this visit came from, decided on its first page: utm_source, else the referring website. */
export function visitSource(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = window.sessionStorage.getItem(SOURCE_KEY);
    if (saved !== null) return saved;
  } catch {
    // Storage blocked: work it out on every page.
  }
  let source = new URLSearchParams(window.location.search).get('utm_source')?.trim() ?? '';
  if (!source && document.referrer) {
    try {
      const host = new URL(document.referrer).hostname;
      if (host && host !== window.location.hostname) source = host;
    } catch {
      source = '';
    }
  }
  source = source.slice(0, 200);
  try {
    window.sessionStorage.setItem(SOURCE_KEY, source);
  } catch {
    // Ignore.
  }
  return source;
}

export function recordStoreEvent(type: StoreAnalyticsEventType, productId?: string | null): void {
  if (!storeSlug || typeof window === 'undefined' || typeof fetch !== 'function') return;
  const body = JSON.stringify({
    type,
    path: window.location.pathname,
    ...(productId ? { productId } : {}),
    source: visitSource(),
  });
  try {
    void fetch(`${apiBaseUrl()}/public/stores/${encodeURIComponent(storeSlug)}/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined);
  } catch {
    // Analytics never breaks the page.
  }
}
