import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PublicStore, PublicStoreTheme } from '@ecomesta/types';
import { AnnouncementBar } from '@/components/storefront/announcement-bar';
import { FeaturedCategories } from '@/components/storefront/featured-categories';
import { FeaturedProducts } from '@/components/storefront/featured-products';
import { HeroSection } from '@/components/storefront/hero-section';
import { StorefrontFooter } from '@/components/storefront/storefront-footer';
import { StorefrontHeader } from '@/components/storefront/storefront-header';
import { ThemeProvider } from '@/components/storefront/theme-provider';
import { CartProvider } from '@/lib/cart';
import { themeCssVariables } from '@/lib/theme';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('store=alpha'),
  usePathname: () => '/',
}));

const store: PublicStore = {
  id: 'store-1',
  name: 'Alpha Store',
  slug: 'alpha',
  description: 'Store description',
  logoUrl: null,
  faviconUrl: null,
  currency: 'USD',
  timezone: 'UTC',
  locale: 'en-US',
};

const theme: PublicStoreTheme = {
  theme: { slug: 'default', name: 'Default' },
  publishedAt: '2026-02-01T00:00:00.000Z',
  configuration: {
    branding: {
      brandName: 'Alpha Goods',
      primaryColor: '#2563eb',
      secondaryColor: '#1e293b',
      backgroundColor: '#ffffff',
      textColor: '#0f172a',
      mutedTextColor: '#64748b',
      borderRadius: 'lg',
    },
    typography: { headingFont: 'Georgia', bodyFont: 'Inter', baseFontSize: 18 },
    announcement: {
      enabled: true,
      text: 'Free shipping over $50',
      href: '/products',
      backgroundColor: '#0f172a',
      textColor: '#ffffff',
    },
    header: {
      layout: 'classic',
      showCart: true,
      menuItems: [{ label: 'Catalogue', href: '/products' }],
    },
    hero: {
      enabled: true,
      headline: 'Shop the new arrivals',
      subheadline: 'Curated products, fast delivery.',
      ctaLabel: 'Browse catalogue',
      ctaHref: '/products',
      alignment: 'center',
    },
    footer: {
      tagline: 'Built with Ecomesta',
      copyright: '© 2026 Alpha Goods',
      showPaymentIcons: true,
      menuItems: [{ label: 'Track order', href: '/track-order' }],
      socialLinks: [{ network: 'instagram', url: 'https://instagram.com/alpha' }],
    },
  },
};

describe('themeCssVariables', () => {
  it('maps branding and typography onto storefront CSS variables', () => {
    const vars = themeCssVariables(theme.configuration);
    expect(vars['--color-accent']).toBe('#2563eb');
    expect(vars['--color-accent-hover']).toBeDefined();
    expect(vars['--color-accent-hover']).not.toBe('#2563eb');
    expect(vars['--theme-secondary']).toBe('#1e293b');
    expect(vars['--color-ink']).toBe('#0f172a');
    expect(vars['--theme-radius']).toBe('16px');
    expect(vars['--font-display']).toContain('Georgia');
    expect(vars['--font-sans']).toContain('Inter');
    expect(vars['--theme-base-font-size']).toBe('18px');
  });

  it('ignores invalid colors and non-whitelisted fonts', () => {
    const vars = themeCssVariables({
      branding: { primaryColor: 'red; background: url(x)' },
      typography: { headingFont: 'EvilFont", injected' },
    });
    expect(vars['--color-accent']).toBeUndefined();
    expect(vars['--font-display']).toBe("'Fraunces', Georgia, serif");
    expect(vars['--font-display']).not.toContain('injected');
  });

  it('leaves unset sections on the packaged defaults', () => {
    expect(themeCssVariables({})).toEqual({});
  });
});

