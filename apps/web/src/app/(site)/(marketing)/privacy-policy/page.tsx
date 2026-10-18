import { ContactLine, InlineLink, LegalPage, List, P, type LegalSection } from '@/components/marketing/legal-page';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/privacy-policy',
  title: 'Privacy Policy — Ecomesta',
  description:
    'How Ecomesta collects, uses and protects information about merchants, their customers and visitors to our website.',
});

const SECTIONS: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    content: (
      <>
        <P>
          Ecomesta (“Ecomesta”, “we”, “us”) provides an ecommerce platform that lets businesses in
          Bangladesh create and run online stores. This policy explains what information we collect, why
          we collect it and the choices you have.
        </P>
        <P>
          It covers our website (ecomesta.com), the merchant dashboard, and the online stores that run on
          Ecomesta. Each merchant is responsible for how they use their own customers’ information; for
          that information Ecomesta acts as a service provider that stores and processes it on the
          merchant’s behalf.
        </P>
      </>
    ),
  },
  {
    id: 'information-we-collect',
    title: 'Information we collect',
    content: (
      <>
        <P>
          <strong className="text-[var(--color-ink)]">From merchants</strong> — when you create an account
          and set up a store:
        </P>
        <List
          items={[
            'Account details: your name, email address, optional phone number and password (stored only as a secure hash). If you sign in with Google, we receive your name, email address and Google account ID.',
            'Store details: business and store name, web address, custom domains, logo, theme and settings.',
            'Store content: products, prices, images, inventory, coupons, delivery zones and charges.',
            'Billing details: your chosen plan, payment method (bKash, Nagad, Rocket or Upay), the mobile number you paid from, transaction IDs and payment history. We do not receive your wallet PIN or card number.',
          ]}
        />
        <P>
          <strong className="text-[var(--color-ink)]">From shoppers on merchant stores</strong> — when
          someone places an order: name, phone number, email address (if given), delivery address and
          order details. Online card and mobile-wallet payments are processed by the payment provider the
          merchant has enabled (such as SSLCommerz or Stripe); we receive the payment status and
          reference, not full card details.
        </P>
        <P>
          <strong className="text-[var(--color-ink)]">From website visitors</strong>:
        </P>
        <List
          items={[
            'Usage information such as pages viewed, device, browser and approximate location, collected through Google Tag Manager and the analytics tools it loads.',
            'Messages you send to our AI support assistant on ecomesta.com, together with the page you were on.',
            'Anything you send us through the contact page or by email.',
          ]}
        />
        <P>
          <strong className="text-[var(--color-ink)]">Technical information</strong>: IP address, log
          data and security events, which we use to keep the service running and protect it from abuse.
        </P>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How we use information',
    content: (
      <List
        items={[
          'To provide the service: run your account and store, process orders, calculate delivery charges and show your storefront to shoppers.',
          'To handle billing: confirm your plan payments, activate or renew your store and keep payment records.',
          'To communicate with you: verification and password-reset emails, order and billing notifications, and replies to your questions.',
          'To provide support, including answers from our AI support assistant.',
          'To keep the platform secure: detect fraud, abuse and unauthorised access.',
          'To improve Ecomesta: understand how the website and dashboard are used, in aggregate.',
          'To meet legal obligations, such as keeping financial records.',
        ]}
      />
    ),
  },
  {
    id: 'ai-support',
    title: 'AI support assistant',
    content: (
      <>
        <P>
          The support chat on ecomesta.com is answered by an AI assistant. Your messages are sent to our
          AI provider (OpenAI) to generate a reply. Conversations are saved so our team can review them
          and improve answers, and are deleted automatically after 365 days.
        </P>
        <P>
          Please do not share passwords, payment PINs or other sensitive personal information in the chat.
          The assistant is not available on merchant stores.
        </P>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'How we share information',
    content: (
      <>
        <P>We do not sell personal information. We share it only:</P>
        <List
          items={[
            'Between a merchant and their shoppers, as needed to fulfil orders — the merchant can see the orders placed in their store.',
            'With service providers that help us run Ecomesta: hosting and content delivery (including Cloudflare), email delivery, payment providers, Google (sign-in and analytics) and OpenAI (AI support). They may use the information only to provide their service to us.',
            'When required by law, a court order or a government authority, or to protect the rights, property or safety of Ecomesta, our users or others.',
            'If Ecomesta is involved in a merger, acquisition or sale of assets, in which case we will tell you before your information becomes subject to a different policy.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies',
    content: (
      <P>
        We use cookies and similar technologies to keep you signed in, remember your cart and preferences,
        and understand how our website is used. Read the <InlineLink href="/cookie-policy">Cookie Policy</InlineLink>{' '}
        for details.
      </P>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep information',
    content: (
      <List
        items={[
          'Account and store data are kept while your account is active. If you delete your store, its data is removed from the live service, and backups are overwritten in the normal backup cycle.',
          'Billing and payment records are kept as long as needed for accounting and legal requirements.',
          'AI support conversations are deleted after 365 days.',
          'Security logs are kept for a limited period and then deleted.',
        ]}
      />
    ),
  },
  {
    id: 'security',
    title: 'How we protect information',
    content: (
      <P>
        Each store’s data is kept separate from every other store. Connections are encrypted with HTTPS,
        passwords are hashed, access to production systems is restricted, and data is backed up regularly.
        No system is perfectly secure, so please use a strong, unique password and keep your login details
        private.
      </P>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your choices and rights',
    content: (
      <>
        <List
          items={[
            'You can view and update your account and store details from the merchant dashboard.',
            'You can delete your store from Settings → Danger zone, or ask us to close your account.',
            'You can ask for a copy of your personal information, or ask us to correct or delete it.',
            'You can opt out of non-essential emails using the link in those emails. Account and billing emails are part of the service.',
            'You can block or delete cookies in your browser settings.',
          ]}
        />
        <P>
          Shoppers who want to access or delete information held by a store should contact that store
          first; we will help the merchant respond.
        </P>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    content: (
      <P>
        Ecomesta is a business service and is not intended for children. Merchant accounts may only be
        created by people aged 18 or over. We do not knowingly collect information from children.
      </P>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    content: (
      <P>
        We may update this policy as Ecomesta changes. We will post the new version on this page with a new
        “Last updated” date, and tell merchants by email or in the dashboard about important changes.
      </P>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    content: (
      <P>
        Questions about this policy or your information? Please <ContactLine />.
      </P>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      path="/privacy-policy"
      title="Privacy Policy"
      intro="How Ecomesta collects, uses and protects information about merchants, their customers and visitors to our website."
      sections={SECTIONS}
    />
  );
}
