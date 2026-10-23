import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OffsetPageMeta, PublicCategory, PublicProductCard, PublicProductDetail, PublicStore, PublicStoreTheme } from '@ecomesta/types';
import { CartProvider, useCart } from '@/lib/cart';
import { StorefrontProviders } from '@/components/storefront-providers';
import { KenakataCart } from './kenakata-cart';
import { KenakataHome } from './kenakata-home';
import { KenakataProductView } from './kenakata-product';
import { KenakataShop, kenakataShopHref } from './kenakata-shop';
import { kenakataDiscount } from './kenakata-utils';

const push = vi.fn();
let pathname = '/';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams('store=alpha'),
}));

const card = (overrides: Partial<PublicProductCard> = {}): PublicProductCard => ({
  id: 'p1',
  name: 'Ceramic Mug',
  slug: 'ceramic-mug',
  shortDescription: null,
  productType: 'PHYSICAL',
  currency: 'BDT',
  price: '450.00',
  compareAtPrice: null,
  sku: 'MUG-1',
  available: true,
  images: [{ url: 'https://cdn.example/mug.jpg', alt: 'Mug' }],
  categories: [{ id: 'c1', name: 'Kitchen', slug: 'kitchen' }],
  hasVariants: false,
  ...overrides,
});

const store = {
  id: 's1',
  slug: 'alpha',
  name: 'Alpha Shop',
  description: null,
  currency: 'BDT',
  logoUrl: null,
  faviconUrl: null,
  contact: { email: 'hi@alpha.test', phone: '01711000000', address: 'Dhaka' },
  payments: { offline: ['COD'], online: ['SSL_COMMERZ'] },
} as unknown as PublicStore;

const category = (overrides: Partial<PublicCategory> = {}) =>
  ({ id: 'c1', name: 'Kitchen', slug: 'kitchen', imageUrl: null, description: null, parentId: null, ...overrides }) as PublicCategory;

function CartProbe() {
  const { itemCount, lines } = useCart();
  return (
    <output data-testid="cart">
      {itemCount}:{lines.map((l) => l.variantName ?? '-').join(',')}
    </output>
  );
}

const withCart = (ui: React.ReactNode) => (
  <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
    {ui}
    <CartProbe />
  </CartProvider>
);

beforeEach(() => {
  pathname = '/';
  push.mockReset();
  window.localStorage.clear();
});

describe('Kenakata helpers', () => {
  it('computes discounts only for simple products on sale', () => {
    expect(kenakataDiscount(card({ price: '1850.00', compareAtPrice: '2400.00' }))).toBe(23);
    expect(kenakataDiscount(card({ compareAtPrice: '400.00' }))).toBeNull();
    expect(kenakataDiscount(card({ hasVariants: true, compareAtPrice: '900.00' }))).toBeNull();
  });

  it('builds shop links that keep the other filters and drop defaults', () => {
    const filters = { q: '', category: 'kitchen', sort: 'createdAt:desc', minPrice: '100', maxPrice: '', page: '3' };
    expect(kenakataShopHref('alpha', filters, { page: '1' })).toBe('/products?store=alpha&category=kitchen&minPrice=100');
    expect(kenakataShopHref('alpha', filters, { sort: 'basePrice:asc' })).toBe(
      '/products?store=alpha&category=kitchen&sort=basePrice%3Aasc&minPrice=100&page=3',
    );
  });
});

