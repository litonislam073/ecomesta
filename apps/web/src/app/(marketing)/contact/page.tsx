import { CtaSection, JsonLd, LinkCard, PageHero } from '@/components/marketing/blocks';
import { ButtonLink, Container } from '@/components/marketing/ui';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/marketing/seo';
import { contactEmail, loginUrl, registerUrl } from '@/lib/marketing/site';

export const metadata = buildMetadata({
  path: '/contact',
  title: 'Contact Ecomesta',
  description:
    'Get in touch with Ecomesta about plans, onboarding or your online store, or find answers in our FAQ and setup guides.',
});

const CRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Contact', path: '/contact' },
];

export default function ContactPage() {
  const email = contactEmail();

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(CRUMBS)} />
      <PageHero
        eyebrow="Contact"
        title="Talk to us"
        intro="Questions about plans, getting started or how Ecomesta fits your business? We are happy to help."
        crumbs={CRUMBS}
      />
      <Container className="grid gap-8 py-14 lg:grid-cols-2">
        <section aria-labelledby="reach-us" className="rounded-2xl border border-[var(--color-border)] bg-white p-8">
          <h2 id="reach-us" className="font-display text-2xl tracking-tight">
            Reach the Ecomesta team
          </h2>
          {email ? (
            <>
              <p className="mt-4 text-[var(--color-muted)]">
                Email us and include your store name if you already have one.
              </p>
              <p className="mt-6">
                <a
                  href={`mailto:${email}`}
                  className="text-lg font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline"
                >
                  {email}
                </a>
              </p>
            </>
          ) : (
            <p className="mt-4 text-[var(--color-muted)]">
              Our public contact channel is being set up. In the meantime, you can create your store
              and explore the dashboard, or find answers in the FAQ and setup guides.
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={registerUrl()} cta="create-store-contact">
              Create Your Store
            </ButtonLink>
            <ButtonLink href={loginUrl()} variant="secondary">
              Merchant login
            </ButtonLink>
          </div>
        </section>
        <section aria-labelledby="self-serve" className="space-y-4">
          <h2 id="self-serve" className="font-display text-2xl tracking-tight">
            Find answers now
          </h2>
          <LinkCard href="/faq" title="FAQ" description="Stores, payments, delivery, checkout and more." />
          <LinkCard href="/resources" title="Resources" description="Setup guides for every part of the platform." />
          <LinkCard href="/pricing" title="Pricing" description="Plans in BDT and the 2-month free trial." />
        </section>
      </Container>
      <CtaSection />
    </>
  );
}
