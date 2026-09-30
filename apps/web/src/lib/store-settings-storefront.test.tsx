import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicOrderConfirmationDetail, PublicStore } from '@ecomesta/types';
import { CartProvider } from '@/lib/cart';
import { quoteFor } from '@/lib/checkout-quote.fixture';
import {
  resolveStoreSeo,
  storeLang,
  storeOgLocale,
  storePageRobots,
  storeRobots,
} from '@/lib/store-seo';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('store=alpha'),
}));

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock('@/lib/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/public-api')>(
    '@/lib/public-api',
  );
  return {
    ...actual,
    publicGet: (...args: unknown[]) => getMock(...args),
    publicPost: (...args: unknown[]) => postMock(...args),
  };
});

const requirePublicStore = vi.fn();
vi.mock('@/lib/store-resolver', async () => {
  const actual = await vi.importActual<typeof import('@/lib/store-resolver')>(
    '@/lib/store-resolver',
  );
  return {
    ...actual,
    requirePublicStore: (...args: unknown[]) => requirePublicStore(...args),
    storeCanonicalUrl: (path: string) => `https://shop.alpha.com${path}`,
    storeMetadataBase: () => new URL('https://shop.alpha.com'),
  };
});

const fetchPublicTheme = vi.fn();
vi.mock('@/lib/theme', async () => {
  const actual = await vi.importActual<typeof import('@/lib/theme')>('@/lib/theme');
  return { ...actual, fetchPublicTheme: (...args: unknown[]) => fetchPublicTheme(...args) };
});

const store: PublicStore = {
  id: 's1',
  name: 'Alpha',
  slug: 'alpha',
  description: 'Handmade goods',
  logoUrl: 'https://cdn.example.com/logo.png',
  faviconUrl: null,
  currency: 'BDT',
  timezone: 'Asia/Dhaka',
  locale: 'bn-BD',
  language: 'bn',
  contact: { email: 'hello@alpha.com', phone: '+880 1711-000000', address: 'Dhanmondi, Dhaka' },
  checkout: { requireEmail: true, requirePhone: true, allowOrderNotes: false },
  allowCustomerCancellation: true,
  seo: {
    title: 'Alpha handmade goods',
    description: 'Handmade goods from Dhaka with cash on delivery.',
    keywords: ['handmade'],
    ogTitle: null,
    ogDescription: 'Share text',
    ogImageUrl: null,
    indexingEnabled: false,
  },
};

const themeConfig = {
  seo: { title: 'Legacy theme title', description: 'Legacy', ogImageUrl: 'https://cdn.example.com/theme-og.png' },
  branding: { brandName: 'Alpha Brand' },
};

describe('store SEO helpers', () => {
  it('prefers store settings over theme SEO and falls back per field', () => {
    const seo = resolveStoreSeo(store, themeConfig);
    expect(seo.title).toBe('Alpha handmade goods');
    expect(seo.description).toBe('Handmade goods from Dhaka with cash on delivery.');
    expect(seo.ogTitle).toBe('Alpha handmade goods');
    expect(seo.ogDescription).toBe('Share text');
    expect(seo.ogImage).toBe('https://cdn.example.com/theme-og.png');
    expect(seo.keywords).toEqual(['handmade']);
  });

  it('falls back to the theme and store name for stores without SEO settings', () => {
    const legacy = { ...store, seo: undefined };
    expect(resolveStoreSeo(legacy, themeConfig).title).toBe('Legacy theme title');
    expect(resolveStoreSeo(legacy, {}).title).toBe('Alpha');
    expect(resolveStoreSeo(legacy, {}).description).toBe('Handmade goods');
  });

  it('emits noindex only when indexing is disabled', () => {
    expect(storeRobots(store)).toEqual({ index: false, follow: false });
    expect(storeRobots({ seo: { ...store.seo!, indexingEnabled: true } })).toBeUndefined();
    expect(storeRobots({})).toBeUndefined();
  });

  it('never indexes a ?store= preview that has no canonical host', () => {
    const indexable = { seo: { ...store.seo!, indexingEnabled: true } };
    expect(storePageRobots(indexable, 'https://shop.alpha.com/')).toBeUndefined();
    expect(storePageRobots(indexable, undefined)).toEqual({ index: false, follow: false });
    expect(storePageRobots(store, 'https://shop.alpha.com/')).toEqual({ index: false, follow: false });
  });

  it('derives language from settings or locale', () => {
    expect(storeLang(store)).toBe('bn');
    expect(storeLang({ locale: 'en-BD' })).toBe('en');
    expect(storeLang({ locale: 'bn-BD' })).toBe('bn');
    expect(storeOgLocale(store)).toBe('bn_BD');
  });
});

