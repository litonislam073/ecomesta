import {
  isPlatformMarketingHost,
  selectRequestHost,
  trustProxyEnabled,
} from '@/lib/domain-routing';
import { BLOG_POSTS } from '@/lib/marketing/content/blog';
import { CONTENT_UPDATED, indexableMarketingPaths } from '@/lib/marketing/content';
import { absoluteUrl } from '@/lib/marketing/site';

export function requestIsMarketingHost(headers: Headers): boolean {
  const host = selectRequestHost({
    hostHeader: headers.get('host'),
    forwardedHostHeader: headers.get('x-forwarded-host'),
    trustProxy: trustProxyEnabled({
      TRUST_PROXY: process.env.TRUST_PROXY,
      TRUSTED_PROXY_HOPS: process.env.TRUSTED_PROXY_HOPS,
    }),
  });
  return isPlatformMarketingHost(host);
}

const STOREFRONT_PRIVATE_PATHS = [
  '/cart',
  '/checkout',
  '/payment/',
  '/order-confirmation/',
  '/track-order',
];

export function marketingRobotsTxt(): string {
  const disallow = [
    '/dashboard',
    '/admin',
    '/login',
    '/register',
    '/onboard',
    '/api',
    ...STOREFRONT_PRIVATE_PATHS,
  ];
  return [
    'User-agent: *',
    'Allow: /',
    ...disallow.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
    '',
  ].join('\n');
}

/** Served on merchant storefront hosts (custom domains and store subdomains). */
export function storefrontRobotsTxt(): string {
  return [
    'User-agent: *',
    'Allow: /',
    ...[...STOREFRONT_PRIVATE_PATHS, '/store-not-found'].map((path) => `Disallow: ${path}`),
    '',
  ].join('\n');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function marketingSitemapXml(): string {
  const blogDates = new Map(
    BLOG_POSTS.map((post) => [`/blog/${post.slug}`, post.modifiedTime]),
  );
  const urls = indexableMarketingPaths().map((path) => {
    const priority = path === '/' ? '1.0' : path.split('/').length > 2 ? '0.7' : '0.8';
    return [
      '  <url>',
      `    <loc>${escapeXml(absoluteUrl(path))}</loc>`,
      `    <lastmod>${blogDates.get(path) ?? CONTENT_UPDATED}</lastmod>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
