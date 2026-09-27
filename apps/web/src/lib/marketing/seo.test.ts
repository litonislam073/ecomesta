// @vitest-environment node
import type { Metadata } from 'next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const SITE = 'https://ecomesta.com';

type OpenGraphish = { url?: string; images?: unknown };

function titleOf(metadata: Metadata): string {
  const title = metadata.title as { absolute?: string } | string | undefined;
  return typeof title === 'string' ? title : (title?.absolute ?? '');
}

describe('marketing SEO', () => {
  const pages: { path: string; metadata: Metadata }[] = [];

  beforeAll(async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    vi.stubEnv('NEXT_PUBLIC_MERCHANT_URL', 'https://merchant.ecomesta.com');

    const staticPages: [string, () => Promise<{ metadata: Metadata }>][] = [
      ['/features', () => import('@/app/(marketing)/features/page')],
      ['/payments', () => import('@/app/(marketing)/payments/page')],
      ['/shipping', () => import('@/app/(marketing)/shipping/page')],
      ['/pricing', () => import('@/app/(marketing)/pricing/page')],
      ['/solutions', () => import('@/app/(marketing)/solutions/page')],
      ['/resources', () => import('@/app/(marketing)/resources/page')],
      ['/blog', () => import('@/app/(marketing)/blog/page')],
      ['/faq', () => import('@/app/(marketing)/faq/page')],
      ['/about', () => import('@/app/(marketing)/about/page')],
      ['/contact', () => import('@/app/(marketing)/contact/page')],
    ];
    for (const [path, load] of staticPages) {
      pages.push({ path, metadata: (await load()).metadata });
    }

    const { PLATFORM_HOME_METADATA } = await import('@/components/platform-home');
    pages.push({ path: '/', metadata: PLATFORM_HOME_METADATA });

    const { contentRoute } = await import('@/lib/marketing/content-route');
    const { pagesForHub, contentPath } = await import('@/lib/marketing/content');
    for (const hub of ['features', 'payments', 'shipping', 'solutions'] as const) {
      const route = contentRoute(hub);
      for (const page of pagesForHub(hub)) {
        pages.push({
          path: contentPath(page),
          metadata: route.generateMetadata({ params: { slug: page.slug } }),
        });
      }
    }

    const blogPost = await import('@/app/(marketing)/blog/[slug]/page');
    const { BLOG_POSTS } = await import('@/lib/marketing/content/blog');
    for (const post of BLOG_POSTS) {
      pages.push({
        path: `/blog/${post.slug}`,
        metadata: blogPost.generateMetadata({ params: { slug: post.slug } }),
      });
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
  });

  it('covers every indexable marketing path', async () => {
    const { indexableMarketingPaths } = await import('@/lib/marketing/content');
    expect(pages.map((p) => p.path).sort()).toEqual([...indexableMarketingPaths()].sort());
  });

  it('gives every page a unique title and description', () => {
    const titles = pages.map((p) => titleOf(p.metadata));
    const descriptions = pages.map((p) => p.metadata.description);
    expect(titles.every(Boolean)).toBe(true);
    expect(new Set(titles).size).toBe(pages.length);
    expect(new Set(descriptions).size).toBe(pages.length);
    const outOfRange = pages
      .filter(({ metadata }) => {
        const description = metadata.description ?? '';
        return (
          titleOf(metadata).length > 70 || description.length < 50 || description.length > 170
        );
      })
      .map(({ path, metadata }) => `${path} (${titleOf(metadata).length}/${metadata.description?.length})`);
    expect(outOfRange).toEqual([]);
  });

  it('sets absolute canonical, Open Graph and Twitter metadata', () => {
    for (const { path, metadata } of pages) {
      const expected = `${SITE}${path}`;
      expect(String(metadata.alternates?.canonical), path).toBe(expected);
      const og = metadata.openGraph as OpenGraphish;
      expect(og.url, path).toBe(expected);
      expect(og.images, path).toBeTruthy();
      expect((metadata.twitter as { card?: string }).card, path).toBe('summary_large_image');
    }
  });

  it('keeps every indexable page indexable and free of development URLs', () => {
    for (const { path, metadata } of pages) {
      expect(metadata.robots, path).toEqual({ index: true, follow: true });
      expect(JSON.stringify(metadata), path).not.toMatch(/localhost|127\.0\.0\.1/);
    }
  });

  it('marks the login and register redirects as noindex', async () => {
    const login = await import('@/app/(marketing)/login/page');
    const register = await import('@/app/(marketing)/register/page');
    expect(login.metadata.robots).toEqual({ index: false, follow: false });
    expect(register.metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe('robots.txt and sitemap.xml', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function get(host: string) {
    return new Request(`http://${host}/`, { headers: { host } });
  }

  it('serves marketing robots with private paths disallowed on the platform host', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    const { GET } = await import('@/app/robots.txt/route');
    const body = await GET(get('ecomesta.com')).text();
    for (const path of ['/dashboard', '/admin', '/login', '/register', '/onboard', '/api']) {
      expect(body).toContain(`Disallow: ${path}\n`);
    }
    expect(body).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  it('serves storefront robots without the platform sitemap on store hosts', async () => {
    const { GET } = await import('@/app/robots.txt/route');
    const body = await GET(get('shop.example.com')).text();
    expect(body).toContain('Disallow: /checkout');
    expect(body).not.toContain('Sitemap:');
  });

  it('lists indexable pages and excludes private routes', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    const { GET } = await import('@/app/sitemap.xml/route');
    const response = GET(get('localhost:3000'));
    expect(response.status).toBe(200);
    const xml = await response.text();
    for (const path of ['/', '/features/order-management', '/payments/sslcommerz', '/pricing', '/blog']) {
      expect(xml).toContain(`<loc>${SITE}${path}</loc>`);
    }
    for (const path of ['/login', '/register', '/dashboard', '/onboard', '/admin', '/cart', '/checkout']) {
      expect(xml).not.toContain(`<loc>${SITE}${path}</loc>`);
    }
  });

  it('produces a well-formed sitemap of every indexable page and nothing else', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    const { marketingSitemapXml } = await import('@/lib/marketing/seo-files');
    const { indexableMarketingPaths } = await import('@/lib/marketing/content');
    const xml = marketingSitemapXml();

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? '');
    expect(locs).toEqual(indexableMarketingPaths().map((path) => `${SITE}${path}`));
    expect(new Set(locs).size).toBe(locs.length);
    expect(xml.match(/<url>/g)).toHaveLength(locs.length);
    expect(xml.match(/<changefreq>(weekly|monthly|yearly)<\/changefreq>/g)).toHaveLength(locs.length);
    expect(xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)).toHaveLength(locs.length);
    expect(xml).not.toMatch(/localhost|127\.0\.0\.1|store-(unavailable|not-found)/);
    expect(locs.filter((loc) => loc.includes('?') || (loc.endsWith('/') && loc !== `${SITE}/`))).toEqual([]);
    expect(xml).toContain(`<loc>${SITE}/</loc>\n    <lastmod>`);
    expect(xml).toMatch(new RegExp(`<loc>${SITE}/</loc>[\\s\\S]*?<priority>1.0</priority>`));
  });

  it('never blocks the whole marketing site in robots.txt', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    const { marketingRobotsTxt } = await import('@/lib/marketing/seo-files');
    const body = marketingRobotsTxt();
    expect(body).toMatch(/^User-agent: \*\nAllow: \/\n/);
    expect(body).not.toMatch(/^Disallow: \/$/m);
    expect(body).toContain('Disallow: /merchant\n');
    for (const path of ['/features', '/pricing', '/blog', '/faq']) {
      expect(body).not.toMatch(new RegExp(`^Disallow: ${path}`, 'm'));
    }
    expect(body.match(/^Sitemap: /gm)).toHaveLength(1);
  });

  it('returns 404 for the sitemap on store hosts', async () => {
    const { GET } = await import('@/app/sitemap.xml/route');
    expect(GET(get('alpha.ecomesta.local')).status).toBe(404);
    expect(GET(get('shop.example.com')).status).toBe(404);
  });
});