describe('Kenakata homepage', () => {
  const sale = card({ id: 'sale', name: 'Cotton panjabi', price: '1850.00', compareAtPrice: '2400.00' });
  const regular = card({ id: 'new', name: 'Linen shirt', price: '1450.00' });
  const categories = [category(), category({ id: 'c2', name: 'Fashion', slug: 'fashion' }), category({ id: 'c3', name: 'Beauty', slug: 'beauty' })];

  function renderHome(sections?: Parameters<typeof KenakataHome>[0]['sections']) {
    return render(
      withCart(
        <KenakataHome
          store={store}
          storeSlug="alpha"
          config={{ branding: { tagline: 'New season' }, hero: { headline: 'Shop smart. Get it delivered fast.', ctaLabel: 'Shop now', ctaHref: '/products' } }}
          products={[sale, regular]}
          categories={categories}
          showCategories
          showProducts
          categoriesTitle="Shop by category"
          productsTitle="New arrivals"
          sections={sections}
        />,
      ),
    );
  }

  it('renders the hero, trust strip, categories, deals and new arrivals with the merchant’s text', () => {
    renderHome([
      { type: 'featured_categories', enabled: true },
      { type: 'deal_of_day', title: 'Eid deals', buttonLabel: 'All offers', enabled: true },
      { type: 'featured_products', enabled: true },
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Shop smart. Get it delivered fast.' })).toBeInTheDocument();
    expect(screen.getByText('New season')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop now' })).toHaveAttribute('href', '/products?store=alpha');
    expect(screen.getByRole('region', { name: 'Why shop with us' })).toHaveTextContent('Cash on delivery');
    expect(screen.getByRole('heading', { name: 'Shop by category' })).toBeInTheDocument();

    // Deals: only discounted products, with the section's own title and link text.
    const deals = screen.getByRole('heading', { name: 'Eid deals' }).closest('section')!;
    expect(within(deals).getByText('Cotton panjabi')).toBeInTheDocument();
    expect(within(deals).queryByText('Linen shirt')).toBeNull();
    expect(within(deals).getByText('−23%')).toBeInTheDocument();
    expect(within(deals).getByRole('link', { name: /All offers/ })).toBeInTheDocument();

    const arrivals = screen.getByRole('heading', { name: 'New arrivals' }).closest('section')!;
    expect(within(arrivals).getByText('New')).toBeInTheDocument();
    // The side cards and promo banners point at the store's categories.
    expect(screen.getAllByRole('link', { name: /Kitchen/ }).some((a) => a.getAttribute('href') === '/categories/kitchen?store=alpha')).toBe(true);
  });

  it('follows the editor: hidden and reordered sections', () => {
    renderHome([
      { type: 'featured_products', enabled: true },
      { type: 'deal_of_day', enabled: false },
      { type: 'featured_categories', enabled: true },
    ]);
    expect(screen.queryByRole('heading', { name: 'Deals of the day' })).toBeNull();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf('New arrivals')).toBeLessThan(headings.indexOf('Shop by category'));
  });

  it('adds a simple product to the cart from its card, then offers the cart', async () => {
    const user = userEvent.setup();
    renderHome();
    const arrivals = screen.getByRole('heading', { name: 'New arrivals' }).closest('section')!;
    await user.click(within(arrivals).getByRole('button', { name: 'Add Linen shirt to cart' }));
    expect(screen.getByTestId('cart')).toHaveTextContent('1:');
    expect(within(arrivals).getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/cart?store=alpha');
  });
});

describe('Kenakata pictures', () => {
  it('shows the editor’s side cards and image banners (demo pictures until changed), side by side', () => {
    render(
      withCart(
        <KenakataHome
          store={store}
          storeSlug="alpha"
          config={{
            hero: {
              headline: 'Hi',
              cards: [
                { label: 'Electronics', title: 'Gadgets for everyday', imageUrl: '/demo-catalog/wireless-headphones.jpg', href: '/products' },
                { label: 'Fashion', title: 'New season picks', imageUrl: '/demo-catalog/casual-sneakers.jpg', href: '/categories/fashion' },
              ],
            },
          }}
          products={[]}
          categories={[category()]}
          showCategories
          showProducts
          sections={[
            { type: 'image_banner', id: 'b1', title: 'Refresh your space', text: 'Home & Living', buttonLabel: 'Explore', imageUrl: '/demo-catalog/led-desk-lamp.jpg', enabled: true },
            { type: 'image_banner', id: 'b2', title: 'Daily care essentials', text: 'Beauty', buttonLabel: 'Explore', imageUrl: '/demo-catalog/skincare-gift-set.jpg', enabled: true },
            { type: 'image_banner', id: 'b3', title: 'Hidden one', enabled: false },
          ]}
        />,
      ),
    );
    const card = screen.getByText('New season picks').closest('a')!;
    expect(card).toHaveAttribute('href', '/categories/fashion?store=alpha');
    expect(card.querySelector('img')).toHaveAttribute('src', '/demo-catalog/casual-sneakers.jpg');

    const offers = screen.getByRole('region', { name: 'Offers' });
    expect(within(offers).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Refresh your space', 'Daily care essentials']);
    expect(offers.querySelector('[data-theme-section="section:b1"] img')).toHaveAttribute('src', '/demo-catalog/led-desk-lamp.jpg');
    expect(screen.queryByText('Hidden one')).toBeNull();
  });

  it('a category without a picture shows one of its products, else its letter tile', () => {
    render(
      withCart(
        <KenakataHome
          store={store}
          storeSlug="alpha"
          config={{ hero: { enabled: false } }}
          products={[card({ images: [{ url: 'https://cdn.example/kitchen-mug.jpg', alt: '' }] })]}
          categories={[category(), category({ id: 'c9', name: 'Toys', slug: 'toys' })]}
          showCategories
          showProducts={false}
        />,
      ),
    );
    const grid = screen.getByRole('heading', { name: 'Shop by category' }).closest('section')!;
    expect(within(grid).getByText('Kitchen').closest('a')!.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/kitchen-mug.jpg');
    expect(within(grid).getByText('Toys').closest('a')!.querySelector('img')).toBeNull();
    expect(within(grid).getByText('T')).toBeInTheDocument();
  });
});

describe('Kenakata product page', () => {
  const product = {
    ...card({ name: 'Cotton panjabi', price: '1850.00', compareAtPrice: '2400.00', hasVariants: true }),
    description: 'Soft cotton.',
    variants: [
      { id: 'v1', name: 'L', sku: 'P-L', price: '1850.00', compareAtPrice: '2400.00', available: true },
      { id: 'v2', name: 'XL', sku: 'P-XL', price: '1950.00', compareAtPrice: null, available: false },
    ],
  } as unknown as PublicProductDetail;

  it('picks a variant, changes quantity and adds that line to the cart', async () => {
    const user = userEvent.setup();
    render(withCart(<KenakataProductView product={product} storeSlug="alpha" related={[card({ id: 'r1', name: 'Related mug' })]} />));
    expect(screen.getByRole('heading', { level: 1, name: 'Cotton panjabi' })).toBeInTheDocument();
    expect(screen.getByText('−23%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'L' })).toHaveAttribute('aria-pressed', 'true');

    // An out-of-stock option cannot be bought.
    await user.click(screen.getByRole('button', { name: /XL/ }));
    expect(screen.getByRole('button', { name: /Add to cart/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'L' }));
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByRole('button', { name: /Add to cart · .*3,700.00/ })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /Add to cart · .*3,700.00/ }));
    expect(screen.getByTestId('cart')).toHaveTextContent('2:L');
    expect(screen.getByRole('heading', { name: 'You may also like' })).toBeInTheDocument();
  });

  it('Buy now adds the line and goes to checkout', async () => {
    const user = userEvent.setup();
    render(withCart(<KenakataProductView product={product} storeSlug="alpha" related={[]} />));
    await user.click(screen.getByRole('button', { name: 'Buy now' }));
    expect(push).toHaveBeenCalledWith('/checkout?store=alpha');
    expect(screen.getByTestId('cart')).toHaveTextContent('1:L');
  });
});

describe('Kenakata shop and cart', () => {
  const meta: OffsetPageMeta = { page: 2, limit: 12, total: 30, totalPages: 3 } as OffsetPageMeta;

  it('lists products with category, price and page links that keep the filters', () => {
    render(
      withCart(
        <KenakataShop
          storeSlug="alpha"
          title="All products"
          items={[card()]}
          meta={meta}
          categories={[category()]}
          filters={{ q: '', category: 'kitchen', sort: 'basePrice:asc', minPrice: '', maxPrice: '', page: '2' }}
        />,
      ),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'All products' })).toBeInTheDocument();
    expect(screen.getByText('30 products')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kitchen' })).toHaveAttribute('aria-current', 'page');
    const pages = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(pages).getByRole('link', { name: '3' })).toHaveAttribute('href', '/products?store=alpha&category=kitchen&sort=basePrice%3Aasc&page=3');
    expect(within(pages).getByRole('link', { name: '2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Clear all filters' })).toBeInTheDocument();
  });

  it('shows cart lines, changes quantity and removes them', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'ecomesta_cart_alpha',
      JSON.stringify({
        storeId: 's1',
        storeSlug: 'alpha',
        currency: 'BDT',
        lines: [{ productId: 'p1', productSlug: 'mug', productName: 'Ceramic Mug', variantId: null, variantName: null, sku: 'M', unitPrice: '450.00', quantity: 1, imageUrl: null }],
      }),
    );
    render(withCart(<KenakataCart />));
    expect(await screen.findByRole('heading', { name: 'Shopping cart' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Ceramic Mug' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Increase quantity of Ceramic Mug' }));
    expect(screen.getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute('href', '/checkout?store=alpha');
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument();
  });
});

describe('Kenakata chrome', () => {
  const theme = {
    theme: { id: 't', slug: 'kenakata', name: 'Kenakata' },
    publishedAt: null,
    configuration: { announcement: { enabled: true, text: 'Free delivery over ৳3,000' }, footer: { tagline: 'Everyday shopping.' } },
  } as unknown as PublicStoreTheme;

  it('uses its own header, announcement and full footer on the homepage', () => {
    render(
      <StorefrontProviders store={store} theme={theme}>
        <p>page</p>
      </StorefrontProviders>,
    );
    expect(screen.getByText('Free delivery over ৳3,000')).toBeInTheDocument();
    expect(screen.getAllByRole('search').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Track order/ }).length).toBeGreaterThan(0);
    expect(screen.getByText('Everyday shopping.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Accepted payment methods' })).toBeInTheDocument();
  });

  it('switches to the focused checkout header and a compact footer on checkout', () => {
    pathname = '/checkout';
    render(
      <StorefrontProviders store={store} theme={theme}>
        <p>page</p>
      </StorefrontProviders>,
    );
    expect(screen.getByRole('list', { name: 'Checkout steps' })).toHaveTextContent('Details and payment');
    expect(screen.queryByText('Free delivery over ৳3,000')).toBeNull();
    expect(screen.queryByText('Everyday shopping.')).toBeNull();
  });
});
