import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MarketingFooter } from '@ecomesta/ui/marketing';
import { isPlatformHost } from '@/components/marketing/platform-not-found-links';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));

describe('Ecomesta contact links', () => {
  it('shows phone, WhatsApp and social profiles in the footer', () => {
    render(<MarketingFooter siteOrigin="" loginHref="/login" registerHref="/register" contactEmail="support@ecomesta.com" />);
    expect(screen.getByRole('link', { name: /09697-493407/ })).toHaveAttribute('href', 'tel:+8809697493407');
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/8801318090622');
    const social = screen.getByRole('list', { name: 'Ecomesta on social media' });
    expect(within(social).getByRole('link', { name: 'Ecomesta on Facebook' })).toHaveAttribute('href', 'https://www.facebook.com/ecomesta');
    expect(within(social).getByRole('link', { name: 'Ecomesta on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/@Ecomesta');
  });
});

describe('404 page links', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('only treats the Ecomesta website as the platform, never a store', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ecomesta.com');
    expect(isPlatformHost('ecomesta.com', '')).toBe(true);
    expect(isPlatformHost('www.ecomesta.com', '')).toBe(true);
    expect(isPlatformHost('alpha.ecomesta.com', '')).toBe(false);
    expect(isPlatformHost('shop.example.com', '')).toBe(false);
    expect(isPlatformHost('ecomesta.com', '?store=alpha')).toBe(false);
  });
});
