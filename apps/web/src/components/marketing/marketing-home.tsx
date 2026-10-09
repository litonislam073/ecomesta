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
import { AnimatedNumber } from '../animations/animated-number';
import { FadeLeft, FadeUp, ScaleIn } from '../animations/fade';
import { StaggerContainer } from '../animations/stagger';
import { StaggerItem } from '../animations/stagger-item';
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
  { icon: 'tag', label: 'Coupons', href: '/features/coupons' },
  { icon: 'chart', label: 'Tracking', href: '/features/marketing-tracking' },
  { icon: 'palette', label: 'Themes', href: '/features/store-customization' },
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
    points: ['Variants with their own price and stock', 'Product and category images'],
    href: '/features/product-management',
    linkLabel: 'Explore product management',
  },
  {
    icon: 'receipt',
    title: 'Order Management',
    body: 'Track orders from pending through fulfillment.',
    points: ['Order, payment and fulfillment status', 'Book courier parcels from the order'],
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
    body: 'Cash on Delivery, bank transfer, SSLCommerz and Stripe.',
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
    icon: 'route',
    title: 'Courier Booking',
    body: 'Connect Steadfast, Pathao, RedX, Paperfly or eCourier and book parcels without leaving Ecomesta.',
    points: ['Address, phone and COD amount sent for you', 'Delivery status refreshed from the order'],
    href: '/shipping/bangladesh',
    linkLabel: 'How courier booking works',
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
    icon: 'chart',
    title: 'Marketing & Tracking',
    body: 'Facebook Pixel, Google Tag Manager, Google Analytics 4 and Search Console.',
    points: ['Paste an ID — no code', 'Add to cart and purchase events sent for you'],
    href: '/features/marketing-tracking',
    linkLabel: 'Measure your ads',
  },
  {
    icon: 'palette',
    title: 'Themes & Live Editor',
    body: 'Default, Minimal and the premium ShopEase theme, customized in a live editor.',
    points: ['Add, hide and reorder homepage sections', 'Desktop, tablet and mobile preview'],
    href: '/features/store-customization',
    linkLabel: 'Customize your storefront',
  },
  {
    icon: 'image',
    title: 'Image Gallery',
    body: 'Upload photos once and reuse them for products, categories, banners and your logo.',
    points: ['JPEG, PNG or WebP uploads', '1–5 GB storage by plan'],
    href: '/features/product-management',
    linkLabel: 'Manage your catalog',
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
    icon: 'bank',
    title: 'Bank transfer',
    body: 'Offer bank transfer or another offline option with your own instructions, and mark the payment once you receive it.',
    href: '/payments/cash-on-delivery',
  },
];

