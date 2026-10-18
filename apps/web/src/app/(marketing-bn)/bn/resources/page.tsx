import { CtaSection, JsonLd, LinkCard, PageHero } from '@/components/marketing/blocks';
import { blogPostPath } from '@/components/marketing/blog-views';
import { FadeUp } from '@/components/animations/fade';
import { StaggerContainer } from '@/components/animations/stagger';
import { StaggerItem } from '@/components/animations/stagger-item';
import { Container, SectionHeader } from '@/components/marketing/ui';
import { blogPosts } from '@/lib/marketing/content';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/bn/resources',
  locale: 'bn',
  title: 'বাংলাদেশের মার্চেন্টদের জন্য ই-কমার্স গাইড ও রিসোর্স | Ecomesta',
  description: 'Ecomesta দিয়ে বাংলাদেশে অনলাইন স্টোর চালু আর চালানোর গাইড, সাধারণ প্রশ্ন আর সেটআপের তথ্য।',
});

const CRUMBS = [
  { name: 'হোম', path: '/bn' },
  { name: 'গাইড', path: '/bn/resources' },
];

const SETUP_GUIDES = [
  { href: '/bn/features/online-store', title: 'স্টোর চালু করা', description: 'রেজিস্ট্রেশন থেকে প্রথম অর্ডার পর্যন্ত কী হয়।' },
  { href: '/bn/shipping/zones', title: 'ডেলিভারি জোন সেট করা', description: 'জোন, নির্দিষ্ট ও ফ্রি চার্জ, সীমা আর COD নিয়ম।' },
  { href: '/bn/payments/sslcommerz', title: 'SSLCommerz যুক্ত করা', description: 'তথ্য, sandbox মোড আর পেমেন্ট কীভাবে যাচাই হয়।' },
  { href: '/bn/features/custom-domain', title: 'নিজের ডোমেইন যুক্ত করা', description: 'TXT যাচাই, DNS আর মূল ডোমেইন।' },
  { href: '/bn/features/store-customization', title: 'স্টোর সাজানো', description: 'ড্রাফট আর প্রিভিউসহ ব্র্যান্ডিং, লেআউট আর SEO।' },
  { href: '/bn/features/coupons', title: 'কুপন কোড বানানো', description: 'ছাড়ের ধরন আর যে নিয়ম ঠিক করতে পারেন।' },
];

export default function BanglaResourcesPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(CRUMBS)} />
      <PageHero
        locale="bn"
        eyebrow="গাইড ও রিসোর্স"
        title="অনলাইন স্টোর চালু করা আর বড় করার গাইড"
        intro="Ecomesta-র প্রতিটি অংশের সেটআপ গাইড, বাংলাদেশে বিক্রি নিয়ে কাজের লেখা, আর সাধারণ প্রশ্নের উত্তর।"
        crumbs={CRUMBS}
      />
      <section aria-labelledby="setup-guides" className="py-14">
        <Container>
          <FadeUp>
            <SectionHeader id="setup-guides" title="সেটআপ গাইড" />
          </FadeUp>
          <StaggerContainer as="ul" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SETUP_GUIDES.map((guide) => (
              <StaggerItem as="li" key={guide.href}>
                <LinkCard href={guide.href} title={guide.title} description={guide.description} locale="bn" />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>
      <section aria-labelledby="from-the-blog" className="border-t border-[var(--color-border)] bg-white py-14">
        <Container>
          <FadeUp>
            <SectionHeader id="from-the-blog" title="ব্লগ থেকে" />
          </FadeUp>
          <StaggerContainer as="ul" className="mt-6 grid gap-4 md:grid-cols-3">
            {blogPosts('bn').map((post) => (
              <StaggerItem as="li" key={post.slug}>
                <LinkCard href={blogPostPath(post.slug, 'bn')} title={post.title} description={post.description} locale="bn" />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>
      <section aria-labelledby="more-help" className="py-14">
        <Container>
          <FadeUp>
            <SectionHeader id="more-help" title="আরও সাহায্য" />
          </FadeUp>
          <StaggerContainer as="ul" className="mt-6 grid gap-4 sm:grid-cols-2">
            <StaggerItem as="li">
              <LinkCard href="/bn/faq" title="সাধারণ প্রশ্ন" description="পেমেন্ট, ডেলিভারি, চেকআউট আর আরও অনেক কিছু।" locale="bn" />
            </StaggerItem>
            <StaggerItem as="li">
              <LinkCard href="/bn/contact" title="যোগাযোগ" description="প্যাকেজ বা শুরু করা নিয়ে প্রশ্ন।" locale="bn" />
            </StaggerItem>
          </StaggerContainer>
        </Container>
      </section>
      <CtaSection locale="bn" />
    </>
  );
}
