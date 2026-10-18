import { ContactLine, InlineLink, LegalPage, List, P, type LegalSection } from '@/components/marketing/legal-page';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/refund-policy',
  title: 'Refund Policy — Ecomesta',
  description:
    'When Ecomesta refunds plan payments, how to request a refund and how long it takes. Shoppers’ refunds for store orders are handled by each store.',
});

const SECTIONS: LegalSection[] = [
  {
    id: 'scope',
    title: 'What this policy covers',
    content: (
      <>
        <P>
          This policy covers payments merchants make to Ecomesta for their plan (monthly, 6-month or yearly
          subscriptions).
        </P>
        <P>
          <strong className="text-[var(--color-ink)]">Shopping on an Ecomesta store?</strong> Orders,
          returns and refunds for products are handled by the store you bought from, under that store’s own
          policy. Please contact the store directly.
        </P>
      </>
    ),
  },
  {
    id: 'eligible',
    title: 'When we refund a plan payment',
    content: (
      <>
        <P>We give a full refund when:</P>
        <List
          items={[
            'You paid twice for the same period, or paid more than the plan price.',
            'We could not confirm or did not accept your payment, and the money reached our account.',
            'You were charged for a plan or billing period you did not choose, because of an error on our side.',
            'Ecomesta was unavailable for a long period because of a problem on our side and we could not fix it within a reasonable time.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'not-eligible',
    title: 'When we do not refund',
    content: (
      <>
        <List
          items={[
            'For a billing period that has already started, including unused days if you stop using Ecomesta part-way through.',
            'For the remaining months of a 6-month or yearly plan after the period has started, because these plans are already discounted.',
            'When a store is paused or closed for breaking our Terms & Conditions.',
            'For fees charged by your mobile wallet or bank when you sent the payment.',
          ]}
        />
        <P>
          You can stop at any time by not renewing: your store keeps working until the end of the period you
          paid for.
        </P>
      </>
    ),
  },
  {
    id: 'how-to-request',
    title: 'How to request a refund',
    content: (
      <>
        <P>
          Please <ContactLine /> within 30 days of the payment, and include:
        </P>
        <List
          items={[
            'The email address of your Ecomesta account and your store name.',
            'The payment method (bKash, Nagad, Rocket or Upay), the number you paid from, the amount and the transaction ID.',
            'A short explanation of why you are asking for a refund.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'processing',
    title: 'How refunds are paid',
    content: (
      <List
        items={[
          'We review every request and reply within 3 working days.',
          'Approved refunds are sent to the same mobile wallet number the payment came from, within 7–10 working days.',
          'Refunds are made in Bangladeshi Taka (BDT) for the amount we received.',
          'If a refund means your plan is no longer paid, your store follows the normal grace period and pause rules in our Terms & Conditions.',
        ]}
      />
    ),
  },
  {
    id: 'changes',
    title: 'Changes and questions',
    content: (
      <P>
        We may update this policy; the version on this page applies to payments made after its “Last
        updated” date. See also our <InlineLink href="/terms">Terms & Conditions</InlineLink>. For any
        question about a payment, please <ContactLine />.
      </P>
    ),
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPage
      path="/refund-policy"
      title="Refund Policy"
      intro="When we refund Ecomesta plan payments, how to ask for a refund and how long it takes."
      sections={SECTIONS}
    />
  );
}
