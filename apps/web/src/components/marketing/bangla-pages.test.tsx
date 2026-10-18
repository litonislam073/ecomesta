import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  alternateLanguagePath,
  footerNav,
  localizedHref,
  primaryNav,
  toBanglaPath,
  toEnglishPath,
} from '@ecomesta/ui/marketing';
import type { PublicPlan } from '@ecomesta/types';
import { MarketingHome } from '@/components/marketing/marketing-home';
import { PricingPlans } from '@/components/marketing/pricing-plans';
import { HOME_COPY } from '@/components/marketing/home-copy';

vi.mock('next/navigation', () => ({ usePathname: () => '/bn', useRouter: () => ({ push: vi.fn() }) }));

describe('Bangla page paths', () => {
  it('maps pages between English and Bangla', () => {
    expect(toBanglaPath('/')).toBe('/bn');
    expect(toBanglaPath('/pricing')).toBe('/bn/pricing');
    expect(toEnglishPath('/bn')).toBe('/');
    expect(toEnglishPath('/bn/pricing')).toBe('/pricing');
    expect(toEnglishPath('/features')).toBeNull();
  });

  it('offers the other language only where a translation exists', () => {
    expect(alternateLanguagePath('/')).toEqual({ locale: 'bn', href: '/bn' });
    expect(alternateLanguagePath('/pricing/')).toEqual({ locale: 'bn', href: '/bn/pricing' });
    expect(alternateLanguagePath('/bn/pricing')).toEqual({ locale: 'en', href: '/pricing' });
    expect(alternateLanguagePath('/features/coupons')).toEqual({ locale: 'bn', href: '/bn/features/coupons' });
    expect(alternateLanguagePath('/bn/blog/facebook-page-to-online-store')).toEqual({
      locale: 'en',
      href: '/blog/facebook-page-to-online-store',
    });
    expect(alternateLanguagePath('/login')).toBeNull();
    expect(alternateLanguagePath('/bn/login')).toBeNull();
  });

  it('links Bangla navigation to Bangla pages when they exist', () => {
    expect(localizedHref('/pricing', 'bn')).toBe('/bn/pricing');
    expect(localizedHref('/features', 'bn')).toBe('/bn/features');
    expect(localizedHref('/login', 'bn')).toBe('/login');
    const nav = primaryNav('bn');
    expect(nav.find((item) => item.href === '/bn/pricing')?.label).toBe('প্যাকেজ ও দাম');
    expect(nav.find((item) => item.href === '/bn')?.label).toBe('হোম');
    expect(primaryNav('en').find((item) => item.href === '/pricing')?.label).toBe('Pricing');
    expect(footerNav('bn')[0]?.heading).toBe('প্রোডাক্ট');
  });
});

describe('Bangla home and pricing', () => {
  it('renders the home page in Bangla with its own FAQ', () => {
    render(<MarketingHome locale="bn" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(HOME_COPY.bn.hero.title);
    expect(screen.getByRole('heading', { name: 'অনলাইনে বিক্রির জন্য যা যা লাগে, সব আছে' })).toBeInTheDocument();
    expect(screen.getByText('Ecomesta কী?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'আজই অনলাইন স্টোর খুলতে চান?' })).toBeInTheDocument();
  });

  it('keeps the English home text unchanged', () => {
    render(<MarketingHome />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Build Your Online Store. Sell More. Manage Everything in One Place.',
    );
    expect(screen.getByRole('heading', { name: 'Ready to open your online store?' })).toBeInTheDocument();
  });

  it('shows plan cards in Bangla and translates known plan text', () => {
    const plan = {
      name: 'Business',
      slug: 'business',
      description: null,
      tagline: 'For established online businesses',
      features: ['Unlimited products', 'Some new feature'],
      highlighted: true,
      currency: 'BDT',
      monthlyPrice: 699,
      trialMonths: 0,
      prices: [{ billingCycle: 'MONTHLY', months: 1, amount: 699, effectiveMonthly: 699, discountPercent: 0 }],
      limits: null,
    } as unknown as PublicPlan;
    render(<PricingPlans plans={[plan]} merchantOrigin="https://merchant.ecomesta.com" locale="bn" />);
    expect(screen.getByText('প্রতিষ্ঠিত অনলাইন ব্যবসার জন্য')).toBeInTheDocument();
    expect(screen.getByText('যত খুশি প্রোডাক্ট')).toBeInTheDocument();
    // Text without a translation stays in English rather than disappearing.
    expect(screen.getByText('Some new feature')).toBeInTheDocument();
    expect(screen.getByText('সবচেয়ে জনপ্রিয়')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Business নিন' })).toHaveAttribute(
      'href',
      'https://merchant.ecomesta.com/register?plan=business&interval=monthly',
    );
  });
});
