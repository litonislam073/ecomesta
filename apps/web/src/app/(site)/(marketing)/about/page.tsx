import { CtaSection, JsonLd, PageHero } from '@/components/marketing/blocks';
import { FadeUp } from '@/components/animations/fade';
import { CheckList, Container } from '@/components/marketing/ui';
import { breadcrumbJsonLd, buildMetadata, organizationJsonLd } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/about',
  title: 'About Ecomesta — A Bangladesh-First Ecommerce Platform',
  description:
      'Ecomesta is an ecommerce platform built for how Bangladesh businesses sell: BDT pricing, local addresses, zone-based delivery, Cash on Delivery and online payments.',
});

const CRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(CRUMBS), organizationJsonLd()]} />
      <PageHero
        eyebrow="About"
        title="Ecommerce software shaped around Bangladesh"
        intro="Ecomesta exists so Bangladesh businesses can run a proper online store without stitching together plugins, spreadsheets and chat threads."
        crumbs={CRUMBS}
      />
      <Container className="max-w-3xl space-y-12 py-14">
        <FadeUp as="section">
          <h2 className="font-display text-2xl tracking-tight">Why we built Ecomesta</h2>
          <p className="mt-4 text-lg leading-relaxed text-[var(--color-muted)]">
            Many ecommerce tools are designed for other markets first. Selling in Bangladesh has its
            own realities: prices in Taka, delivery charged by area, customers who prefer Cash on
            Delivery, and local payment gateways. Ecomesta starts from those realities instead of
            adding them later.
          </p>
        </FadeUp>
        <FadeUp as="section">
          <h2 className="font-display text-2xl tracking-tight">What we care about</h2>
          <CheckList
            className="mt-5"
            items={[
              'Accuracy — prices, discounts and delivery charges are calculated on the server',
              'Trust — online payments count only after the provider confirms them',
              'Privacy — every store’s data is isolated from other stores',
              'Honesty — we describe what the product does today, not what it might do someday',
            ]}
          />
        </FadeUp>
        <FadeUp as="section">
          <h2 className="font-display text-2xl tracking-tight">Where we are today</h2>
          <p className="mt-4 text-lg leading-relaxed text-[var(--color-muted)]">
            Ecomesta already covers the core of an online store — catalog, inventory, orders,
            payments, delivery zones, coupons, themes and custom domains. Plans start at ৳99 a month, and we
            are improving the platform with feedback from merchants.
          </p>
        </FadeUp>
      </Container>
      <CtaSection />
    </>
  );
}
