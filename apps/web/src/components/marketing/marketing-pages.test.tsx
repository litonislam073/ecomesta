import type { ReactElement } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FeaturesPage from '@/app/(marketing)/features/page';
import PaymentsPage from '@/app/(marketing)/payments/page';
import ShippingPage from '@/app/(marketing)/shipping/page';
import SolutionsPage from '@/app/(marketing)/solutions/page';
import PricingPage from '@/app/(marketing)/pricing/page';
import FaqPage from '@/app/(marketing)/faq/page';
import BlogPage from '@/app/(marketing)/blog/page';
import BlogPostPage from '@/app/(marketing)/blog/[slug]/page';
import ResourcesPage from '@/app/(marketing)/resources/page';
import AboutPage from '@/app/(marketing)/about/page';
import ContactPage from '@/app/(marketing)/contact/page';
import { ContentPageView } from '@/components/marketing/content-page';
import {
  FEATURE_PAGES,
  PAYMENT_PAGES,
  SHIPPING_PAGES,
  SOLUTION_PAGES,
  BLOG_POSTS,
  type ContentPage,
} from '@/lib/marketing/content';
import { FAQ_GROUPS } from '@/lib/marketing/content/faq';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const MERCHANT = 'https://merchant.example.com';

function expectSingleH1(ui: ReactElement, text?: string | RegExp) {
  render(ui);
  const h1s = screen.getAllByRole('heading', { level: 1 });
  expect(h1s).toHaveLength(1);
  if (text) {
    expect(h1s[0]).toHaveTextContent(text);
  }
  expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_MERCHANT_URL', MERCHANT);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('content pages', () => {
  const all: ContentPage[] = [
    ...FEATURE_PAGES,
    ...PAYMENT_PAGES,
    ...SHIPPING_PAGES,
    ...SOLUTION_PAGES,
  ];

  it('includes all required feature, payment, shipping and solution pages', () => {
    expect(FEATURE_PAGES.map((p) => p.slug).sort()).toEqual(
      [
        'coupons',
        'custom-domain',
        'customer-management',
        'inventory-management',
        'online-store',
        'order-management',
        'order-tracking',
        'product-management',
        'store-customization',
      ].sort(),
    );
    expect(PAYMENT_PAGES.map((p) => p.slug).sort()).toEqual(
      ['cash-on-delivery', 'online-payments', 'sslcommerz'].sort(),
    );
    expect(SHIPPING_PAGES.map((p) => p.slug).sort()).toEqual(['bangladesh', 'zones']);
    expect(SOLUTION_PAGES.map((p) => p.slug).sort()).toEqual(
      ['facebook-sellers', 'online-business', 'retailers', 'small-business'].sort(),
    );
  });

  it.each(all.map((page) => [`/${page.hub}/${page.slug}`, page] as const))(
    '%s renders one H1, breadcrumbs, FAQ, internal links and CTAs',
    (_path, page) => {
      render(<ContentPageView page={page} />);
      const h1s = screen.getAllByRole('heading', { level: 1 });
      expect(h1s).toHaveLength(1);
      expect(h1s[0]).toHaveTextContent(page.h1);
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
      expect(page.sections.length).toBeGreaterThanOrEqual(2);
      expect(page.faqs.length).toBeGreaterThan(0);
      expect(page.related.length).toBeGreaterThan(0);
      for (const link of page.related) {
        expect(link.href.startsWith('/')).toBe(true);
      }
      const registerLinks = screen
        .getAllByRole('link', { name: 'Create Your Store' })
        .map((a) => a.getAttribute('href'));
      expect(registerLinks.every((href) => href === `${MERCHANT}/register`)).toBe(true);
    },
  );
});

describe('hub and static pages', () => {
  it('renders the features hub linking to every feature page', () => {
    expectSingleH1(<FeaturesPage />);
    for (const page of FEATURE_PAGES) {
      expect(
        screen.getAllByRole('link').some((a) => a.getAttribute('href') === `/features/${page.slug}`),
      ).toBe(true);
    }
  });

  it('renders the payments page without claiming direct bKash or Nagad support', () => {
    expectSingleH1(<PaymentsPage />);
    expect(screen.getByText(/no direct bKash, Nagad or Rocket integrations/i)).toBeInTheDocument();
  });

  it('renders the shipping page with the courier limitation stated', () => {
    expectSingleH1(<ShippingPage />);
    expect(screen.getByText(/are not integrated/i)).toBeInTheDocument();
  });

  it('renders the solutions hub', () => {
    expectSingleH1(<SolutionsPage />);
  });

  it('renders a no-price fallback when plans cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { container } = render(await PricingPage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Simple pricing for your growing business',
    );
    expect(screen.getByText('Plan prices could not be loaded right now.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/৳\s?\d/);
    vi.unstubAllGlobals();
  });

  it('renders every FAQ group question', () => {
    expectSingleH1(<FaqPage />);
    for (const group of FAQ_GROUPS) {
      for (const faq of group.items) {
        expect(screen.getByRole('heading', { level: 3, name: faq.question })).toBeInTheDocument();
      }
    }
  });

  it('renders the blog index and each post', () => {
    expectSingleH1(<BlogPage />);
    for (const post of BLOG_POSTS) {
      expect(screen.getByRole('link', { name: new RegExp(post.title, 'i') })).toHaveAttribute(
        'href',
        `/blog/${post.slug}`,
      );
    }
    cleanup();
    for (const post of BLOG_POSTS) {
      const { container, unmount } = render(<BlogPostPage params={{ slug: post.slug }} />);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      const ld = Array.from(container.querySelectorAll('script[type="application/ld+json"]'))
        .map((node) => node.textContent ?? '')
        .join('');
      expect(ld).toContain('"Article"');
      unmount();
    }
  });

  it('renders resources and about pages', () => {
    expectSingleH1(<ResourcesPage />);
    cleanup();
    expectSingleH1(<AboutPage />);
  });

  it('shows the contact email only when configured', () => {
    render(<ContactPage />);
    expect(screen.getByText(/being set up/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /@/ })).toBeNull();
    cleanup();

    vi.stubEnv('NEXT_PUBLIC_CONTACT_EMAIL', 'hello@example.com');
    render(<ContactPage />);
    const section = screen.getByRole('heading', { name: 'Reach the Ecomesta team' }).closest('section')!;
    expect(within(section).getByRole('link', { name: 'hello@example.com' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com',
    );
  });
});
