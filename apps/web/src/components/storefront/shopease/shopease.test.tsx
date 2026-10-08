import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicCategory, PublicProductCard, PublicStore, PublicStoreTheme } from '@ecomesta/types';
import { CartProvider, useCart } from '@/lib/cart';
import { StorefrontProviders } from '@/components/storefront-providers';
import { ShopEaseHome, discountPercent, pickDeal, splitHeadline } from './shopease-home';
import { DealCountdown, msUntilDhakaMidnight } from './shopease-interactive';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
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
  categories: [],
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
} as unknown as PublicStore;

const category = (overrides: Partial<PublicCategory> = {}) =>
  ({ id: 'c1', name: 'Kitchen', slug: 'kitchen', imageUrl: null, ...overrides }) as PublicCategory;

function CartProbe() {
  const { itemCount } = useCart();
  return <output data-testid="cart">{itemCount}</output>;
}

function renderHome(products: PublicProductCard[], categories: PublicCategory[] = [category()]) {
  return render(
    <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
      <ShopEaseHome
        store={store}
        storeSlug="alpha"
        config={{ hero: { headline: 'Shop More, Save More!', ctaLabel: 'Explore collection', ctaHref: '/products' } }}
        products={products}
        categories={categories}
        showCategories
        showProducts
        productsTitle="New arrivals"
      />
      <CartProbe />
    </CartProvider>,
  );
}

describe('ShopEase helpers', () => {
  it('computes discounts only for simple products on sale', () => {
    expect(discountPercent(card({ price: '750.00', compareAtPrice: '1000.00' }))).toBe(25);
    expect(discountPercent(card({ compareAtPrice: '400.00' }))).toBeNull();
    expect(discountPercent(card({ compareAtPrice: null }))).toBeNull();
    expect(discountPercent(card({ hasVariants: true, compareAtPrice: '900.00' }))).toBeNull();
  });

  it('picks the biggest available discount as the deal of the day', () => {
    const a = card({ id: 'a', price: '900', compareAtPrice: '1000' });
    const b = card({ id: 'b', price: '500', compareAtPrice: '1000' });
    const soldOut = card({ id: 'c', price: '100', compareAtPrice: '1000', available: false });
    expect(pickDeal([a, b, soldOut])?.id).toBe('b');
    expect(pickDeal([card()])).toBeNull();
  });

  it('splits the headline at the first comma', () => {
    expect(splitHeadline('Shop More, Save More!')).toEqual(['Shop More,', 'Save More!']);
    expect(splitHeadline('Just one line')).toEqual(['Just one line', null]);
  });

  it('counts down to midnight in Bangladesh (UTC+6)', () => {
    // 17:00 UTC = 23:00 in Dhaka → one hour left.
    expect(msUntilDhakaMidnight(Date.UTC(2026, 9, 8, 17, 0, 0))).toBe(3_600_000);
    // 18:00 UTC = midnight in Dhaka → a full day.
    expect(msUntilDhakaMidnight(Date.UTC(2026, 9, 8, 18, 0, 0))).toBe(86_400_000);
  });
});

