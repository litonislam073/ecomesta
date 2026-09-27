import { HubPageView } from '@/components/marketing/content-page';
import { CheckList, Container, SectionHeader } from '@/components/marketing/ui';
import { PAYMENT_PAGES } from '@/lib/marketing/content';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/payments',
  title: 'Payment Options for Online Stores in Bangladesh | Ecomesta',
  description:
    'Accept Cash on Delivery, SSLCommerz and Stripe payments on your online store. Learn how payment options, verification and merchant configuration work on Ecomesta.',
});

const OPTIONS = [
  {
    name: 'Cash on Delivery',
    who: 'Customers who prefer to pay on arrival',
    setup: 'No external account; allowed per delivery method',
  },
  {
    name: 'SSLCommerz',
    who: 'Online payments in Bangladesh',
    setup: 'Your SSLCommerz store ID and password',
  },
  {
    name: 'Stripe',
    who: 'Card payments via Stripe Checkout',
    setup: 'Your Stripe secret key and webhook secret',
  },
  {
    name: 'Bank transfer / other offline',
    who: 'Manual payments you confirm yourself',
    setup: 'Enable in payment settings',
  },
  {
    name: 'Test payments',
    who: 'Development and staging',
    setup: 'No real money is moved',
  },
];

export default function PaymentsPage() {
  return (
    <HubPageView
      crumbs={[
        { name: 'Home', path: '/' },
        { name: 'Payments', path: '/payments' },
      ]}
      eyebrow="Payments"
      title="Accept payments your customers prefer"
      intro="Offer Cash on Delivery and online payments side by side. Each store connects its own payment accounts, and every online payment is confirmed with the provider before an order is marked paid."
      pages={PAYMENT_PAGES}
    >
      <section aria-labelledby="payment-options" className="border-t border-[var(--color-border)] bg-white py-16">
        <Container>
          <SectionHeader
            id="payment-options"
            title="Payment options at a glance"
            description="A provider appears at checkout only after the store has connected and enabled it."
          />
          <div className="mt-8 overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-[#f3f6f5] text-[var(--color-ink)]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Option</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Best for</th>
                  <th scope="col" className="px-4 py-3 font-semibold">What you need</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {OPTIONS.map((option) => (
                  <tr key={option.name}>
                    <th scope="row" className="px-4 py-3 font-semibold">{option.name}</th>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{option.who}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{option.setup}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold">What customers see</h3>
              <CheckList
                className="mt-4"
                items={[
                  'Available options for their chosen delivery method',
                  'A redirect to the provider’s hosted page for online payments',
                  'A success, failure or cancellation page back on your store',
                  'The option to pay again if a payment did not go through',
                ]}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Not available today</h3>
              <p className="mt-4 text-[var(--color-muted)]">
                There are no direct bKash, Nagad or Rocket integrations, and refunds are not processed
                through gateways automatically. Customers can use the methods enabled on your
                SSLCommerz account, and refunds are issued from your provider’s own panel.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </HubPageView>
  );
}
