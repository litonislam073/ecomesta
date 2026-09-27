import Link from 'next/link';
import { ALL_FAQS } from '@/lib/marketing/content/faq';
import { SOLUTION_PAGES } from '@/lib/marketing/content';
import {
  faqJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from '@/lib/marketing/seo';
import { registerUrl } from '@/lib/marketing/site';
import { CtaSection, FaqList, Flow, JsonLd, LinkCard } from './blocks';
import { DashboardPreview } from './dashboard-preview';
import { Icon, IconBadge, type IconName } from './icons';
import { ButtonLink, CheckList, Container, SectionHeader, TextLink } from './ui';

const MANAGE: { icon: IconName; label: string; href: string }[] = [
  { icon: 'store', label: 'Online Store', href: '/features/online-store' },
  { icon: 'box', label: 'Products', href: '/features/product-management' },
  { icon: 'layers', label: 'Inventory', href: '/features/inventory-management' },
  { icon: 'receipt', label: 'Orders', href: '/features/order-management' },
  { icon: 'card', label: 'Payments', href: '/payments' },
  { icon: 'truck', label: 'Shipping', href: '/shipping' },
  { icon: 'users', label: 'Customers', href: '/features/customer-management' },
  { icon: 'tag', label: 'Marketing', href: '/features/coupons' },
  { icon: 'palette', label: 'Store Design', href: '/features/store-customization' },
];

const FEATURES: { icon: IconName; title: string; body: string; points: string[]; href: string; linkLabel: string }[] = [
  {
    icon: 'store',
    title: 'Store Builder',
    body: 'Create a professional online store and customize the storefront.',
    points: ['Cart, guest checkout and order tracking', 'Free platform subdomain'],
    href: '/features/online-store',
    linkLabel: 'How the online store works',
  },
  {
    icon: 'box',
    title: 'Product Management',
    body: 'Manage products, categories, variants and inventory.',
    points: ['Variants with their own price and stock', 'Draft, active and archived'],
    href: '/features/product-management',
    linkLabel: 'Explore product management',
  },
  {
    icon: 'receipt',
    title: 'Order Management',
    body: 'Track orders from pending through fulfillment.',
    points: ['Order, payment and fulfillment status', 'Shipments with tracking numbers'],
    href: '/features/order-management',
    linkLabel: 'See how orders flow',
  },
  {
    icon: 'users',
    title: 'Customer Management',
    body: 'Manage customer records and addresses.',
    points: ['Multiple addresses per customer', 'Private to your store'],
    href: '/features/customer-management',
    linkLabel: 'About customer records',
  },
  {
    icon: 'card',
    title: 'Payments',
    body: 'Cash on Delivery, SSLCommerz, Stripe and a test provider.',
    points: ['Providers connected per store', 'Payments verified on the server'],
    href: '/payments',
    linkLabel: 'Compare payment options',
  },
  {
    icon: 'truck',
    title: 'Bangladesh Shipping',
    body: 'Divisions, districts and upazilas with zone-based rates.',
    points: ['Free-shipping thresholds', 'COD allowed per delivery method'],
    href: '/shipping',
    linkLabel: 'Plan your delivery zones',
  },
  {
    icon: 'tag',
    title: 'Coupons',
    body: 'Percentage and fixed discounts with rules you control.',
    points: ['Usage and per-customer limits', 'Minimum order value and validity dates'],
    href: '/features/coupons',
    linkLabel: 'Set up coupon codes',
  },
  {
    icon: 'palette',
    title: 'Store Customization',
    body: 'Branding, typography, hero, header, footer and SEO settings.',
    points: ['Draft, preview and publish', 'Two built-in themes'],
    href: '/features/store-customization',
    linkLabel: 'Customize your storefront',
  },
  {
    icon: 'globe',
    title: 'Custom Domains',
    body: 'Connect a domain you own to your store.',
    points: ['DNS TXT verification', 'Primary domain for search engines'],
    href: '/features/custom-domain',
    linkLabel: 'Connect your domain',
  },
];

const PAYMENTS: { icon: IconName; title: string; body: string; href: string }[] = [
  {
    icon: 'cash',
    title: 'Cash on Delivery',
    body: 'Customers pay when the order is delivered. Allow or block COD for each delivery method.',
    href: '/payments/cash-on-delivery',
  },
  {
    icon: 'shield',
    title: 'SSLCommerz',
    body: 'Bangladesh-focused hosted payment flow, validated with SSLCommerz on the server before an order is marked paid.',
    href: '/payments/sslcommerz',
  },
  {
    icon: 'card',
    title: 'Stripe',
    body: 'Hosted Stripe Checkout for card payments where you have a supported Stripe account.',
    href: '/payments/online-payments',
  },
  {
    icon: 'flask',
    title: 'Test payments',
    body: 'Try the complete online payment flow in development and staging without real money.',
    href: '/payments/online-payments',
  },
];

const HOME_FAQ_QUESTIONS = [
  'What is Ecomesta?',
  'Does Ecomesta support Cash on Delivery?',
  'Can I use my own domain?',
  'Do customers need an account?',
  'Can I manage inventory?',
];

export function MarketingHome() {
  const register = registerUrl();
  const homeFaqs = ALL_FAQS.filter((faq) => HOME_FAQ_QUESTIONS.includes(faq.question));

  return (
    <>
      <JsonLd
        data={[organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd(), faqJsonLd(homeFaqs)]}
      />

      <section aria-labelledby="hero-heading" className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 10% 0%, rgba(15,107,92,0.14), transparent 70%), radial-gradient(ellipse 45% 40% at 100% 100%, rgba(196,140,70,0.12), transparent 70%)',
          }}
        />
        <Container className="relative grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-sm font-medium text-[var(--color-accent)]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              Ecommerce platform for Bangladesh
            </p>
            <h1
              id="hero-heading"
              className="mt-6 font-display text-4xl leading-[1.08] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-[3.4rem]"
            >
              Build Your Online Store. Sell More. Manage Everything in One Place.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
              Ecomesta helps Bangladesh businesses create and manage online stores with products,
              inventory, orders, payments, shipping and customer management from one platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={register} cta="create-store-hero">
                Create Your Store
              </ButtonLink>
              <ButtonLink href="/features" variant="secondary">
                Explore Features
              </ButtonLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-muted)]">
              {['Cash on Delivery', 'SSLCommerz payments', 'Division–district–upazila delivery'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:pl-4">
            <DashboardPreview />
          </div>
        </Container>
      </section>

      <section aria-labelledby="manage-heading" className="py-16">
        <Container>
          <h2 id="manage-heading" className="text-center text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
            Manage your whole store from one platform
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
            {MANAGE.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-2 py-4 text-center text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Icon name={item.icon} className="h-6 w-6 text-[var(--color-accent)]" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="features-heading" className="border-y border-[var(--color-border)] bg-white py-20">
        <Container>
          <SectionHeader
            id="features-heading"
            eyebrow="Features"
            title="Everything you need to sell online"
            description="The tools a Bangladesh online store uses every day — connected, so stock, payments and delivery charges stay consistent."
          />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[#fbfaf7] p-6">
                <IconBadge name={feature.icon} />
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-[var(--color-muted)]">{feature.body}</p>
                <CheckList items={feature.points} className="mt-4 text-sm" />
                <TextLink href={feature.href} className="mt-auto pt-5 text-sm">
                  {feature.linkLabel} →
                </TextLink>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="payments-heading" className="py-20">
        <Container>
          <SectionHeader
            id="payments-heading"
            eyebrow="Payments"
            title="Accept Payments Your Customers Prefer"
            description="Offer Cash on Delivery and online payments side by side. Each store connects the providers it wants with its own merchant accounts."
          />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PAYMENTS.map((payment) => (
              <li key={payment.title}>
                <Link
                  href={payment.href}
                  className="group flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-white p-6 transition hover:border-[var(--color-accent)] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <IconBadge name={payment.icon} />
                  <h3 className="mt-4 text-lg font-semibold group-hover:text-[var(--color-accent)]">{payment.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{payment.body}</p>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl text-sm text-[var(--color-muted)]">
            Totals are always calculated by Ecomesta, and an online payment only counts once the
            provider confirms it. bKash and Nagad are not integrated directly; customers can pay with
            the methods enabled on your SSLCommerz account.
          </p>
        </Container>
      </section>

      <section aria-labelledby="shipping-heading" className="border-y border-[var(--color-border)] bg-[#eef5f2] py-20">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeader
              id="shipping-heading"
              eyebrow="Bangladesh shipping"
              title="Delivery charges that follow real delivery areas"
              description="All 8 divisions, 64 districts and 552 upazilas are built in. Group them into zones, add delivery methods and let checkout calculate the right charge."
            />
            <CheckList
              className="mt-6"
              items={[
                'Zone-based flat or free delivery',
                'Free-shipping thresholds per method',
                'Cash on Delivery allowed or blocked per method',
                'Shipping details saved on every order',
              ]}
            />
            <div className="mt-8 flex flex-wrap gap-4">
              <TextLink href="/shipping/bangladesh">Bangladesh delivery setup →</TextLink>
              <TextLink href="/shipping/zones">Zones and rates →</TextLink>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-[var(--color-muted)]">How a delivery charge is chosen</p>
            <ol className="mt-4 space-y-2">
              {['Division', 'District', 'Upazila', 'Shipping zone', 'Shipping method', 'Shipping rate'].map((step, index, all) => (
                <li key={step}>
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[#fbfaf7] px-4 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="font-medium">{step}</span>
                  </div>
                  {index < all.length - 1 ? (
                    <span aria-hidden="true" className="ml-6 block h-2 border-l-2 border-dashed border-[var(--color-border)]" />
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <section aria-labelledby="builder-heading" className="py-20">
        <Container>
          <SectionHeader
            id="builder-heading"
            eyebrow="Store builder"
            title="Launch your online store without building everything from scratch"
            description="Set up your brand, catalog, payments and delivery in the dashboard — no code, servers or plugins to manage."
          />
          <div className="mt-8">
            <Flow
              label="Steps to launch a store"
              steps={['Create Store', 'Customize', 'Add Products', 'Configure Payments', 'Configure Shipping', 'Start Selling']}
            />
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { title: 'Brand', items: ['Logo and favicon', 'Brand colours', 'Typography', 'Announcement bar'] },
              { title: 'Layout', items: ['Homepage hero', 'Featured products and categories', 'Navigation menu', 'Footer and social links'] },
              { title: 'Reach', items: ['SEO title and description', 'Social share image', 'Free subdomain', 'Custom domain'] },
            ].map((group) => (
              <div key={group.title} className="rounded-xl border border-[var(--color-border)] bg-white p-6">
                <h3 className="font-semibold">{group.title}</h3>
                <CheckList items={group.items} className="mt-4 text-sm" />
              </div>
            ))}
          </div>
          <p className="mt-6">
            <TextLink href="/features/store-customization">See every storefront setting →</TextLink>
          </p>
        </Container>
      </section>

      <section aria-labelledby="solutions-heading" className="border-t border-[var(--color-border)] bg-white py-20">
        <Container>
          <SectionHeader
            id="solutions-heading"
            eyebrow="Solutions"
            title="Built for how Bangladesh businesses sell"
          />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUTION_PAGES.map((page) => (
              <li key={page.slug}>
                <LinkCard href={`/solutions/${page.slug}`} title={page.name} description={page.summary} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="home-faq-heading" className="py-20">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <SectionHeader id="home-faq-heading" eyebrow="FAQ" title="Questions before you start" />
            <p className="mt-4 text-[var(--color-muted)]">
              Straight answers about what Ecomesta does today.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <TextLink href="/faq">Read all FAQs →</TextLink>
              <TextLink href="/pricing">Pricing →</TextLink>
              <TextLink href="/blog">Blog →</TextLink>
              <TextLink href="/contact">Contact →</TextLink>
            </div>
          </div>
          <FaqList faqs={homeFaqs} />
        </Container>
      </section>

      <CtaSection />
    </>
  );
}