const HOME_FAQ_QUESTIONS = [
  'What is Ecomesta?',
  'Does Ecomesta support Cash on Delivery?',
  'Can I use my own domain?',
  'Can I book Steadfast courier from Ecomesta?',
  'Can I add Facebook Pixel or Google Analytics?',
  'Do customers need an account?',
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
          className="em-drift pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 10% 0%, rgba(1,135,240,0.14), transparent 70%), radial-gradient(ellipse 45% 40% at 100% 100%, rgba(3,165,129,0.14), transparent 70%)',
          }}
        />
        <Container className="relative grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <FadeUp
              on="load"
              as="p"
              distance={12}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-sm font-medium text-[var(--color-accent)]"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              Ecommerce platform for Bangladesh
            </FadeUp>
            <FadeUp
              on="load"
              as="h1"
              delay={0.04}
              id="hero-heading"
              className="mt-6 font-display text-4xl leading-[1.08] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-[3.4rem]"
            >
              Build Your Online Store. Sell More. Manage Everything in One Place.
            </FadeUp>
            <FadeUp on="load" as="p" delay={0.12} className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
              Ecomesta helps Bangladesh businesses create and manage online stores — products, orders,
              payments, courier booking, themes and marketing tracking — from one platform.
            </FadeUp>
            <div className="mt-8 flex flex-wrap gap-3">
              <FadeUp on="load" as="span" delay={0.18} className="inline-flex">
                <ButtonLink href={register} cta="create-store-hero">
                  Create Your Store
                </ButtonLink>
              </FadeUp>
              <FadeUp on="load" as="span" delay={0.24} className="inline-flex">
                <ButtonLink href="/features" variant="secondary">
                  Explore Features
                </ButtonLink>
              </FadeUp>
            </div>
            <FadeUp on="load" as="ul" delay={0.3} distance={12} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-muted)]">
              {['Cash on Delivery', 'SSLCommerz payments', 'Steadfast, Pathao & RedX booking', 'Live theme editor'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 text-[var(--brand-green)]" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </FadeUp>
          </div>
          <ScaleIn on="load" delay={0.15} className="lg:pl-4">
            <DashboardPreview />
          </ScaleIn>
        </Container>
      </section>

      <section aria-labelledby="manage-heading" className="py-16">
        <Container>
          <FadeUp as="h2" distance={12} id="manage-heading" className="text-center text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
            Manage your whole store from one platform
          </FadeUp>
          <StaggerContainer as="ul" step={0.05} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {MANAGE.map((item) => (
              <StaggerItem as="li" key={item.label}>
                <Link
                  href={item.href}
                  className="em-hover-lift flex h-full flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-2 py-4 text-center text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Icon name={item.icon} className="em-hover-icon h-6 w-6 text-[var(--color-accent)]" />
                  {item.label}
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      <section aria-labelledby="features-heading" className="border-y border-[var(--color-border)] bg-white py-20">
        <Container>
          <FadeUp>
            <SectionHeader
              id="features-heading"
              eyebrow="Features"
              title="Everything you need to sell online"
              description="The tools a Bangladesh online store uses every day — connected, so stock, payments and delivery charges stay consistent."
            />
          </FadeUp>
          <StaggerContainer as="ul" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <StaggerItem as="li" key={feature.title} className="em-hover-lift flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--brand-paper)] p-6">
                <IconBadge name={feature.icon} />
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-[var(--color-muted)]">{feature.body}</p>
                <CheckList items={feature.points} className="mt-4 text-sm" />
                <TextLink href={feature.href} className="mt-auto pt-5 text-sm">
                  {feature.linkLabel} →
                </TextLink>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      <section aria-labelledby="payments-heading" className="py-20">
        <Container>
          <FadeUp>
            <SectionHeader
              id="payments-heading"
              eyebrow="Payments"
              title="Accept Payments Your Customers Prefer"
              description="Offer Cash on Delivery and online payments side by side. Each store connects the providers it wants with its own merchant accounts."
            />
          </FadeUp>
          <StaggerContainer as="ul" className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PAYMENTS.map((payment) => (
              <StaggerItem as="li" key={payment.title}>
                <Link
                  href={payment.href}
                  className="em-hover-lift group flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-white p-6 hover:border-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <IconBadge name={payment.icon} />
                  <h3 className="mt-4 text-lg font-semibold group-hover:text-[var(--color-accent)]">{payment.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{payment.body}</p>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
          <p className="mt-6 max-w-3xl text-sm text-[var(--color-muted)]">
            Totals are always calculated by Ecomesta, and an online payment only counts once the
            provider confirms it. bKash and Nagad are not integrated directly; customers can pay with
            the methods enabled on your SSLCommerz account.
          </p>
        </Container>
      </section>

      <section aria-labelledby="shipping-heading" className="border-y border-[var(--color-border)] bg-[var(--brand-tint)] py-20">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <FadeLeft>
            <SectionHeader
              id="shipping-heading"
              eyebrow="Bangladesh shipping"
              title="Delivery charges that follow real delivery areas"
              description={
                <>
                  All <AnimatedNumber value={8} duration={0.8} /> divisions, <AnimatedNumber value={64} />{' '}
                  districts and <AnimatedNumber value={552} /> upazilas are built in. Group them into zones, add
                  delivery methods and let checkout calculate the right charge.
                </>
              }
            />
            <CheckList
              className="mt-6"
              items={[
                'Zone-based flat or free delivery',
                'Free-shipping thresholds per method',
                'Cash on Delivery allowed or blocked per method',
                'Shipping details saved on every order',
                'Courier parcels booked straight from the order',
              ]}
            />
            <div className="mt-8 flex flex-wrap gap-4">
              <TextLink href="/shipping/bangladesh">Bangladesh delivery setup →</TextLink>
              <TextLink href="/shipping/zones">Zones and rates →</TextLink>
            </div>
          </FadeLeft>
          <ScaleIn scale={0.98} duration={0.7} delay={0.08} className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-[var(--color-muted)]">How a delivery charge is chosen</p>
            <ol className="mt-4 space-y-2">
              {['Division', 'District', 'Upazila', 'Shipping zone', 'Shipping method', 'Shipping rate'].map((step, index, all) => (
                <li key={step}>
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--brand-paper)] px-4 py-2.5">
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
          </ScaleIn>
        </Container>
      </section>

      <section aria-labelledby="builder-heading" className="py-20">
        <Container>
          <FadeUp>
            <SectionHeader
              id="builder-heading"
              eyebrow="Store builder"
              title="Launch your online store without building everything from scratch"
              description="Set up your brand, catalog, payments and delivery in the dashboard — no code, servers or plugins to manage."
            />
          </FadeUp>
          <FadeUp delay={0.08} className="mt-8">
            <Flow
              label="Steps to launch a store"
              steps={['Create Store', 'Customize', 'Add Products', 'Configure Payments', 'Configure Shipping', 'Start Selling']}
            />
          </FadeUp>
          <StaggerContainer className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { title: 'Brand', items: ['Logo and favicon uploads', 'Brand colours', 'Typography', 'Announcement bar'] },
              { title: 'Layout', items: ['Hero, categories with images and featured products', 'Deal of the day, rich text and image banners', 'Show, hide and reorder sections', 'Footer and social links'] },
              { title: 'Reach', items: ['SEO title and description', 'Facebook Pixel and Google Analytics', 'Free subdomain', 'Custom domain'] },
            ].map((group) => (
              <StaggerItem key={group.title} className="em-hover-lift rounded-xl border border-[var(--color-border)] bg-white p-6">
                <h3 className="font-semibold">{group.title}</h3>
                <CheckList items={group.items} className="mt-4 text-sm" />
              </StaggerItem>
            ))}
          </StaggerContainer>
          <p className="mt-6">
            <TextLink href="/features/store-customization">See every storefront setting →</TextLink>
          </p>
        </Container>
      </section>

      <section aria-labelledby="solutions-heading" className="border-t border-[var(--color-border)] bg-white py-20">
        <Container>
          <FadeUp>
            <SectionHeader
              id="solutions-heading"
              eyebrow="Solutions"
              title="Built for how Bangladesh businesses sell"
            />
          </FadeUp>
          <StaggerContainer as="ul" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUTION_PAGES.map((page) => (
              <StaggerItem as="li" key={page.slug}>
                <LinkCard href={`/solutions/${page.slug}`} title={page.name} description={page.summary} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      <section aria-labelledby="home-faq-heading" className="py-20">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <FadeUp>
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
          </FadeUp>
          <FadeUp delay={0.08}>
            <FaqList faqs={homeFaqs} />
          </FadeUp>
        </Container>
      </section>

      <CtaSection />
    </>
  );
}
