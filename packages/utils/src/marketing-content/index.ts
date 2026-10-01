/**
 * Public Ecomesta marketing content (feature, payment, shipping and solution
 * pages, FAQ and blog). Rendered by the website and used as knowledge by the
 * AI support agent, so both always say the same thing.
 */
import { BLOG_POSTS } from './blog.js';
import { FEATURE_PAGES } from './features.js';
import { PAYMENT_PAGES } from './payments.js';
import { SHIPPING_PAGES } from './shipping.js';
import { SOLUTION_PAGES } from './solutions.js';
import { contentPath, type ContentHub, type ContentPage } from './types.js';

export * from './types.js';
export * from './faq.js';
export { BLOG_CATEGORIES, formatPostDate, blogCategoryName, type BlogCategory, type BlogPost } from './blog.js';
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
