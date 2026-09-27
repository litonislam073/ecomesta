import { BLOG_POSTS } from './blog';
import { FEATURE_PAGES } from './features';
import { PAYMENT_PAGES } from './payments';
import { SHIPPING_PAGES } from './shipping';
import { SOLUTION_PAGES } from './solutions';
import { contentPath, type ContentHub, type ContentPage } from './types';

export * from './types';
export { FEATURE_PAGES, PAYMENT_PAGES, SHIPPING_PAGES, SOLUTION_PAGES, BLOG_POSTS };

const PAGES_BY_HUB: Record<ContentHub, ContentPage[]> = {
  features: FEATURE_PAGES,
  payments: PAYMENT_PAGES,
  shipping: SHIPPING_PAGES,
  solutions: SOLUTION_PAGES,
};

export function pagesForHub(hub: ContentHub): ContentPage[] {
  return PAGES_BY_HUB[hub];
}

export function findContentPage(hub: ContentHub, slug: string): ContentPage | undefined {
  return PAGES_BY_HUB[hub].find((page) => page.slug === slug);
}

export const CONTENT_UPDATED = '2026-09-27';

/** Every indexable marketing route, used by the sitemap. */
export function indexableMarketingPaths(): string[] {
  const staticPaths = [
    '/',
    '/features',
    '/payments',
    '/shipping',
    '/pricing',
    '/solutions',
    '/resources',
    '/blog',
    '/faq',
    '/about',
    '/contact',
  ];
  const contentPaths = Object.values(PAGES_BY_HUB).flatMap((pages) =>
    pages.map(contentPath),
  );
  const blogPaths = BLOG_POSTS.map((post) => `/blog/${post.slug}`);
  return [...staticPaths, ...contentPaths, ...blogPaths];
}
