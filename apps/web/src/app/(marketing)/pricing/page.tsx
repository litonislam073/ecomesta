import type { PublicPlan } from '@ecomesta/types';
import { PAYMENT_GRACE_DAYS } from '@ecomesta/utils';
import { FadeUp } from '@/components/animations/fade';
import { CtaSection, FaqList, JsonLd, PageHero } from '@/components/marketing/blocks';
import { PricingPlans } from '@/components/marketing/pricing-plans';
import { ButtonLink, Container } from '@/components/marketing/ui';
import { breadcrumbJsonLd, buildMetadata, faqJsonLd, type Faq } from '@/lib/marketing/seo';
import { merchantUrl, registerUrl } from '@/lib/marketing/site';
import { publicGet } from '@/lib/public-api';

export const metadata = buildMetadata({
  path: '/pricing',
  title: 'Ecomesta Pricing | Online Store Plans in Bangladesh',
  description:
    'Choose an Ecomesta plan for your online business. Start free for 2 months with flexible monthly, 6-month and yearly options.',
});

export const revalidate = 300;

const CRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Pricing', path: '/pricing' },
];

const FAQS: Faq[] = [
  {
    question: 'Do I need to pay to start?',
    answer:
      'No. Every plan starts with 2 months free and no payment details are needed to create your store.',
  },
  {
    question: 'What happens when the free trial ends?',
    answer: `Your plan price applies from the end of the trial. You get a ${PAYMENT_GRACE_DAYS}-day grace period to pay, and your store keeps working during that time. If payment is not made by the end of the grace period, the store is paused until the payment is completed — your products, orders and settings are kept.`,
  },
  {
    question: 'How do I pay?',
    answer:
      'From Plan & billing in your dashboard: send the plan price with bKash, Nagad, Rocket or Upay to the Ecomesta number shown there, then enter your number and the transaction ID. Our team confirms each payment, usually within a few hours, and emails you as soon as your plan is active.',
  },
  {
    question: 'How do the 6-month and yearly options work?',
    answer:
      'You pay for 6 or 12 months at once after the trial and save 10% or 25% compared with paying monthly.',
  },
  {
    question: 'Can I change my plan later?',
    answer:
      'Yes. During the free trial you can switch to a cheaper plan or another billing period at any time. Upgrading, and any change after the trial, takes effect as soon as the payment for the new plan is confirmed.',
  },
  {
    question: 'Are payment gateway fees included?',
    answer:
      'Online payments with SSLCommerz are included from the Growth plan, and Stripe on the Business plan. The gateways charge their own fees under your agreement with them; those fees are separate from Ecomesta.',
  },
];

async function loadPlans(): Promise<PublicPlan[] | null> {
  try {
    const result = await publicGet<{ success: true; data: PublicPlan[] }>('/public/plans');
    return result.data.length > 0 ? result.data : null;
  } catch {
    return null;
  }
}

export default async function PricingPage() {
  const plans = await loadPlans();

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(CRUMBS), faqJsonLd(FAQS)]} />
      <PageHero
        eyebrow="Pricing"
        title="Simple pricing for your growing business"
        intro="Start your online store free for 2 months. Choose the plan that fits your business."
        crumbs={CRUMBS}
      />
      <section aria-labelledby="plans-heading" className="py-14 sm:py-16">
        <Container>
          <h2 id="plans-heading" className="sr-only">
            Plans and prices
          </h2>
          {plans ? (
            <>
              <PricingPlans plans={plans} merchantOrigin={merchantUrl()} />
              <p className="mt-8 text-center text-sm text-[var(--color-muted)]">
                All prices are in Bangladeshi Taka (BDT). Nothing is charged during the free trial.
              </p>
            </>
          ) : (
            <div className="mx-auto max-w-xl rounded-2xl border border-[var(--color-border)] bg-white p-8 text-center">
              <p className="font-semibold text-[var(--color-ink)]">Plan prices could not be loaded right now.</p>
              <p className="mt-2 text-[var(--color-muted)]">
                You can still create your store and start the 2-month free trial. Please refresh this page to see
                current prices.
              </p>
              <ButtonLink href={registerUrl()} cta="pricing-start-fallback" className="mt-6">
                Start 2 Months Free
              </ButtonLink>
            </div>
          )}
        </Container>
      </section>
      <section aria-labelledby="pricing-faq" className="border-t border-[var(--color-border)] bg-white/60 py-14">
        <Container className="max-w-3xl">
          <FadeUp>
            <h2 id="pricing-faq" className="font-display text-2xl tracking-tight sm:text-3xl">
              Pricing questions
            </h2>
            <div className="mt-6">
              <FaqList faqs={FAQS} />
            </div>
          </FadeUp>
        </Container>
      </section>
      <CtaSection />
    </>
  );
}