describe('structured data', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('links Organization, WebSite and SoftwareApplication with a real logo', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    const seo = await import('@/lib/marketing/seo');
    const organization = seo.organizationJsonLd();
    const website = seo.websiteJsonLd();
    const app = seo.softwareApplicationJsonLd();

    expect(organization).toMatchObject({
      '@type': 'Organization',
      '@id': `${SITE}/#organization`,
      name: 'Ecomesta',
      url: `${SITE}/`,
      logo: { url: `${SITE}/apple-icon.png`, width: 180, height: 180 },
    });
    expect(website).toMatchObject({ '@id': `${SITE}/#website`, publisher: { '@id': `${SITE}/#organization` } });
    expect(app).toMatchObject({ publisher: { '@id': `${SITE}/#organization` } });

    const text = JSON.stringify([organization, website, app]);
    expect(text).not.toMatch(/aggregateRating|review|ratingValue|localhost/i);
  });

  it('builds breadcrumbs and FAQ markup from the visible content', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    const { breadcrumbJsonLd, faqJsonLd } = await import('@/lib/marketing/seo');
    expect(
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Pricing', path: '/pricing' },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${SITE}/pricing` },
      ],
    });
    const faq = faqJsonLd([{ question: 'Q?', answer: 'A.' }]);
    expect(faq.mainEntity).toEqual([
      { '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } },
    ]);
  });
});

