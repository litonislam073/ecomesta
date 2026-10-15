import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroSection } from '@/components/storefront/hero-section';
import { ImageBannerSection, RichTextSection } from '@/components/storefront/content-sections';
import { safeColor } from '@/lib/theme';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/' }));

describe('merchant text colours on banners', () => {
  it('accepts only hex colours', () => {
    expect(safeColor('#ABCDEF')).toBe('#abcdef');
    expect(safeColor('')).toBeUndefined();
    expect(safeColor('red')).toBeUndefined();
    expect(safeColor('#fff;x')).toBeUndefined();
  });

  it('colours the hero headline and text separately', () => {
    render(
      <HeroSection
        config={{ hero: { enabled: true, headline: 'Big sale', subheadline: 'Today only', headingColor: '#ff0000', textColor: '#00ff00' } }}
        storeSlug="alpha"
        fallbackHeadline="Shop"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Big sale' })).toHaveStyle({ color: '#ff0000' });
    expect(screen.getByText('Today only')).toHaveStyle({ color: '#00ff00' });
  });

  it('colours image banner and rich text sections, and ignores bad values', () => {
    const { rerender } = render(
      <ImageBannerSection
        anchor="b"
        storeSlug="alpha"
        section={{ type: 'image_banner', title: 'New in', text: 'Baby girl collection', headingColor: '#123456', textColor: '#654321' }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'New in' })).toHaveStyle({ color: '#123456' });
    expect(screen.getByText('Baby girl collection')).toHaveStyle({ color: '#654321' });
    expect(screen.getByRole('heading', { name: 'New in' }).parentElement?.getAttribute('style') ?? '').not.toContain('color');
    rerender(<RichTextSection anchor="r" storeSlug="alpha" section={{ type: 'rich_text', title: 'About us', text: 'Hello', headingColor: 'not-a-colour' }} />);
    expect(screen.getByRole('heading', { name: 'About us' }).getAttribute('style') ?? '').not.toContain('not-a-colour');
  });
});