describe('storefront home metadata', () => {
  beforeEach(() => {
    requirePublicStore.mockResolvedValue({ store, storeSlug: 'alpha' });
    fetchPublicTheme.mockResolvedValue({ configuration: themeConfig });
  });

  it('uses store SEO, OG fields, locale and robots noindex', async () => {
    const { storefrontHomeMetadata } = await import('@/components/storefront-home');
    const metadata = await storefrontHomeMetadata({});
    expect(metadata.title).toBe('Alpha handmade goods');
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toEqual({ canonical: 'https://shop.alpha.com/' });
    expect(metadata.openGraph).toMatchObject({
      title: 'Alpha handmade goods',
      description: 'Share text',
      locale: 'bn_BD',
      siteName: 'Alpha Brand',
    });
  });

  it('omits robots when indexing is enabled', async () => {
    requirePublicStore.mockResolvedValue({
      store: { ...store, seo: { ...store.seo!, indexingEnabled: true } },
      storeSlug: 'alpha',
    });
    const { storefrontHomeMetadata } = await import('@/components/storefront-home');
    const metadata = await storefrontHomeMetadata({});
    expect(metadata.robots).toBeUndefined();
  });
});

const product = {
  id: 'p1',
  name: 'Clay Mug',
  slug: 'clay-mug',
  shortDescription: 'Hand-thrown clay mug' as string | null,
  description: 'A long description' as string | null,
  images: [{ url: 'https://cdn.example.com/mug.jpg', alt: 'Mug' }],
};
const category = {
  id: 'c1',
  name: 'Kitchen',
  slug: 'kitchen',
  description: null as string | null,
  imageUrl: null,
  parentId: null,
};

describe('product and category metadata', () => {
  beforeEach(() => {
    requirePublicStore.mockResolvedValue({ store, storeSlug: 'alpha' });
    fetchPublicTheme.mockResolvedValue({ configuration: themeConfig });
    getMock.mockReset();
  });

  async function productMetadata(overrides: Partial<typeof product> = {}) {
    getMock.mockResolvedValue({ success: true, data: { ...product, ...overrides } });
    const { generateMetadata } = await import('@/app/(store)/products/[productSlug]/page');
    return generateMetadata({ params: { productSlug: 'clay-mug' }, searchParams: {} });
  }

  async function categoryMetadata(overrides: Partial<typeof category> = {}) {
    getMock.mockResolvedValue({ success: true, data: { ...category, ...overrides } });
    const { generateMetadata } = await import('@/app/(store)/categories/[categorySlug]/page');
    return generateMetadata({ params: { categorySlug: 'kitchen' }, searchParams: {} });
  }

  it('titles products "{name} | {store}" and keeps the product description', async () => {
    const metadata = await productMetadata();
    expect(metadata.title).toEqual({ absolute: 'Clay Mug | Alpha' });
    expect(metadata.description).toBe('Hand-thrown clay mug');
    expect(metadata.alternates).toEqual({ canonical: 'https://shop.alpha.com/products/clay-mug' });
    expect(metadata.openGraph).toMatchObject({
      title: 'Clay Mug | Alpha',
      description: 'Hand-thrown clay mug',
      url: 'https://shop.alpha.com/products/clay-mug',
      images: ['https://cdn.example.com/mug.jpg'],
    });
  });

  it('falls back to the full product description, then the store SEO description', async () => {
    expect((await productMetadata({ shortDescription: null })).description).toBe(
      'A long description',
    );
    expect(
      (await productMetadata({ shortDescription: null, description: null })).description,
    ).toBe('Handmade goods from Dhaka with cash on delivery.');
  });

  it('clips long product descriptions to a plain-text meta description', async () => {
    const long = `${'word '.repeat(60)}end`;
    const { description } = await productMetadata({ shortDescription: long });
    expect(description!.length).toBeLessThanOrEqual(160);
    expect(description!.endsWith('…')).toBe(true);
  });

  it('uses the category description, else the store SEO description', async () => {
    const withOwn = await categoryMetadata({ description: 'Mugs, plates and bowls' });
    expect(withOwn.title).toEqual({ absolute: 'Kitchen | Alpha' });
    expect(withOwn.description).toBe('Mugs, plates and bowls');
    expect(withOwn.alternates).toEqual({ canonical: 'https://shop.alpha.com/categories/kitchen' });

    const fallback = await categoryMetadata();
    expect(fallback.description).toBe('Handmade goods from Dhaka with cash on delivery.');
    expect(fallback.openGraph).toMatchObject({ title: 'Kitchen | Alpha', locale: 'bn_BD' });
  });

  it('falls back to the theme SEO description when the store has none', async () => {
    requirePublicStore.mockResolvedValue({
      store: { ...store, seo: { ...store.seo!, description: null } },
      storeSlug: 'alpha',
    });
    expect((await categoryMetadata()).description).toBe('Legacy');
    fetchPublicTheme.mockRejectedValue(new Error('theme down'));
    expect((await categoryMetadata()).description).toBe('Handmade goods');
  });

  it('keeps noindex on product and category pages when indexing is off', async () => {
    expect((await productMetadata()).robots).toEqual({ index: false, follow: false });
    expect((await categoryMetadata()).robots).toEqual({ index: false, follow: false });
    requirePublicStore.mockResolvedValue({
      store: { ...store, seo: { ...store.seo!, indexingEnabled: true } },
      storeSlug: 'alpha',
    });
    expect((await productMetadata()).robots).toBeUndefined();
  });
});