describe('ShopEase home', () => {
  beforeEach(() => window.localStorage.clear());

  it('renders hero, offer badge, categories, deal, arrivals and the track-order band', () => {
    renderHome([
      card({ id: 'p1', name: 'Ceramic Mug', price: '600.00', compareAtPrice: '1000.00' }),
      card({ id: 'p2', name: 'Tea Pot', slug: 'tea-pot', sku: 'POT-1' }),
    ]);

    const hero = screen.getByRole('heading', { level: 1 });
    expect(hero).toHaveTextContent('Shop More,Save More!');
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore collection/ })).toHaveAttribute('href', '/products?store=alpha');

    expect(screen.getByRole('link', { name: /Kitchen/ })).toHaveAttribute('href', '/categories/kitchen?store=alpha');

    const deal = screen.getByRole('heading', { name: /Grab it before/ }).closest('section')!;
    expect(within(deal).getByRole('link', { name: 'Ceramic Mug' })).toHaveAttribute('href', '/products/ceramic-mug?store=alpha');
    expect(within(deal).getByText('40% off')).toBeInTheDocument();
    expect(within(deal).getByRole('timer')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'New arrivals' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Track order/ })).toHaveAttribute('href', '/track-order?store=alpha');
  });

  it('hides the offer badge and the deal when nothing is discounted', () => {
    renderHome([card()]);
    expect(screen.queryByText(/UP TO/)).toBeNull();
    expect(screen.queryByRole('heading', { name: /Grab it before/ })).toBeNull();
  });

  it('adds a simple product from its card and links variant products to their page', async () => {
    const user = userEvent.setup();
    renderHome([card(), card({ id: 'p3', name: 'Shirt', slug: 'shirt', hasVariants: true })], []);

    expect(screen.getByTestId('cart')).toHaveTextContent('0');
    await user.click(screen.getByRole('button', { name: 'Add Ceramic Mug to cart' }));
    expect(screen.getByTestId('cart')).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /Ceramic Mug is in your cart/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose options for Shirt' })).toHaveAttribute('href', '/products/shirt?store=alpha');
  });

  it('shows the countdown only after mounting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 8, 15, 30, 5)));
    try {
      render(<DealCountdown />);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(screen.getByRole('timer')).toHaveTextContent('02Hrs:29Mins:55Secs');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ShopEase chrome', () => {
  const theme = (slug: string) =>
    ({
      theme: { slug, name: slug },
      configuration: { announcement: { enabled: true, text: 'Cash on delivery across Bangladesh' } },
    }) as unknown as PublicStoreTheme;

  it('uses the ShopEase header and footer for the shopease theme', () => {
    render(
      <StorefrontProviders store={store} theme={theme('shopease')}>
        <p>page</p>
      </StorefrontProviders>,
    );
    expect(screen.getByText('Cash on delivery across Bangladesh')).toBeInTheDocument();
    expect(screen.getByText('Secure checkout')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop now' })).toHaveAttribute('href', '/products?store=alpha');
    expect(screen.getByRole('navigation', { name: 'Customer care' })).toBeInTheDocument();
    expect(screen.getByText('Powered by Ecomesta')).toBeInTheDocument();
  });

  it('the header cart opens the drawer and Escape closes it', async () => {
    const user = userEvent.setup();
    render(
      <StorefrontProviders store={store} theme={theme('shopease')}>
        <p>page</p>
      </StorefrontProviders>,
    );
    await user.click(screen.getByRole('button', { name: 'Open cart, 0 items' }));
    expect(screen.getByRole('dialog', { name: 'Cart' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Cart' })).toBeNull();
  });

  it('keeps the regular chrome for other themes', () => {
    render(
      <StorefrontProviders store={store} theme={theme('default')}>
        <p>page</p>
      </StorefrontProviders>,
    );
    expect(screen.queryByText('Secure checkout')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Customer care' })).toBeNull();
  });
});

describe('ShopEase deal of the day section', () => {
  const sale = card({ id: 'p1', name: 'Ceramic Mug', price: '600.00', compareAtPrice: '1000.00' });
  const plain = card({ id: 'p2', name: 'Tea Pot', slug: 'tea-pot', sku: 'POT-1' });
  const renderWith = (sections: Record<string, unknown>[], dealProduct: PublicProductCard | null = null) =>
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <ShopEaseHome
          store={store}
          storeSlug="alpha"
          config={{ homepage: { sections } } as never}
          products={[sale, plain]}
          categories={[category()]}
          showCategories
          showProducts
          dealProduct={dealProduct}
        />
      </CartProvider>,
    );

  it('uses the merchant’s heading, text, button and countdown setting, in the chosen place', () => {
    renderWith([
      { type: 'deal_of_day', title: 'Flash sale', text: 'Only today.', buttonLabel: 'Grab it', showCountdown: false },
      { type: 'featured_categories' },
      { type: 'featured_products' },
    ]);
    const deal = screen.getByRole('region', { name: 'Deal of the day' });
    expect(within(deal).getByRole('heading', { name: 'Flash sale' })).toBeInTheDocument();
    expect(deal).toHaveTextContent('Only today.');
    expect(within(deal).getByRole('link', { name: /Grab it/ })).toHaveAttribute('href', '/products/ceramic-mug?store=alpha');
    expect(within(deal).queryByRole('timer')).toBeNull();
    expect(deal).toHaveAttribute('data-theme-section', 'deal_of_day');
    // Placed first: before the categories.
    const categories = screen.getByRole('heading', { name: 'Shop by category' });
    expect(deal.compareDocumentPosition(categories) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('region', { name: 'Deal of the day' })).toHaveLength(1);
  });

  it('features the chosen product, also one without a discount or outside the newest list', () => {
    const { unmount } = renderWith([{ type: 'deal_of_day', productId: 'p2' }, { type: 'featured_products' }]);
    let deal = screen.getByRole('region', { name: 'Deal of the day' });
    expect(within(deal).getByRole('link', { name: 'Tea Pot' })).toBeInTheDocument();
    expect(deal).not.toHaveTextContent('% off');
    unmount();

    const older = card({ id: 'p9', name: 'Old Lamp', slug: 'old-lamp', sku: 'LAMP' });
    renderWith([{ type: 'deal_of_day', productId: 'p9' }], older);
    deal = screen.getByRole('region', { name: 'Deal of the day' });
    expect(within(deal).getByRole('link', { name: 'Old Lamp' })).toBeInTheDocument();
  });

  it('can be hidden', () => {
    renderWith([{ type: 'deal_of_day', enabled: false }, { type: 'featured_products' }]);
    expect(screen.queryByRole('region', { name: 'Deal of the day' })).toBeNull();
  });
});

describe('ShopEase hero offer badge', () => {
  const sale = card({ id: 'p1', name: 'Ceramic Mug', price: '600.00', compareAtPrice: '1000.00' });
  const renderHero = (hero: Record<string, unknown>) =>
    render(
      <CartProvider storeId="s1" storeSlug="alpha" currency="BDT">
        <ShopEaseHome store={store} storeSlug="alpha" config={{ hero } as never} products={[sale]} categories={[]} showCategories showProducts />
      </CartProvider>,
    );

  it('shows the best discount automatically by default', () => {
    renderHero({ headline: 'Hi' });
    expect(screen.getByTestId('hero-offer-badge')).toHaveTextContent('UP TO40%OFF');
  });

  it('shows the merchant’s own text, skipping empty lines', () => {
    renderHero({ headline: 'Hi', badgeMode: 'custom', badgeTop: 'EID', badgeMain: 'SALE', badgeBottom: '' });
    const badge = screen.getByTestId('hero-offer-badge');
    expect(badge).toHaveTextContent('EIDSALE');
    expect(badge.querySelectorAll('span')).toHaveLength(2);
  });

  it('can be hidden, and a custom badge with no text shows nothing', () => {
    const { unmount } = renderHero({ headline: 'Hi', badgeMode: 'hidden' });
    expect(screen.queryByTestId('hero-offer-badge')).toBeNull();
    unmount();
    renderHero({ headline: 'Hi', badgeMode: 'custom' });
    expect(screen.queryByTestId('hero-offer-badge')).toBeNull();
  });
});
