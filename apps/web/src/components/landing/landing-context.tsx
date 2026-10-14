'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PublicProductDetail, PublicStore } from '@ecomesta/types';
import {
  LANDING_TEMPLATES,
  landingSection,
  type LandingContent,
  type LandingItem,
  type LandingTemplateKey,
  type LandingValue,
} from '@ecomesta/utils';
import type { PublicLandingPage } from '@/lib/landing';
import { trackAddToCart } from '@/lib/tracking';

export interface LandingVariant {
  id: string;
  name: string;
  price: number;
  compareAt: number | null;
  available: boolean;
}

/** A product as landing pages show it (also the template's demo products in the editor). */
export interface LandingProduct {
  id: string;
  name: string;
  note: string | null;
  imageUrl: string | null;
  price: number;
  compareAt: number | null;
  available: boolean;
  variants: LandingVariant[];
  demo: boolean;
}

export interface LandingLine {
  key: string;
  productId: string;
  variantId: string | null;
  quantity: number;
}

export const MAX_QUANTITY = 10;

const num = (value: string | null | undefined) => (value == null ? null : Number(value));

function fromCatalog(product: PublicProductDetail): LandingProduct {
  const variants = product.variants.map((v) => ({
    id: v.id,
    name: v.name,
    price: Number(v.price),
    compareAt: num(v.compareAtPrice),
    available: v.available,
  }));
  const firstAvailable = variants.find((v) => v.available) ?? variants[0];
  return {
    id: product.id,
    name: product.name,
    note: product.shortDescription,
    imageUrl: product.images[0]?.url ?? null,
    price: firstAvailable ? firstAvailable.price : Number(product.price),
    compareAt: firstAvailable ? firstAvailable.compareAt : num(product.compareAtPrice),
    available: product.available,
    variants,
    demo: false,
  };
}

function demoProducts(template: LandingTemplateKey): LandingProduct[] {
  return LANDING_TEMPLATES[template].demoProducts.map((p, index) => ({
    id: `demo-${index}`,
    name: p.name,
    note: p.note ?? null,
    imageUrl: p.imageUrl,
    price: p.price,
    compareAt: p.compareAtPrice,
    available: true,
    variants: p.variants.map((v, i) => ({ id: `demo-${index}-${i}`, name: v.name, price: v.price, compareAt: v.compareAtPrice, available: true })),
    demo: true,
  }));
}

