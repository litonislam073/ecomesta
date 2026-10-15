import { afterEach, describe, expect, it, vi } from 'vitest';
import { enableStoreAnalytics, recordStoreEvent, visitSource } from './store-analytics';
import { trackAddToCart, trackPageView } from './tracking';

describe('store analytics', () => {
  afterEach(() => {
    enableStoreAnalytics(null);
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('sends nothing until a storefront turns it on', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    recordStoreEvent('PAGE_VIEW');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends page views and shopping events for the store, without cookies', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/products/saree?utm_source=facebook');
    enableStoreAnalytics('rahim-shop');
    trackPageView('/products/saree');
    trackAddToCart({ id: 'SKU-1', productId: 'p-1', name: 'Saree', price: 100, quantity: 1 }, 'BDT');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/public\/stores\/rahim-shop\/analytics\/events$/);
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit' });
    expect(JSON.parse(init.body)).toEqual({ type: 'PAGE_VIEW', path: '/products/saree', source: 'facebook' });
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toMatchObject({ type: 'ADD_TO_CART', productId: 'p-1' });
  });

  it('keeps the first page’s source for the whole visit', () => {
    window.history.replaceState(null, '', '/?utm_source=youtube');
    expect(visitSource()).toBe('youtube');
    window.history.replaceState(null, '', '/cart');
    expect(visitSource()).toBe('youtube');
  });
});
