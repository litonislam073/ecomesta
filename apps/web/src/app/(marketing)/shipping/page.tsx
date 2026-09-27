import { Flow } from '@/components/marketing/blocks';
import { HubPageView } from '@/components/marketing/content-page';
import { FadeUp } from '@/components/animations/fade';
import { CheckList, Container, SectionHeader } from '@/components/marketing/ui';
import { SHIPPING_PAGES } from '@/lib/marketing/content';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/shipping',
  title: 'Ecommerce Shipping and Delivery Charges in Bangladesh | Ecomesta',
  description:
    'Configure delivery for your online store across Bangladesh: shipping zones by division, district and upazila, flat and free rates, free-shipping thresholds and COD rules.',
});

export default function ShippingPage() {
  return (
    <HubPageView
      crumbs={[
        { name: 'Home', path: '/' },
        { name: 'Shipping', path: '/shipping' },
      ]}
      eyebrow="Shipping"
      title="Bangladesh-first shipping for your online store"
      intro="Delivery in Bangladesh is priced by area. Ecomesta includes the full location list and lets you set delivery options per zone, so every customer sees the right charge at checkout."
      pages={SHIPPING_PAGES}
    >
      <section aria-labelledby="shipping-flow" className="border-t border-[var(--color-border)] bg-white py-16">
        <Container className="space-y-10">
          <FadeUp>
            <SectionHeader
              id="shipping-flow"
              title="From address to delivery charge"
              description="The customer’s address selects a zone, the zone offers methods, and the chosen method sets the rate — all calculated on the server."
            />
          </FadeUp>
          <FadeUp delay={0.06}>
            <Flow
              label="Delivery charge calculation"
              steps={['Division', 'District', 'Upazila', 'Shipping zone', 'Shipping method', 'Shipping rate']}
            />
          </FadeUp>
          <FadeUp className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold">Included today</h3>
              <CheckList
                className="mt-4"
                items={[
                  '8 divisions, 64 districts and 552 upazilas and thanas',
                  'Zones with priorities and store-wide fallback methods',
                  'Flat-rate and free delivery methods',
                  'Free-shipping thresholds',
                  'Cash on Delivery eligibility per method',
                  'Shipping snapshots saved on orders',
                  'Shipments with status and tracking numbers',
                ]}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Couriers</h3>
              <p className="mt-4 text-[var(--color-muted)]">
                Courier APIs such as Pathao, Steadfast or RedX are not integrated. Book deliveries
                with your courier as usual and add the tracking number to the order’s shipment — the
                customer sees it on the order tracking page.
              </p>
            </div>
          </FadeUp>
        </Container>
      </section>
    </HubPageView>
  );
}