export const lineKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? ''}`;

/** "৳1,490" — Bangladeshi shoppers read taka with Latin digits on landing pages. */
export function money(amount: number, currency = 'BDT'): string {
  const rounded = Math.round(amount);
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const symbol = currency === 'BDT' ? '৳' : `${currency} `;
  return `${rounded < 0 ? '-' : ''}${symbol}${digits}`;
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export function toBn(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS.charAt(Number(d)));
}

/** Whole-percent discount, or 0. */
export function discountPercent(price: number, compareAt: number | null): number {
  return compareAt && compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0;
}

export function asText(value: LandingValue | undefined): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

export function asItems(value: LandingValue | undefined): LandingItem[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === 'object') as LandingItem[]) : [];
}

export function itemText(item: LandingItem, key: string): string {
  const value = item[key];
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

/** Countdown end for this visitor: a fixed date, or N hours from their first visit (kept per page). */
function useCountdownEnd(countdown: LandingContent['countdown'], pageId: string): number | null {
  const [end, setEnd] = useState<number | null>(null);
  useEffect(() => {
    if (countdown.mode === 'off') {
      setEnd(null);
      return;
    }
    if (countdown.mode === 'date') {
      const fixed = countdown.endsAt ? Date.parse(countdown.endsAt) : NaN;
      setEnd(Number.isNaN(fixed) ? null : fixed);
      return;
    }
    const key = `ecomesta_lp_offer_${pageId}_${countdown.hours}`;
    let saved = 0;
    try {
      saved = Number(window.localStorage.getItem(key) ?? 0);
    } catch {
      saved = 0;
    }
    if (!saved || saved < Date.now()) {
      saved = Date.now() + countdown.hours * 3600 * 1000;
      try {
        window.localStorage.setItem(key, String(saved));
      } catch {
        // Private mode: the timer simply restarts on the next visit.
      }
    }
    setEnd(saved);
  }, [countdown.mode, countdown.endsAt, countdown.hours, pageId]);
  return end;
}

/** Days / hours / minutes / seconds left; zeros before the first tick (server render). */
export function useTimeLeft(end: number | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (end === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [end]);
  const left = end === null || now === null ? 0 : Math.max(0, Math.floor((end - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    days: pad(Math.floor(left / 86400)),
    hours: pad(Math.floor((left % 86400) / 3600)),
    minutes: pad(Math.floor((left % 3600) / 60)),
    seconds: pad(left % 60),
    hasDays: left >= 86400,
  };
}

interface LandingContextValue {
  page: PublicLandingPage;
  store: PublicStore;
  template: LandingTemplateKey;
  content: LandingContent;
  currency: string;
  preview: boolean;
  /** Showing the template's demo products: nothing can be ordered. */
  demo: boolean;
  brand: string;
  /** The page's main products in order (the first is the single-product templates' product). */
  products: LandingProduct[];
  productById: (id: string) => LandingProduct | undefined;
  /** Every product the page sells (main and combo), as catalog products. */
  catalog: LandingProduct[];
  lines: LandingLine[];
  addLine: (productId: string, variantId: string | null, quantity?: number) => void;
  setOnlyLine: (productId: string, variantId: string | null, quantity: number) => void;
  changeQuantity: (key: string, delta: number) => void;
  removeLine: (key: string) => void;
  countdownEnd: number | null;
  /** Settings of an enabled section, or undefined. */
  settings: (type: string) => Record<string, LandingValue> | undefined;
  scrollTo: (target: string) => void;
}

const LandingContext = createContext<LandingContextValue | null>(null);

export function useLanding(): LandingContextValue {
  const value = useContext(LandingContext);
  if (!value) throw new Error('useLanding outside LandingProvider');
  return value;
}

export function LandingProvider({ page, store, children }: { page: PublicLandingPage; store: PublicStore; children: ReactNode }) {
  const template = page.template;
  const def = LANDING_TEMPLATES[template];
  const catalog = useMemo(() => page.products.map(fromCatalog), [page.products]);
  const demo = page.preview && page.content.productIds.length === 0 && catalog.length === 0;
  const products = useMemo(() => {
    if (demo) return demoProducts(template);
    return page.content.productIds.flatMap((id) => catalog.filter((p) => p.id === id));
  }, [demo, template, page.content.productIds, catalog]);
  const all = useMemo(() => (demo ? products : catalog), [demo, products, catalog]);
  const productById = useCallback((id: string) => all.find((p) => p.id === id), [all]);

  // Single-product templates start with the product (and its first available variant) chosen.
  const initialLines = (): LandingLine[] => {
    if (def.productMode !== 'single') return [];
    const product = products[0];
    if (!product) return [];
    const variant = product.variants.find((v) => v.available) ?? null;
    if (product.variants.length > 0 && !variant) return [];
    return [{ key: lineKey(product.id, variant?.id ?? null), productId: product.id, variantId: variant?.id ?? null, quantity: 1 }];
  };
  const [lines, setLines] = useState<LandingLine[]>(initialLines);
  // A different product picked in the editor: start over.
  const productKey = products.map((p) => p.id).join(',');
  const lastProductKey = useRef(productKey);
  useEffect(() => {
    if (lastProductKey.current === productKey) return;
    lastProductKey.current = productKey;
    setLines(initialLines());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productKey]);

  const track = useCallback(
    (productId: string, variantId: string | null, quantity: number) => {
      const product = all.find((p) => p.id === productId);
      if (!product || product.demo || page.preview) return;
      const variant = product.variants.find((v) => v.id === variantId);
      trackAddToCart({ id: product.id, name: product.name, variant: variant?.name ?? null, price: variant?.price ?? product.price, quantity }, page.currency);
    },
    [all, page.currency, page.preview],
  );

  const addLine = useCallback(
    (productId: string, variantId: string | null, quantity = 1) => {
      const key = lineKey(productId, variantId);
      setLines((current) => {
        const existing = current.find((l) => l.key === key);
        if (existing) return current.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + quantity) } : l));
        return [...current, { key, productId, variantId, quantity: Math.min(MAX_QUANTITY, quantity) }];
      });
      track(productId, variantId, quantity);
    },
    [track],
  );

  const setOnlyLine = useCallback((productId: string, variantId: string | null, quantity: number) => {
    setLines([{ key: lineKey(productId, variantId), productId, variantId, quantity: Math.max(1, Math.min(MAX_QUANTITY, quantity)) }]);
  }, []);

  const changeQuantity = useCallback((key: string, delta: number) => {
    setLines((current) =>
      current.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(MAX_QUANTITY, l.quantity + delta)) } : l)),
    );
  }, []);

  const removeLine = useCallback((key: string) => setLines((current) => current.filter((l) => l.key !== key)), []);

  const countdownEnd = useCountdownEnd(page.content.countdown, page.id);

  const settings = useCallback(
    (type: string) => {
      const section = landingSection(page.content, type);
      return section && section.enabled ? section.settings : undefined;
    },
    [page.content],
  );

  const scrollTo = useCallback((target: string) => {
    const el = document.querySelector(`[data-section="${target}"]`);
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const footer = landingSection(page.content, 'footer')?.settings;
  const heroBrand = landingSection(page.content, 'hero')?.settings.brand;
  const brand = asText(footer?.brand).trim() || asText(heroBrand).trim() || store.name;

  const value: LandingContextValue = {
    page,
    store,
    template,
    content: page.content,
    currency: page.currency,
    preview: page.preview,
    demo,
    brand,
    products,
    productById,
    catalog: all,
    lines,
    addLine,
    setOnlyLine,
    changeQuantity,
    removeLine,
    countdownEnd,
    settings,
    scrollTo,
  };
  return <LandingContext.Provider value={value}>{children}</LandingContext.Provider>;
}

/** Unit price of a line (its variant's, else the product's). */
export function linePrice(product: LandingProduct | undefined, variantId: string | null): { price: number; compareAt: number | null; variantName: string | null } {
  const variant = product?.variants.find((v) => v.id === variantId);
  return {
    price: variant?.price ?? product?.price ?? 0,
    compareAt: variant ? variant.compareAt : (product?.compareAt ?? null),
    variantName: variant?.name ?? null,
  };
}

/** The biggest discount among products, in whole percent. */
export function maxDiscount(products: LandingProduct[]): number {
  let best = 0;
  for (const p of products) {
    const candidates = p.variants.length > 0 ? p.variants : [{ price: p.price, compareAt: p.compareAt }];
    for (const c of candidates) best = Math.max(best, discountPercent(c.price, c.compareAt));
  }
  return best;
}
