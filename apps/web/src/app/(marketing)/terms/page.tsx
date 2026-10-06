import { ContactLine, InlineLink, LegalPage, List, P, type LegalSection } from '@/components/marketing/legal-page';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/terms',
  title: 'Terms & Conditions — Ecomesta',
  description:
    'The terms that apply when you create an Ecomesta account, run an online store on Ecomesta and pay for an Ecomesta plan.',
});

const SECTIONS: LegalSection[] = [
  {
    id: 'agreement',
    title: 'About these terms',
    content: (
      <>
        <P>
          These Terms & Conditions (“Terms”) are an agreement between you and Ecomesta (“Ecomesta”, “we”,
          “us”). They apply when you visit ecomesta.com, create a merchant account, or run an online store
          on Ecomesta (together, the “Service”).
        </P>
        <P>
          By creating an account or using the Service you agree to these Terms and to our{' '}
          <InlineLink href="/privacy-policy">Privacy Policy</InlineLink>. If you use Ecomesta for a business,
          you confirm that you are allowed to accept these Terms for that business.
        </P>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    content: (
      <List
        items={[
          'You must be at least 18 years old and give accurate, up-to-date information.',
          'You are responsible for keeping your password safe and for everything done through your account. Tell us straight away if you think someone else has accessed it.',
          'One person or business may hold more than one account only where the plan allows it, and accounts may not be shared or resold.',
        ]}
      />
    ),
  },
  {
    id: 'plans-and-payment',
    title: 'Plans and payment',
    content: (
      <>
        <List
          items={[
            'Ecomesta is a paid service. Prices are shown in Bangladeshi Taka (BDT) on our pricing page and may be billed monthly, every 6 months or yearly.',
            'Plans are paid in advance. You pay through bKash, Nagad, Rocket or Upay and submit your sending number and transaction ID. Your store is created when you submit the payment and goes live for customers once our team confirms it.',
            'If we cannot confirm a payment (for example, the transaction ID does not match), we will tell you and you can pay again from Plan & billing.',
            'When a paid period ends, payment for the next period is due. You have a 7-day grace period during which your store keeps working. If payment is not made by then, your store is paused until payment is completed. Your products, orders and settings are kept.',
            'Upgrades and plan changes take effect once the payment for the new plan is confirmed.',
            'We may change our prices. Price changes apply from your next billing period, and we will tell you before they take effect.',
          ]}
        />
        <P>
          Refunds are covered by our <InlineLink href="/refund-policy">Refund Policy</InlineLink>.
        </P>
      </>
    ),
  },
  {
    id: 'your-store',
    title: 'Your store and your customers',
    content: (
      <>
        <P>
          You are the seller in every sale made through your store. Ecomesta provides the software; we are
          not a party to the contract between you and your customers. You are responsible for:
        </P>
        <List
          items={[
            'Your products, their descriptions, prices, stock and images, and the accuracy of what you advertise.',
            'Fulfilling orders, delivery, returns, refunds and customer service for your shoppers.',
            'The payment providers you connect (such as SSLCommerz or Stripe) and your agreements with them.',
            'Following the laws that apply to your business, including consumer protection, tax and VAT, and the Digital Commerce Operation Guidelines of Bangladesh.',
            'Handling your customers’ personal information lawfully and publishing your own store policies where required.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    content: (
      <>
        <P>You may not use Ecomesta to:</P>
        <List
          items={[
            'Sell illegal, counterfeit, stolen or prohibited goods or services, including drugs, weapons, explosives, or anything banned under Bangladesh law.',
            'Mislead or defraud customers, run fake stores, or take payment for goods you do not intend to deliver.',
            'Infringe anyone’s copyright, trademark or other rights.',
            'Publish hateful, violent, sexually explicit or otherwise unlawful content.',
            'Send spam, spread malware, or try to break, overload or gain unauthorised access to the Service or other stores.',
            'Copy, resell or reverse-engineer the Service except where the law allows it.',
          ]}
        />
        <P>
          We may remove content, pause a store or close an account that breaks these rules. Where we
          reasonably can, we will tell you first and give you a chance to fix the problem.
        </P>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Your content',
    content: (
      <P>
        You keep ownership of the content you add to Ecomesta — products, images, text and logos. You give us
        permission to host, copy, display and process that content only as needed to run your store and
        provide the Service. You confirm you have the rights to everything you upload.
      </P>
    ),
  },
  {
    id: 'our-service',
    title: 'Our service',
    content: (
      <List
        items={[
          'Ecomesta, its software, design and brand belong to us. These Terms do not give you any rights to them other than to use the Service.',
          'We work to keep Ecomesta available and secure, but we cannot promise it will be uninterrupted or error-free. We may carry out maintenance, which we try to schedule at quiet times.',
          'We may add, change or remove features. If we remove a major feature you pay for, we will give you reasonable notice.',
          'Subdomains (such as yourstore.ecomesta.com) remain part of Ecomesta. Custom domains you own stay yours.',
        ]}
      />
    ),
  },
  {
    id: 'ending',
    title: 'Ending your use of Ecomesta',
    content: (
      <List
        items={[
          'You can stop using Ecomesta at any time by not renewing your plan, or delete your store from Settings → Danger zone. Deleting a store is permanent.',
          'We may suspend or close an account that seriously or repeatedly breaks these Terms, is used for fraud, or remains unpaid. Before closing an account for non-payment we will contact you.',
          'Sections that by their nature should continue (such as payment owed, content rights, limitation of liability and governing law) continue after your account ends.',
        ]}
      />
    ),
  },
  {
    id: 'liability',
    title: 'Disclaimers and limitation of liability',
    content: (
      <>
        <P>
          The Service is provided “as is” and “as available”. To the extent the law allows, we do not give
          warranties beyond those set out in these Terms.
        </P>
        <P>
          To the extent the law allows, Ecomesta is not liable for indirect or consequential losses, such as
          lost profits, lost sales or lost data, and our total liability for any claim relating to the
          Service is limited to the amount you paid us in the 12 months before the claim. Nothing in these
          Terms limits liability that cannot be limited by law.
        </P>
        <P>
          You agree to cover any claims, losses or costs that arise from your store, your products, your
          content or your breach of these Terms.
        </P>
      </>
    ),
  },
  {
    id: 'law',
    title: 'Governing law and disputes',
    content: (
      <P>
        These Terms are governed by the laws of Bangladesh. If a dispute arises, please contact us first —
        most issues can be solved quickly. If we cannot resolve it together, the courts of Dhaka, Bangladesh
        will have jurisdiction.
      </P>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    content: (
      <P>
        We may update these Terms from time to time. We will post the new version on this page with a new
        “Last updated” date and tell merchants about important changes by email or in the dashboard. If you
        keep using Ecomesta after the changes take effect, you accept the updated Terms.
      </P>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    content: (
      <P>
        Questions about these Terms? Please <ContactLine />.
      </P>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      path="/terms"
      title="Terms & Conditions"
      intro="The terms that apply when you create an Ecomesta account, run an online store on Ecomesta and pay for an Ecomesta plan."
      sections={SECTIONS}
    />
  );
}