describe('merchant and site URLs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the configured merchant URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_MERCHANT_URL', 'https://merchant.example.com/');
    const { registerUrl, loginUrl } = await import('@/lib/marketing/site');
    expect(registerUrl()).toBe('https://merchant.example.com/register');
    expect(loginUrl()).toBe('https://merchant.example.com/login');
  });

  it('never falls back to localhost in production builds', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_MERCHANT_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', '');
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN', 'ecomesta.com');
    const { registerUrl, siteUrl } = await import('@/lib/marketing/site');
    expect(registerUrl()).toBe('https://merchant.ecomesta.com/register');
    expect(siteUrl()).toBe('https://ecomesta.com');
  });
});

describe('content claims', () => {
  it('only mentions unsupported providers in a negative context', async () => {
    const content = await import('@/lib/marketing/content');
    const { ALL_FAQS } = await import('@/lib/marketing/content/faq');
    const text = JSON.stringify([
      content.FEATURE_PAGES,
      content.PAYMENT_PAGES,
      content.SHIPPING_PAGES,
      content.SOLUTION_PAGES,
      content.BLOG_POSTS,
      ALL_FAQS,
    ]);
    const sentences = text.split(/(?<=[.?!])\s+|","/);
    const unsupported = /\b(bKash|Nagad|Rocket|Pathao|Steadfast|RedX)\b/i;
    for (const sentence of sentences.filter((s) => unsupported.test(s))) {
      expect(sentence, sentence).toMatch(/\b(no|not)\b|\?$/i);
    }
  });

  it('contains no fabricated social proof or ratings', async () => {
    const content = await import('@/lib/marketing/content');
    const text = JSON.stringify([
      content.FEATURE_PAGES,
      content.PAYMENT_PAGES,
      content.SHIPPING_PAGES,
      content.SOLUTION_PAGES,
      content.BLOG_POSTS,
    ]);
    expect(text).not.toMatch(/trusted by|#1\b|award-winning|\d[\d,]*\+ (merchants|stores|sellers)|aggregateRating/i);
  });
});