describe('private and listing storefront metadata', () => {
  const indexable = { ...store, seo: { ...store.seo!, indexingEnabled: true } };

  beforeEach(() => {
    requirePublicStore.mockResolvedValue({ store: indexable, storeSlug: 'alpha' });
  });

  it('noindexes checkout, cart and payment return pages', async () => {
    const checkout = await import('@/app/(store)/checkout/page');
    expect((await checkout.generateMetadata({ searchParams: {} })).robots).toEqual({
      index: false,
      follow: false,
    });
    expect((await import('@/app/(store)/cart/layout')).metadata.robots).toEqual({
      index: false,
      follow: false,
    });
    expect((await import('@/app/(store)/payment/layout')).metadata.robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it('indexes only the unfiltered product listing, with a canonical URL', async () => {
    const { generateMetadata } = await import('@/app/(store)/products/page');
    const base = await generateMetadata({ searchParams: { store: 'alpha' } });
    expect(base.alternates).toEqual({ canonical: 'https://shop.alpha.com/products' });
    expect(base.robots).toBeUndefined();

    const filtered = await generateMetadata({ searchParams: { store: 'alpha', q: 'mug', page: '2' } });
    expect(filtered.alternates).toBeUndefined();
    expect(filtered.robots).toEqual({ index: false, follow: true });
  });
});

describe('fresh store settings fetch', () => {
  it('fetches the public store without the 30s data cache', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify({ success: true, data: store })));
    const actual = await vi.importActual<typeof import('@/lib/store-resolver')>(
      '@/lib/store-resolver',
    );
    const realPublicApi = await vi.importActual<typeof import('@/lib/public-api')>(
      '@/lib/public-api',
    );
    getMock.mockImplementation((...args: Parameters<typeof realPublicApi.publicGet>) =>
      realPublicApi.publicGet(...args),
    );
    await actual.fetchPublicStore('alpha');
    const [firstUrl, firstInit] = fetchSpy.mock.calls[0]!;
    const init = firstInit as RequestInit & { next?: unknown };
    expect(String(firstUrl)).toMatch(/\/public\/stores\/alpha$/);
    expect(init.cache).toBe('no-store');
    expect(init.next).toBeUndefined();

    fetchSpy.mockClear();
    await realPublicApi.publicGet('/public/stores/alpha/products');
    const catalogInit = fetchSpy.mock.calls[0]![1] as RequestInit & { next?: unknown };
    expect(catalogInit.next).toEqual({ revalidate: 30 });
  });
});

function seedCart() {
  window.localStorage.setItem(
    'ecomesta_cart_alpha',
    JSON.stringify({
      storeId: 's1',
      storeSlug: 'alpha',
      currency: 'BDT',
      lines: [
        {
          productId: 'p1',
          productSlug: 'widget',
          productName: 'Widget',
          variantId: null,
          variantName: null,
          sku: 'W',
          unitPrice: '10.00',
          quantity: 1,
          imageUrl: null,
        },
      ],
    }),
  );
}

