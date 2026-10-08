import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import type { StoreThemeConfig } from '@ecomesta/types';
import { ThemePreviewBridge } from '@/components/storefront/theme-preview-bridge';
import { ContentSection, homeSections, sectionAnchor } from '@/components/storefront/content-sections';
import { THEME_PREVIEW_HEADER, readThemePreviewToken, withThemePreview } from '@/lib/theme-preview';
import { middleware } from '@/middleware';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams('store=alpha'),
  usePathname: () => '/',
  notFound: vi.fn(),
}));

const TOKEN = 'Ab-_'.repeat(8);

describe('theme preview token', () => {
  it('accepts only 32 URL-safe characters', () => {
    expect(readThemePreviewToken(TOKEN)).toBe(TOKEN);
    expect(readThemePreviewToken('short')).toBeNull();
    expect(readThemePreviewToken(`${TOKEN}x`)).toBeNull();
    expect(readThemePreviewToken('a'.repeat(31) + '/')).toBeNull();
    expect(readThemePreviewToken(null)).toBeNull();
  });

  it('keeps the token on internal links', () => {
    expect(withThemePreview('/products?store=alpha#top', TOKEN)).toBe(`/products?store=alpha&theme_preview=${TOKEN}#top`);
  });
});

describe('middleware: theme preview header', () => {
  const run = (url: string, headers: Record<string, string> = {}) => middleware(new NextRequest(url, { headers }));
  const forwarded = (response: Response) => response.headers.get(`x-middleware-request-${THEME_PREVIEW_HEADER}`);

  it('forwards a well-formed token for a store page', async () => {
    const response = await run(`http://localhost:3000/products?store=alpha&theme_preview=${TOKEN}`);
    expect(forwarded(response)).toBe(TOKEN);
  });

  it('never trusts the header from the client, nor a malformed token', async () => {
    expect(forwarded(await run('http://localhost:3000/products?store=alpha', { [THEME_PREVIEW_HEADER]: TOKEN }))).toBeNull();
    expect(forwarded(await run('http://localhost:3000/products?store=alpha&theme_preview=bad'))).toBeNull();
  });
});

describe('homepage sections', () => {
  const config = (sections: Record<string, unknown>[]) =>
    ({ homepage: { sections } }) as unknown as StoreThemeConfig;

  it('follows the editor order; no list means the default rows', () => {
    expect(homeSections({}).map((s) => s.type)).toEqual(['featured_categories', 'featured_products']);
    expect(
      homeSections(
        config([
          { type: 'image_banner', id: 'b1' },
          { type: 'featured_products' },
          { type: 'rich_text', id: 'r1' },
          { type: 'rich_text', id: 'r2' },
          { type: 'featured_products' },
          { type: 'custom' },
        ]),
      ).map((s) => `${s.type}${s.id ? `:${s.id}` : ''}`),
    ).toEqual(['image_banner:b1', 'featured_products', 'rich_text:r1', 'rich_text:r2']);
  });

  it('gives content sections their own preview anchor', () => {
    expect(sectionAnchor({ type: 'rich_text', id: 'r1' }, 3)).toBe('section:r1');
    expect(sectionAnchor({ type: 'image_banner' }, 3)).toBe('section:3');
    expect(sectionAnchor({ type: 'featured_products' }, 0)).toBe('featured_products');
  });

  it('renders rich text as plain text and an image banner with its button', () => {
    render(
      <>
        <ContentSection
          index={0}
          storeSlug="alpha"
          section={{ type: 'rich_text', id: 'r1', title: 'Our story', text: 'Made in Dhaka.\nSince 2020.', buttonLabel: 'Read more', buttonHref: '/products' }}
        />
        <ContentSection
          index={1}
          storeSlug="alpha"
          section={{ type: 'image_banner', id: 'b1', title: 'Eid sale', imageUrl: 'https://cdn.example/eid.jpg', buttonLabel: 'Shop', buttonHref: '/products' }}
        />
        <ContentSection index={2} storeSlug="alpha" section={{ type: 'rich_text', id: 'hidden', title: 'Hidden', enabled: false }} />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Our story' }).closest('section')).toHaveAttribute('data-theme-section', 'section:r1');
    expect(screen.getByText(/Made in Dhaka\./)).toHaveClass('whitespace-pre-line');
    expect(screen.getByRole('link', { name: 'Read more' })).toHaveAttribute('href', '/products?store=alpha');
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/products?store=alpha');
    expect(screen.getByRole('heading', { name: 'Eid sale' }).closest('section')!.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/eid.jpg');
    expect(screen.queryByRole('heading', { name: 'Hidden' })).toBeNull();
  });
});

describe('preview bridge', () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    window.history.replaceState({}, '', `/?store=alpha&theme_preview=${TOKEN}`);
  });
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('keeps links inside the preview', () => {
    render(
      <>
        <ThemePreviewBridge />
        <a href="/products?store=alpha">Shop</a>
        <a href="https://elsewhere.example/" onClick={(event) => event.preventDefault()}>
          Away
        </a>
      </>,
    );
    fireEvent.click(screen.getByText('Shop'));
    expect(push).toHaveBeenCalledWith(`/products?store=alpha&theme_preview=${TOKEN}`);
    push.mockReset();
    fireEvent.click(screen.getByText('Away'), { button: 0 });
    expect(push).not.toHaveBeenCalled();
  });

  it('refreshes when the editor (parent window) says the draft changed', () => {
    render(<ThemePreviewBridge />);
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'other', action: 'refresh' }, source: window.parent }));
    });
    expect(refresh).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'ecomesta-theme-preview', action: 'refresh' }, source: window.parent }),
      );
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does nothing outside a preview', () => {
    window.history.replaceState({}, '', '/?store=alpha');
    render(
      <>
        <ThemePreviewBridge />
        <a href="/products?store=alpha" onClick={(event) => event.preventDefault()}>
          Shop
        </a>
      </>,
    );
    fireEvent.click(screen.getByText('Shop'));
    expect(push).not.toHaveBeenCalled();
  });
});
