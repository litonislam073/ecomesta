import Link from 'next/link';
import { CtaSection, FaqList, JsonLd, PageHero } from '@/components/marketing/blocks';
import { FadeUp } from '@/components/animations/fade';
import { Container } from '@/components/marketing/ui';
import { faqGroups } from '@/lib/marketing/content';
import { breadcrumbJsonLd, buildMetadata, faqJsonLd } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/bn/faq',
  locale: 'bn',
  title: 'Ecomesta সাধারণ প্রশ্ন — অনলাইন স্টোর, পেমেন্ট আর ডেলিভারি',
  description:
    'Ecomesta স্টোর খোলা, নিজের ডোমেইন, ক্যাশ অন ডেলিভারি, SSLCommerz, Stripe, স্টক, ভ্যারিয়েন্ট, কুপন, অর্ডার ট্র্যাকিং আর চেকআউট নিয়ে প্রশ্নের উত্তর।',
});

const CRUMBS = [
  { name: 'হোম', path: '/bn' },
  { name: 'সাধারণ প্রশ্ন', path: '/bn/faq' },
];

const GROUPS = faqGroups('bn');

export default function BanglaFaqPage() {
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(CRUMBS), faqJsonLd(GROUPS.flatMap((group) => group.items))]} />
      <PageHero
        locale="bn"
        eyebrow="সাধারণ প্রশ্ন"
        title="সাধারণ প্রশ্ন ও উত্তর"
        intro="Ecomesta এখন কী করে তার পরিষ্কার উত্তর — স্টোর খোলা থেকে পেমেন্ট, ডেলিভারি আর চেকআউট পর্যন্ত।"
        crumbs={CRUMBS}
      />
      <Container className="max-w-3xl space-y-12 py-14">
        {GROUPS.map((group, index) => (
          <FadeUp as="section" key={group.heading} aria-labelledby={`faq-group-${index + 1}`}>
            <h2 id={`faq-group-${index + 1}`} className="font-display text-2xl tracking-tight">
              {group.heading}
            </h2>
            <div className="mt-5">
              <FaqList faqs={group.items} />
            </div>
          </FadeUp>
        ))}
        <p className="text-[var(--color-muted)]">
          উত্তর পাননি?{' '}
          <Link href="/bn/contact" className="font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline">
            Ecomesta টিমের সাথে যোগাযোগ করুন
          </Link>{' '}
          অথবা{' '}
          <Link href="/bn/resources" className="font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline">
            স্টোর সেটআপ গাইড
          </Link>{' '}
          দেখুন।
        </p>
      </Container>
      <CtaSection locale="bn" />
    </>
  );
}
