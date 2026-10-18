import { ContactLine, InlineLink, LegalPage, List, P, type LegalSection } from '@/components/marketing/legal-page';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/cookie-policy',
  title: 'Cookie Policy — Ecomesta',
  description:
    'The cookies and similar technologies Ecomesta uses on its website, merchant dashboard and online stores, and how to control them.',
});

const COOKIES = [
  {
    name: 'ecomesta_refresh_token',
    purpose: 'Keeps you signed in to the merchant dashboard securely (HttpOnly, not readable by scripts).',
    type: 'Essential',
  },
  {
    name: 'ecomesta.storeSlug, ecomesta.canonicalHost',
    purpose: 'Remembers which store a page belongs to so the right storefront is shown.',
    type: 'Essential',
  },
  {
    name: 'Cart (browser storage)',
    purpose: 'Remembers the items in a shopper’s cart on a store.',
    type: 'Essential',
  },
  {
    name: 'Google Tag Manager / Google Analytics (_ga, _ga_*)',
    purpose: 'Counts visits and shows how ecomesta.com is used. Only on our website, never on merchant stores.',
    type: 'Analytics',
  },
];

const SECTIONS: LegalSection[] = [
  {
    id: 'what-are-cookies',
    title: 'What cookies are',
    content: (
      <P>
        Cookies are small text files a website saves in your browser. Similar technologies, such as browser
        local storage, work in a comparable way. They let a site remember you between pages and visits.
      </P>
    ),
  },
  {
    id: 'cookies-we-use',
    title: 'Cookies we use',
    content: (
      <>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-[var(--brand-tint)] text-[var(--color-ink)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                <th scope="col" className="px-4 py-3 font-semibold">Purpose</th>
                <th scope="col" className="px-4 py-3 font-semibold">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-muted)]">
              {COOKIES.map((cookie) => (
                <tr key={cookie.name}>
                  <td className="px-4 py-3 align-top font-medium text-[var(--color-ink)]">{cookie.name}</td>
                  <td className="px-4 py-3 align-top leading-relaxed">{cookie.purpose}</td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        cookie.type === 'Essential'
                          ? 'bg-[var(--brand-green-tint)] text-[var(--brand-green-text)]'
                          : 'bg-[var(--brand-tint-strong)] text-[var(--color-accent)]'
                      }`}
                    >
                      {cookie.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          <strong className="text-[var(--color-ink)]">Essential</strong> cookies are needed for sign-in,
          stores and carts to work, so they cannot be switched off.{' '}
          <strong className="text-[var(--color-ink)]">Analytics</strong> cookies help us improve our website.
        </P>
      </>
    ),
  },
  {
    id: 'third-parties',
    title: 'Third-party cookies',
    content: (
      <>
        <P>Some features use services from other companies, which may set their own cookies:</P>
        <List
          items={[
            'Google — Google sign-in, Google Tag Manager and Google Analytics.',
            'Cloudflare — security and performance cookies that protect the site from abuse.',
            'Payment providers — such as SSLCommerz or Stripe, during online checkout on a store.',
          ]}
        />
        <P>These companies handle that information under their own privacy policies.</P>
      </>
    ),
  },
  {
    id: 'merchant-stores',
    title: 'Cookies on merchant stores',
    content: (
      <P>
        Online stores on Ecomesta use the essential cookies above. A merchant may also add their own tools
        to their store; those are the merchant’s responsibility and are covered by the store’s own policies.
      </P>
    ),
  },
  {
    id: 'control',
    title: 'How to control cookies',
    content: (
      <>
        <P>
          You can block or delete cookies in your browser settings. If you block essential cookies, you will
          not be able to sign in or use a cart. To stop Google Analytics on any website, you can use
          Google’s opt-out browser add-on.
        </P>
      </>
    ),
  },
  {
    id: 'more',
    title: 'More information',
    content: (
      <P>
        For how we handle personal information in general, read our{' '}
        <InlineLink href="/privacy-policy">Privacy Policy</InlineLink>. Questions? Please <ContactLine />.
      </P>
    ),
  },
];

export default function CookiePolicyPage() {
  return (
    <LegalPage
      path="/cookie-policy"
      title="Cookie Policy"
      intro="The cookies and similar technologies Ecomesta uses, why we use them and how you can control them."
      sections={SECTIONS}
    />
  );
}
