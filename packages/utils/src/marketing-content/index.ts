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
import { BLOG_CATEGORIES_BN, BLOG_POSTS_BN } from './bn/blog.js';
import { FAQ_GROUPS_BN } from './bn/faq.js';
import { FEATURE_PAGES_BN } from './bn/features.js';
import { PAYMENT_PAGES_BN } from './bn/payments.js';
import { SHIPPING_PAGES_BN } from './bn/shipping.js';
import { SOLUTION_PAGES_BN } from './bn/solutions.js';
import { BLOG_CATEGORIES, type BlogCategory, type BlogPost } from './blog.js';
import { FAQ_GROUPS, type FaqGroup } from './faq.js';

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

/** Marketing site languages; Bangla pages live under /bn. */
export type ContentLocale = 'en' | 'bn';

const PAGES_BY_HUB_BN: Record<ContentHub, ContentPage[]> = {
  features: FEATURE_PAGES_BN,
  payments: PAYMENT_PAGES_BN,
  shipping: SHIPPING_PAGES_BN,
  solutions: SOLUTION_PAGES_BN,
};

export function pagesForHub(hub: ContentHub, locale: ContentLocale = 'en'): ContentPage[] {
  return (locale === 'bn' ? PAGES_BY_HUB_BN : PAGES_BY_HUB)[hub];
}

export function findContentPage(
  hub: ContentHub,
  slug: string,
  locale: ContentLocale = 'en',
): ContentPage | undefined {
  return pagesForHub(hub, locale).find((page) => page.slug === slug);
}

export function blogPosts(locale: ContentLocale = 'en'): BlogPost[] {
  return locale === 'bn' ? BLOG_POSTS_BN : BLOG_POSTS;
}

export function blogCategories(locale: ContentLocale = 'en'): BlogCategory[] {
  return locale === 'bn' ? BLOG_CATEGORIES_BN : BLOG_CATEGORIES;
}

export function blogCategoryLabel(slug: string, locale: ContentLocale = 'en'): string {
  return blogCategories(locale).find((c) => c.slug === slug)?.name ?? slug;
}

export function faqGroups(locale: ContentLocale = 'en'): FaqGroup[] {
  return locale === 'bn' ? FAQ_GROUPS_BN : FAQ_GROUPS;
}

export const CONTENT_UPDATED = '2026-10-18';

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
    '/affiliate',
    '/privacy-policy',
    '/terms',
    '/refund-policy',
    '/cookie-policy',
    '/shopify-alternative-bangladesh',
  ];
  const contentPaths = Object.values(PAGES_BY_HUB).flatMap((pages) =>
    pages.map(contentPath),
  );
  const blogPaths = BLOG_POSTS.map((post) => `/blog/${post.slug}`);
  return [...staticPaths, ...contentPaths, ...blogPaths];
}

/** "17 October 2026" in English, "১৭ অক্টোবর ২০২৬" in Bangla. */
export function formatPostDateFor(iso: string, locale: ContentLocale = 'en'): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
