/**
 * Shopper events for the merchant's own marketing tags (Meta Pixel, Google
 * Analytics 4, Google Tag Manager). Each call is a no-op unless the store set
 * that tag up: the scripts (and so `fbq`, `gtag`, `dataLayer`) are only on
 * the page when it did, and never in the theme editor's preview.
 */

/** IDs are checked again before they reach a script. */
export const TRACKING_ID_PATTERNS = {
  metaPixelId: /^\d{8,20}$/,
  gtmContainerId: /^GTM-[A-Z0-9]{4,12}$/,
  ga4MeasurementId: /^G-[A-Z0-9]{4,16}$/,
} as const;

/** Google Search Console HTML-tag code, for the page's <meta name="google-site-verification">. */
export function googleVerification(store: { tracking?: { googleSiteVerification: string | null } | null }) {
  const code = store.tracking?.googleSiteVerification;
  return code && /^[A-Za-z0-9_-]{10,100}$/.test(code) ? { verification: { google: code } } : {};
}

export function validTrackingId(kind: keyof typeof TRACKING_ID_PATTERNS, value: string | null | undefined): string | null {
  return value && TRACKING_ID_PATTERNS[kind].test(value) ? value : null;
}

export interface TrackedItem {
  id: string;
  name: string;
  /** Unit price. */
  price: number;
  quantity: number;
  variant?: string | null;
}

type Fbq = (...args: unknown[]) => void;
type Gtag = (...args: unknown[]) => void;
type TrackingWindow = Window & { fbq?: Fbq; gtag?: Gtag; dataLayer?: unknown[] };

function win(): TrackingWindow | null {
  return typeof window === 'undefined' ? null : (window as TrackingWindow);
}

const money = (value: number) => Math.round(value * 100) / 100;

function ga4Items(items: TrackedItem[]) {
  return items.map((item) => ({
    item_id: item.id,
    item_name: item.name,
    ...(item.variant ? { item_variant: item.variant } : {}),
    price: money(item.price),
    quantity: item.quantity,
  }));
}

/** One event to every tag the store uses. */
function send(
  ga4Event: string,
  metaEvent: string | null,
  payload: { currency: string; value: number; items: TrackedItem[]; transactionId?: string },
) {
  const w = win();
  if (!w) return;
  const value = money(payload.value);
  const ecommerce = {
    currency: payload.currency,
    value,
    ...(payload.transactionId ? { transaction_id: payload.transactionId } : {}),
    items: ga4Items(payload.items),
  };
  if (typeof w.gtag === 'function') w.gtag('event', ga4Event, ecommerce);
  if (Array.isArray(w.dataLayer)) {
    // GTM's ecommerce convention: clear the previous object first.
    w.dataLayer.push({ ecommerce: null });
    w.dataLayer.push({ event: ga4Event, ecommerce });
  }
  if (metaEvent && typeof w.fbq === 'function') {
    w.fbq(
      'track',
      metaEvent,
      {
        currency: payload.currency,
        value,
        content_type: 'product',
        content_ids: payload.items.map((item) => item.id),
        contents: payload.items.map((item) => ({ id: item.id, quantity: item.quantity })),
        num_items: payload.items.reduce((sum, item) => sum + item.quantity, 0),
      },
      payload.transactionId ? { eventID: payload.transactionId } : undefined,
    );
  }
}

/** A page view (also after in-store navigation, which loads no new page). */
export function trackPageView(path: string) {
  const w = win();
  if (!w) return;
  if (typeof w.gtag === 'function') {
    w.gtag('event', 'page_view', { page_path: path, page_location: w.location.href, page_title: w.document.title });
  }
  if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: 'page_view', page_path: path });
  if (typeof w.fbq === 'function') w.fbq('track', 'PageView');
}

export function trackViewItem(item: TrackedItem, currency: string) {
  send('view_item', 'ViewContent', { currency, value: item.price, items: [item] });
}

export function trackAddToCart(item: TrackedItem, currency: string) {
  send('add_to_cart', 'AddToCart', { currency, value: item.price * item.quantity, items: [item] });
}

export function trackBeginCheckout(items: TrackedItem[], value: number, currency: string) {
  send('begin_checkout', 'InitiateCheckout', { currency, value, items });
}

const PURCHASE_KEY = 'ecomesta_tracked_purchases';

/** A completed order, reported once per order even if the confirmation page is opened again. */
export function trackPurchase(orderReference: string, items: TrackedItem[], value: number, currency: string) {
  const w = win();
  if (!w) return;
  let seen: string[] = [];
  try {
    seen = JSON.parse(w.localStorage.getItem(PURCHASE_KEY) ?? '[]') as string[];
  } catch {
    seen = [];
  }
  if (seen.includes(orderReference)) return;
  send('purchase', 'Purchase', { currency, value, items, transactionId: orderReference });
  try {
    w.localStorage.setItem(PURCHASE_KEY, JSON.stringify([...seen, orderReference].slice(-50)));
  } catch {
    // Storage blocked: the event was still sent once for this page view.
  }
}

/**
 * Installs the stores' tags once, with the vendors' standard loaders. The
 * `dataLayer` / `gtag` / `fbq` stubs exist right away, so events sent before
 * the vendor scripts finish loading are queued, not lost.
 */
export function installTags(ids: { pixel: string | null; gtm: string | null; ga4: string | null }) {
  const w = win() as (TrackingWindow & { __ecomestaTags?: string; _fbq?: unknown }) | null;
  if (!w) return;
  const key = `${ids.pixel ?? ''}|${ids.gtm ?? ''}|${ids.ga4 ?? ''}`;
  if (w.__ecomestaTags === key) return;
  w.__ecomestaTags = key;
  const d = w.document;
  const load = (src: string) => {
    const script = d.createElement('script');
    script.async = true;
    script.src = src;
    d.head.appendChild(script);
  };

  if (ids.gtm || ids.ga4) w.dataLayer = w.dataLayer ?? [];
  if (ids.gtm) {
    w.dataLayer!.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    load(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(ids.gtm)}`);
  }
  if (ids.ga4) {
    if (typeof w.gtag !== 'function') {
      // eslint-disable-next-line prefer-rest-params -- gtag.js reads the arguments object
      w.gtag = function gtag() { w.dataLayer!.push(arguments); };
    }
    w.gtag('js', new Date());
    w.gtag('config', ids.ga4, { send_page_view: false });
    load(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids.ga4)}`);
  }
  if (ids.pixel) {
    if (typeof w.fbq !== 'function') {
      const fbq = function fbq(...args: unknown[]) {
        const self = fbq as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] };
        if (self.callMethod) self.callMethod(...args);
        else self.queue.push(args);
      } as unknown as Fbq & { push: unknown; loaded: boolean; version: string; queue: unknown[] };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      w.fbq = fbq;
      if (!w._fbq) w._fbq = fbq;
      load('https://connect.facebook.net/en_US/fbevents.js');
    }
    w.fbq('init', ids.pixel);
  }
}
