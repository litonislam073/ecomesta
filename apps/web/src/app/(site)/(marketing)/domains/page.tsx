import { CtaSection, JsonLd, PageHero } from '@/components/marketing/blocks';
import { DomainSearch } from '@/components/marketing/domain-search';
import { FadeUp } from '@/components/animations/fade';
import { Container } from '@/components/marketing/ui';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/domains',
  title: 'Buy a Domain in Bangladesh with bKash or Nagad | Ecomesta',
  description:
    'Search and buy .com, .net, .shop and more for your online store. Pay with bKash, Nagad, Rocket or Upay; we connect the domain to your Ecomesta store for you.',
});

const CRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Domains', path: '/domains' },
];

const STEPS = [
  { title: 'Search a name', text: 'Type the name you want. We check .com, .net, .shop and more with prices in taka.' },
  { title: 'Pay by mobile wallet', text: 'Pay with bKash, Nagad, Rocket or Upay from your Ecomesta dashboard.' },
  { title: 'We set it up', text: 'Once our team confirms the payment, the domain is registered in your name and connected to your store.' },
];

export default function DomainsPage() {
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(CRUMBS)]} />
      <PageHero
        eyebrow="Domains"
        title="Get your own domain for your store"
        intro="Search, pay with bKash or Nagad, and we connect it to your Ecomesta store — no DNS setup needed. Renew from your dashboard every year."
        crumbs={CRUMBS}
      />
      <Container className="py-12">
        <FadeUp className="mx-auto max-w-3xl">
          <DomainSearch />
          <p className="mt-4 text-sm text-[var(--color-muted)]">
            Prices are per year. Buying needs an Ecomesta account — you can sign in or create one after you click Buy.
          </p>
        </FadeUp>
        <ol className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-[var(--color-border)] bg-white p-6">
              <p className="text-sm font-semibold text-[var(--color-accent)]">Step {i + 1}</p>
              <h2 className="mt-2 font-display text-xl tracking-tight">{step.title}</h2>
              <p className="mt-2 text-[var(--color-muted)]">{step.text}</p>
            </li>
          ))}
        </ol>
      </Container>
      <CtaSection />
    </>
  );
}
