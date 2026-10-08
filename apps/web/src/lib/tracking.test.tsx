import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicStore, PublicStoreTheme } from '@ecomesta/types';
import {
  googleVerification,
  installTags,
  trackAddToCart,
  trackPurchase,
  trackViewItem,
  validTrackingId,
} from '@/lib/tracking';
import { CartProvider, useCart } from '@/lib/cart';
import { StorefrontProviders } from '@/components/storefront-providers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams('store=alpha'),
}));

type W = Window & { fbq?: any; gtag?: any; dataLayer?: any[]; _fbq?: unknown; __ecomestaTags?: string };
const w = window as W;

function reset() {
  delete w.fbq;
  delete w.gtag;
  delete w.dataLayer;
  delete w._fbq;
  delete w.__ecomestaTags;
  document.head.querySelectorAll('script').forEach((s) => s.remove());
  window.localStorage.clear();
}

const scripts = () => Array.from(document.head.querySelectorAll('script')).map((s) => s.getAttribute('src'));

describe('tracking IDs', () => {
  it('accepts only well-formed IDs', () => {
    expect(validTrackingId('metaPixelId', '123456789012345')).toBe('123456789012345');
    expect(validTrackingId('metaPixelId', "1');alert(1)//")).toBeNull();
    expect(validTrackingId('gtmContainerId', 'GTM-ABC1234')).toBe('GTM-ABC1234');
    expect(validTrackingId('gtmContainerId', 'GTM-ABC1234<')).toBeNull();
    expect(validTrackingId('ga4MeasurementId', 'G-ABC123XYZ9')).toBe('G-ABC123XYZ9');
    expect(validTrackingId('ga4MeasurementId', 'UA-1234-1')).toBeNull();
    expect(validTrackingId('ga4MeasurementId', null)).toBeNull();
  });

  it('adds the Search Console meta tag only for a valid code', () => {
    expect(googleVerification({ tracking: { googleSiteVerification: 'AbC-123_xyzCode' } })).toEqual({ verification: { google: 'AbC-123_xyzCode' } });
    expect(googleVerification({ tracking: { googleSiteVerification: '"><x' } })).toEqual({});
    expect(googleVerification({})).toEqual({});
  });
});

describe('installing tags and sending events', () => {
  beforeEach(reset);
  afterEach(reset);

  it('loads each vendor script once and queues events before they load', () => {
    installTags({ pixel: '123456789012345', gtm: 'GTM-ABC1234', ga4: 'G-ABC123XYZ9' });
    installTags({ pixel: '123456789012345', gtm: 'GTM-ABC1234', ga4: 'G-ABC123XYZ9' });
    expect(scripts()).toEqual([
      'https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234',
      'https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ9',
      'https://connect.facebook.net/en_US/fbevents.js',
    ]);
    expect(w.fbq.queue).toEqual([['init', '123456789012345']]);
    expect(w.dataLayer![0]).toMatchObject({ event: 'gtm.js' });

    trackAddToCart({ id: 'MUG-1', name: 'Mug', price: 450, quantity: 2 }, 'BDT');
    // Meta Pixel
    expect(w.fbq.queue[1]).toEqual([
      'track',
      'AddToCart',
      { currency: 'BDT', value: 900, content_type: 'product', content_ids: ['MUG-1'], contents: [{ id: 'MUG-1', quantity: 2 }], num_items: 2 },
      undefined,
    ]);
    // GA4 (gtag → dataLayer) and GTM (ecommerce object)
    const gtagCall = w.dataLayer!.find((entry) => entry && typeof entry === 'object' && (entry as IArguments)[0] === 'event');
    expect(Array.from(gtagCall as IArguments)).toEqual([
      'event',
      'add_to_cart',
      { currency: 'BDT', value: 900, items: [{ item_id: 'MUG-1', item_name: 'Mug', price: 450, quantity: 2 }] },
    ]);
    expect(w.dataLayer).toContainEqual({
      event: 'add_to_cart',
      ecommerce: { currency: 'BDT', value: 900, items: [{ item_id: 'MUG-1', item_name: 'Mug', price: 450, quantity: 2 }] },
    });
  });

  it('only loads the tags that are set', () => {
    installTags({ pixel: '123456789012345', gtm: null, ga4: null });
    expect(scripts()).toEqual(['https://connect.facebook.net/en_US/fbevents.js']);
    expect(w.gtag).toBeUndefined();
    expect(w.dataLayer).toBeUndefined();
  });

  it('does nothing without tags', () => {
    expect(() => trackViewItem({ id: 'x', name: 'X', price: 1, quantity: 1 }, 'BDT')).not.toThrow();
    expect(scripts()).toEqual([]);
  });

  it('reports a purchase once per order, with the order as event ID', () => {
    w.fbq = vi.fn();
    w.gtag = vi.fn();
    const items = [{ id: 'MUG-1', name: 'Mug', price: 450, quantity: 1 }];
    trackPurchase('ORD-1', items, 510, 'BDT');
    trackPurchase('ORD-1', items, 510, 'BDT');
    expect(w.fbq).toHaveBeenCalledTimes(1);
    expect(w.fbq).toHaveBeenCalledWith('track', 'Purchase', expect.objectContaining({ value: 510, currency: 'BDT' }), { eventID: 'ORD-1' });
    expect(w.gtag).toHaveBeenCalledWith('event', 'purchase', expect.objectContaining({ transaction_id: 'ORD-1', value: 510 }));
    trackPurchase('ORD-2', items, 510, 'BDT');
    expect(w.fbq).toHaveBeenCalledTimes(2);
  });
});

describe('storefront wiring', () => {
  beforeEach(reset);
  afterEach(reset);

  const store = (tracking: Record<string, string | null>) =>
    ({
      id: 's1',
      slug: 'alpha',
      name: 'Alpha',
      currency: 'BDT',
      contact: { email: null, phone: null, address: null },
      tracking: { metaPixelId: null, gtmContainerId: null, ga4MeasurementId: null, googleSiteVerification: null, ...tracking },
    }) as unknown as PublicStore;
  const theme = (preview = false) => ({ theme: { slug: 'default', name: 'Default' }, configuration: {}, publishedAt: null, preview }) as PublicStoreTheme;

  it('loads the store’s tags and sends a page view', () => {
    render(
      <StorefrontProviders store={store({ metaPixelId: '123456789012345' })} theme={theme()}>
        <p>page</p>
      </StorefrontProviders>,
    );
    expect(scripts()).toContain('https://connect.facebook.net/en_US/fbevents.js');
    expect(w.fbq.queue).toContainEqual(['track', 'PageView']);
  });

  it('never tracks inside the theme editor preview', () => {
    render(
      <StorefrontProviders store={store({ metaPixelId: '123456789012345' })} theme={theme(true)}>
        <p>page</p>
      </StorefrontProviders>,
    );
    expect(scripts()).toEqual([]);
    expect(w.fbq).toBeUndefined();
  });

  it('adding to the cart sends add_to_cart', async () => {
    w.fbq = vi.fn();
    function Add() {
      const { addItem } = useCart();
      return (
        <button
          type="button"
          onClick={() =>
            addItem({ productId: 'p1', productSlug: 'mug', productName: 'Mug', variantId: null, variantName: null, sku: 'MUG-1', unitPrice: '450.00', imageUrl: null })
          }
        >
          add
        </button>
      );
    }
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <Add />
      </CartProvider>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'add' }));
    act(() => undefined);
    expect(w.fbq).toHaveBeenCalledWith('track', 'AddToCart', expect.objectContaining({ content_ids: ['MUG-1'], value: 450 }), undefined);
  });
});
