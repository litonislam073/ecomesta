import { CtaSection, FaqList, JsonLd, PageHero } from '@/components/marketing/blocks';
import { FadeUp } from '@/components/animations/fade';
import { Container } from '@/components/marketing/ui';
import { ALL_FAQS, FAQ_GROUPS } from '@/lib/marketing/content/faq';
import { breadcrumbJsonLd, buildMetadata, faqJsonLd } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/faq',
  title: 'Ecomesta FAQ — Online Store, Payments and Delivery Questions',
  description:
    'Answers about creating an Ecomesta store, custom domains, Cash on Delivery, SSLCommerz, Stripe, inventory, variants, coupons, order tracking and checkout.',
});

const CRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'FAQ', path: '/faq' },
];

export default function FaqPage() {
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(CRUMBS), faqJsonLd(ALL_FAQS)]} />
      <PageHero
        eyebrow="FAQ"
        title="Frequently asked questions"
        intro="Clear answers about what Ecomesta does today — from creating a store to payments, delivery and checkout."
        crumbs={CRUMBS}
      />
      <Container className="max-w-3xl space-y-12 py-14">
        {FAQ_GROUPS.map((group) => (
          <FadeUp as="section" key={group.heading} aria-labelledby={`faq-${group.heading}`}>
            <h2 id={`faq-${group.heading}`} className="font-display text-2xl tracking-tight">
              {group.heading}
            </h2>
            <div className="mt-5">
              <FaqList faqs={group.items} />
            </div>
          </FadeUp>
        ))}
      </Container>
      <CtaSection />
    </>
  );
}
