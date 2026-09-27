import { CtaSection, JsonLd, LinkCard, PageHero } from '@/components/marketing/blocks';
import { Container, SectionHeader } from '@/components/marketing/ui';
import { BLOG_POSTS } from '@/lib/marketing/content/blog';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/resources',
  title: 'Ecommerce Resources for Bangladesh Merchants | Ecomesta',
  description:
    'Guides, FAQs and setup references for launching and running an online store in Bangladesh with Ecomesta.',
});

const CRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Resources', path: '/resources' },
];

const SETUP_GUIDES = [
  {
    href: '/features/online-store',
    title: 'Launching your store',
    description: 'What happens from registration to your first order.',
  },
  {
    href: '/shipping/zones',
    title: 'Setting up delivery zones',
    description: 'Zones, flat and free rates, thresholds and COD rules.',
  },
  {
    href: '/payments/sslcommerz',
    title: 'Connecting SSLCommerz',
    description: 'Credentials, sandbox mode and how payments are validated.',
  },
  {
    href: '/features/custom-domain',
    title: 'Connecting a custom domain',
    description: 'TXT verification, DNS and primary domains.',
  },
  {
    href: '/features/store-customization',
    title: 'Customizing your storefront',
    description: 'Branding, layout and SEO settings with draft and preview.',
  },
  {
    href: '/features/coupons',
    title: 'Creating coupon codes',
    description: 'Discount types and the rules you can set.',
  },
];

export default function ResourcesPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(CRUMBS)} />
      <PageHero
        eyebrow="Resources"
        title="Learn how to launch and grow your online store"
        intro="Setup references for each part of Ecomesta, practical articles on selling in Bangladesh, and answers to common questions."
        crumbs={CRUMBS}
      />
      <section aria-labelledby="setup-guides" className="py-14">
        <Container>
          <SectionHeader id="setup-guides" title="Setup guides" />
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SETUP_GUIDES.map((guide) => (
              <li key={guide.href}>
                <LinkCard href={guide.href} title={guide.title} description={guide.description} />
              </li>
            ))}
          </ul>
        </Container>
      </section>
      <section aria-labelledby="from-the-blog" className="border-t border-[var(--color-border)] bg-white py-14">
        <Container>
          <SectionHeader id="from-the-blog" title="From the blog" />
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {BLOG_POSTS.map((post) => (
              <li key={post.slug}>
                <LinkCard href={`/blog/${post.slug}`} title={post.title} description={post.description} />
              </li>
            ))}
          </ul>
        </Container>
      </section>
      <section aria-labelledby="more-help" className="py-14">
        <Container>
          <SectionHeader id="more-help" title="More help" />
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            <li>
              <LinkCard href="/faq" title="Frequently asked questions" description="Payments, delivery, checkout and more." />
            </li>
            <li>
              <LinkCard href="/contact" title="Contact" description="Questions about plans or getting started." />
            </li>
          </ul>
        </Container>
      </section>
      <CtaSection />
    </>
  );
}