describe('ThemeProvider', () => {
  it('applies published configuration as inline CSS variables', () => {
    render(
      <ThemeProvider theme={theme}>
        <p>content</p>
      </ThemeProvider>,
    );
    const root = screen.getByTestId('storefront-theme');
    expect(root.style.getPropertyValue('--color-accent')).toBe('#2563eb');
    expect(root.style.getPropertyValue('--theme-radius')).toBe('16px');
    expect(root.getAttribute('data-theme')).toBe('default');
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders children unchanged when no theme is published', () => {
    render(
      <ThemeProvider theme={null}>
        <p>content</p>
      </ThemeProvider>,
    );
    const root = screen.getByTestId('storefront-theme');
    expect(root.style.getPropertyValue('--color-accent')).toBe('');
    expect(root.getAttribute('data-theme')).toBe('default');
  });
});

describe('AnnouncementBar', () => {
  it('renders the announcement as a link when enabled', () => {
    render(<AnnouncementBar config={theme.configuration} storeSlug="alpha" />);
    const link = screen.getByRole('link', { name: 'Free shipping over $50' });
    expect(link).toHaveAttribute('href', '/products?store=alpha');
  });

  it('renders nothing when disabled or empty', () => {
    const { container } = render(
      <AnnouncementBar
        config={{ announcement: { enabled: false, text: 'Hidden' } }}
        storeSlug="alpha"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('HeroSection', () => {
  it('renders the configured hero copy and CTA', () => {
    render(
      <HeroSection
        config={theme.configuration}
        storeSlug="alpha"
        fallbackHeadline="Alpha Store"
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Shop the new arrivals' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Curated products, fast delivery.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse catalogue' })).toHaveAttribute(
      'href',
      '/products?store=alpha',
    );
  });

  it('falls back to store copy when the hero is unconfigured', () => {
    render(
      <HeroSection
        config={{}}
        storeSlug="alpha"
        fallbackHeadline="Alpha Store"
        fallbackSubheadline="Store description"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Alpha Store' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop products' })).toBeInTheDocument();
  });

  it('is hidden when the hero is disabled', () => {
    const { container } = render(
      <HeroSection
        config={{ hero: { enabled: false } }}
        storeSlug="alpha"
        fallbackHeadline="Alpha Store"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('featured sections', () => {
  it('renders featured categories with a configured title', () => {
    render(
      <FeaturedCategories
        title="Shop by category"
        storeSlug="alpha"
        categories={[
          {
            id: 'c1',
            name: 'Home',
            slug: 'home',
            description: null,
            imageUrl: null,
            parentId: null,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Shop by category' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/categories/home?store=alpha',
    );
  });

  it('shows an empty message when no products are featured', () => {
    render(<FeaturedProducts products={[]} storeSlug="alpha" title="Picks" />);
    expect(screen.getByRole('heading', { name: 'Picks' })).toBeInTheDocument();
    expect(screen.getByText(/no products published yet/i)).toBeInTheDocument();
  });
});

describe('storefront chrome with theme config', () => {
  it('uses the configured brand name and header menu', () => {
    window.localStorage.clear();
    render(
      <ThemeProvider theme={theme}>
        <CartProvider storeId="store-1" storeSlug="alpha" currency="USD">
          <StorefrontHeader store={store} />
        </CartProvider>
      </ThemeProvider>,
    );
    expect(screen.getByText('Alpha Goods')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Catalogue' })).toHaveAttribute(
      'href',
      '/products?store=alpha',
    );
  });

  it('renders footer copy, links, and payment icons from config', () => {
    render(
      <ThemeProvider theme={theme}>
        <StorefrontFooter store={store} />
      </ThemeProvider>,
    );
    expect(screen.getByText('© 2026 Alpha Goods')).toBeInTheDocument();
    expect(screen.getByText('Built with Ecomesta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'instagram' })).toHaveAttribute(
      'href',
      'https://instagram.com/alpha',
    );
    expect(
      screen.getByRole('list', { name: 'Payment methods' }),
    ).toBeInTheDocument();
  });
});