describe('checkout settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getMock.mockImplementation(async (path: string) => {
      if (String(path).includes('payment-providers')) {
        return { success: true, data: { offline: [{ provider: 'COD', method: 'CASH' }], online: [] } };
      }
      return { success: true, data: [] };
    });
    postMock.mockImplementation(async (path: string, body?: unknown) =>
      String(path).endsWith('/checkout/quote') ? quoteFor(body) : { success: true, data: {} },
    );
  });

  it('requires a phone number and hides order notes when configured', async () => {
    seedCart();
    const { CheckoutForm } = await import('@/components/checkout-form');
    const user = userEvent.setup();
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <CheckoutForm requirePhone allowOrderNotes={false} />
      </CartProvider>,
    );
    await screen.findByRole('heading', { name: /order summary/i });
    const phone = screen.getAllByLabelText(/^phone$/i)[0];
    expect(phone).toBeRequired();
    expect(screen.queryByLabelText(/order note/i)).toBeNull();

    await user.type(screen.getByLabelText(/full name/i), 'Ada');
    await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/phone number is required/i);
    expect(postMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/checkout'),
      expect.anything(),
      expect.anything(),
    );
  });

  it('keeps phone optional and notes visible by default', async () => {
    seedCart();
    const { CheckoutForm } = await import('@/components/checkout-form');
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <CheckoutForm />
      </CartProvider>,
    );
    await screen.findByRole('heading', { name: /order summary/i });
    expect(screen.getByLabelText(/phone \(optional\)/i)).not.toBeRequired();
    expect(screen.getByLabelText(/order note/i)).toBeInTheDocument();
  });
});

const cancellableOrder: PublicOrderConfirmationDetail = {
  orderNumber: 'EM-100020',
  publicReference: 'abcdefghijklmnopqrstuvwxyz012345',
  status: 'PENDING',
  paymentStatus: 'PENDING',
  fulfillmentStatus: 'UNFULFILLED',
  paymentProvider: 'COD',
  paymentMethod: 'CASH',
  currency: 'BDT',
  subtotal: '10.00',
  shippingTotal: '0.00',
  shippingMethodName: 'Free',
  shippingMethodType: 'FREE',
  discountTotal: '0.00',
  taxTotal: '0.00',
  total: '10.00',
  customerNote: null,
  cancelReason: null,
  canCancel: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  items: [],
  shippingAddress: null,
  billingAddress: null,
  shipments: [],
  timeline: [],
} as unknown as PublicOrderConfirmationDetail;

describe('customer order cancellation', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('confirms, sends email proof and shows the cancelled order', async () => {
    postMock.mockResolvedValue({
      success: true,
      data: {
        ...cancellableOrder,
        status: 'CANCELLED',
        canCancel: false,
        cancelReason: 'Cancelled by customer: Changed my mind',
      },
    });
    const { OrderTrackingView } = await import('@/components/order-tracking-view');
    const user = userEvent.setup();
    render(
      <OrderTrackingView storeSlug="alpha" initial={cancellableOrder} email="ada@example.com" />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
    await user.type(screen.getByLabelText(/reason/i), 'Changed my mind');
    await user.click(screen.getByRole('button', { name: /yes, cancel order/i }));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(
        `/public/stores/alpha/orders/${cancellableOrder.publicReference}/cancel`,
        { email: 'ada@example.com', reason: 'Changed my mind' },
      ),
    );
    expect(await screen.findByText(/Cancelled by customer: Changed my mind/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull();
  });

  it('shows the API error when cancellation is refused', async () => {
    const { PublicApiError } = await import('@/lib/public-api');
    postMock.mockRejectedValue(
      new PublicApiError(422, 'UNPROCESSABLE', 'This order can no longer be cancelled.'),
    );
    const { OrderTrackingView } = await import('@/components/order-tracking-view');
    const user = userEvent.setup();
    render(
      <OrderTrackingView storeSlug="alpha" initial={cancellableOrder} email="ada@example.com" />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
    await user.click(screen.getByRole('button', { name: /yes, cancel order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer be cancelled/);
  });

  it('hides the cancel button when the order is not eligible', async () => {
    const { OrderTrackingView } = await import('@/components/order-tracking-view');
    render(
      <OrderTrackingView
        storeSlug="alpha"
        initial={{ ...cancellableOrder, canCancel: false }}
        email="ada@example.com"
      />,
    );
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull();
  });
});

describe('storefront footer contact', () => {
  it('shows store contact details from settings', async () => {
    const { StorefrontFooter } = await import('@/components/storefront/storefront-footer');
    render(<StorefrontFooter store={store} />);
    const contact = screen.getByRole('group', { name: 'Store contact' });
    expect(contact).toHaveTextContent('hello@alpha.com');
    expect(screen.getByRole('link', { name: '+880 1711-000000' })).toHaveAttribute(
      'href',
      'tel:+8801711000000',
    );
    expect(contact).toHaveTextContent('Dhanmondi, Dhaka');
  });
});
