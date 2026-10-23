import {
  isPlatformMarketingHost,
  resolveHostname,
  selectRequestHost,
  trustProxyEnabled,
} from '@/lib/domain-routing';
import { BLOG_POSTS } from '@/lib/marketing/content/blog';
import { CONTENT_UPDATED, indexableMarketingPaths } from '@/lib/marketing/content';
import { apiBaseUrl } from '@/lib/public-api';
import { hasBanglaVersion, toBanglaPath, toEnglishPath } from '@ecomesta/ui/marketing';
import { languageAlternates } from '@/lib/marketing/seo';
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
    '/merchant',
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
export function storefrontRobotsTxt(requestUrl?: string): string {
  const sitemapLine = requestUrl
    ? `Sitemap: ${new URL('/sitemap.xml', requestUrl).origin}/sitemap.xml`
    : null;
  return [
    'User-agent: *',
    'Allow: /',
    ...[...STOREFRONT_PRIVATE_PATHS, '/store-not-found'].map((path) => `Disallow: ${path}`),
    '',
    ...(sitemapLine ? [sitemapLine, ''] : []),
  ].join('\n');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type ChangeFrequency = 'weekly' | 'monthly' | 'yearly';

const LEGAL_PATHS = new Set(['/privacy-policy', '/terms', '/refund-policy', '/cookie-policy']);

/** Relative weight and expected update cadence for each kind of marketing page. */
export function sitemapHints(path: string): { priority: string; changeFrequency: ChangeFrequency } {
  if (path === '/') return { priority: '1.0', changeFrequency: 'weekly' };
  if (path === '/blog') return { priority: '0.6', changeFrequency: 'weekly' };
  if (path.startsWith('/blog/')) return { priority: '0.5', changeFrequency: 'yearly' };
  if (LEGAL_PATHS.has(path)) return { priority: '0.3', changeFrequency: 'yearly' };
  if (path === '/about' || path === '/contact') {
    return { priority: '0.5', changeFrequency: 'yearly' };
  }
  if (path.split('/').length > 2) return { priority: '0.7', changeFrequency: 'monthly' };
  return { priority: '0.8', changeFrequency: 'monthly' };
}

export function marketingSitemapXml(): string {
  const blogDates = new Map(
    BLOG_POSTS.map((post) => [`/blog/${post.slug}`, post.modifiedTime]),
  );
  const english = indexableMarketingPaths();
  const paths = [...english, ...english.filter(hasBanglaVersion).map(toBanglaPath)];
  const urls = paths.map((path) => {
    const { priority, changeFrequency } = sitemapHints(toEnglishPath(path) ?? path);
    const alternates = Object.entries(languageAlternates(path) ?? {}).map(
      ([hreflang, href]) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>`,
    );
    return [
      '  <url>',
      `    <loc>${escapeXml(absoluteUrl(path))}</loc>`,
      ...alternates,
      `    <lastmod>${blogDates.get(toEnglishPath(path) ?? path) ?? CONTENT_UPDATED}</lastmod>`,
      `    <changefreq>${changeFrequency}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

function requestHostname(headers: Headers): string {
  return (
    selectRequestHost({
      hostHeader: headers.get('host'),
      forwardedHostHeader: headers.get('x-forwarded-host'),
      trustProxy: trustProxyEnabled({
        TRUST_PROXY: process.env.TRUST_PROXY,
        TRUSTED_PROXY_HOPS: process.env.TRUSTED_PROXY_HOPS,
      }),
    }) ?? ''
  );
}

function storeOrigin(request: Request, canonicalHostname: string): string {
  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    new URL(request.url).protocol.replace(':', '') ||
    'https';
  return `${proto}://${canonicalHostname}`;
}

/** Sitemap for a merchant store host: home, catalog, categories, products. */
export async function storefrontSitemapXml(request: Request): Promise<string | null> {
  const host = requestHostname(request.headers);
  if (!host) return null;
  const resolution = await resolveHostname(host);
  if (resolution.status !== 'resolved') return null;

  const { storeSlug, canonicalHostname } = resolution.resolution;
  const origin = storeOrigin(request, canonicalHostname);
  const base = apiBaseUrl();

  const [categoriesRes, productsRes] = await Promise.all([
    fetch(`${base}/public/stores/${encodeURIComponent(storeSlug)}/categories`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }).then((r) => (r.ok ? r.json() : null)),
    fetch(
      `${base}/public/stores/${encodeURIComponent(storeSlug)}/products?limit=100&page=1`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' },
    ).then((r) => (r.ok ? r.json() : null)),
  ]);

  const categories =
    (categoriesRes?.data?.items as Array<{ slug: string }> | undefined) ?? [];
  const products =
    (productsRes?.data?.items as Array<{ slug: string }> | undefined) ?? [];

  const paths = [
    '/',
    '/products',
    '/categories',
    ...categories.map((c) => `/categories/${encodeURIComponent(c.slug)}`),
    ...products.map((p) => `/products/${encodeURIComponent(p.slug)}`),
  ];

  const today = new Date().toISOString().slice(0, 10);
  const urls = paths.map((path) => {
    const loc = path === '/' ? `${origin}/` : `${origin}${path}`;
    const priority =
      path === '/' ? '1.0' : path === '/products' || path === '/categories' ? '0.8' : '0.6';
    return [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      '    <changefreq>weekly</changefreq>',
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
