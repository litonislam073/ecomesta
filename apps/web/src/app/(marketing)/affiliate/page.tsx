import { CtaSection, FaqList, JsonLd, PageHero } from '@/components/marketing/blocks';
import { FadeUp } from '@/components/animations/fade';
import { ButtonLink, Container } from '@/components/marketing/ui';
import { breadcrumbJsonLd, buildMetadata, faqJsonLd, type Faq } from '@/lib/marketing/seo';
import { merchantUrl } from '@/lib/marketing/site';

export const metadata = buildMetadata({
  path: '/affiliate',
  title: 'Ecomesta Affiliate Program — Earn 20% Referring Businesses',
  description:
    'Join the Ecomesta affiliate program. Share your link, and earn 20% of the first plan payment of every business you refer. Paid to bKash, Nagad, Rocket or Upay.',
});

const CRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Affiliate program', path: '/affiliate' },
];

const STEPS = [
  {
    title: 'Create an account and apply',
    text: 'Any Ecomesta account can apply — you do not need a store. Tell us how you will share Ecomesta.',
  },
  {
    title: 'Get approved and share your link',
    text: 'Once our team approves you, your personal link appears in your dashboard. Share it on Facebook, YouTube, groups or with clients.',
  },
  {
    title: 'Earn when they pay',
    text: 'When a business you referred pays for its first plan, you earn 20% of that payment.',
  },
  {
    title: 'Withdraw to your wallet',
    text: 'After a 7-day hold, withdraw from ৳500 to your bKash, Nagad, Rocket or Upay number.',
  },
];

const TERMS = [
  { value: '20%', label: 'of the first plan payment' },
  { value: '30 days', label: 'your link is remembered' },
  { value: '7 days', label: 'hold before you can withdraw' },
  { value: '৳500', label: 'minimum withdrawal' },
];

const FAQS: Faq[] = [
  {
    question: 'Do I need an Ecomesta store to join?',
    answer: 'No. Any Ecomesta account can apply. You only need a store if you also want to sell online yourself.',
  },
  {
    question: 'How much do I earn?',
    answer:
      'You earn 20% of the first plan payment of each business that signs up through your link. Renewals and later payments do not earn a commission.',
  },
  {
    question: 'How long does my link count?',
    answer:
      'When someone clicks your link, it is remembered in their browser for 30 days. If they create their Ecomesta account in that time, they count as your referral.',
  },
  {
    question: 'When can I withdraw?',
    answer:
      'Each commission is on hold for 7 days after the payment is confirmed. After that it is available, and you can withdraw once you have at least ৳500.',
  },
  {
    question: 'How am I paid?',
    answer:
      'Add your bKash, Nagad, Rocket or Upay number in the affiliate dashboard and request a withdrawal. The Ecomesta team sends the money and you get an email with the transaction ID.',
  },
  {
    question: 'Can I refer my own business?',
    answer: 'No. Commissions are only paid for businesses you are not part of, and refunded or fraudulent payments can be rejected during the hold.',
  },
];

export default function AffiliatePage() {
  const join = merchantUrl('/register?for=affiliate');
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(CRUMBS), faqJsonLd(FAQS)]} />
      <PageHero
        eyebrow="Affiliate program"
        title="Earn 20% for every business you bring to Ecomesta"
        intro="Know shop owners, Facebook sellers or small businesses who want an online store? Share your link — when they pay for their first plan, you get paid."
        crumbs={CRUMBS}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={join} cta="affiliate-join-hero">
            Join the affiliate program
          </ButtonLink>
          <ButtonLink href={merchantUrl('/login?next=/dashboard/affiliate')} variant="secondary">
            I already have an account
          </ButtonLink>
        </div>
      </PageHero>

      <Container className="py-14">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TERMS.map((term, index) => (
            <FadeUp
              key={term.label}
              delay={index * 0.04}
              className="rounded-2xl border border-[var(--color-border)] bg-white p-6 text-center"
            >
              <dt className="sr-only">{term.label}</dt>
              <dd className="font-display text-4xl tracking-tight text-[var(--color-accent)]">{term.value}</dd>
              <dd className="mt-2 text-sm text-[var(--color-muted)]">{term.label}</dd>
            </FadeUp>
          ))}
        </dl>
      </Container>

      <section id="how-it-works" aria-labelledby="how-heading" className="border-y border-[var(--color-border)] bg-[var(--brand-paper)] py-14">
        <Container>
          <h2 id="how-heading" className="font-display text-3xl tracking-tight sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <FadeUp as="li" key={step.title} delay={index * 0.05} className="rounded-2xl border border-[var(--color-border)] bg-white p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-tint)] font-semibold text-[var(--color-accent)]">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{step.text}</p>
              </FadeUp>
            ))}
          </ol>
        </Container>
      </section>

      <Container className="py-14">
        <h2 className="font-display text-3xl tracking-tight sm:text-4xl">Questions</h2>
        <div className="mt-6 max-w-3xl">
          <FaqList faqs={FAQS} />
        </div>
      </Container>

      <CtaSection
        title="Start earning with Ecomesta"
        description="Apply in a minute. Once approved, your link is ready to share."
        primary={{ href: join, label: 'Join the affiliate program', cta: 'affiliate-join-cta-band' }}
        secondary={{ href: merchantUrl('/login?next=/dashboard/affiliate'), label: 'I already have an account' }}
      />
    </>
  );
}
