import { CtaSection, JsonLd, PageHero } from '@/components/marketing/blocks';
import { DomainSearch } from '@/components/marketing/domain-search';
import { FadeUp } from '@/components/animations/fade';
import { Container } from '@/components/marketing/ui';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/bn/domains',
  locale: 'bn',
  title: 'বিকাশ বা নগদে ডোমেইন কিনুন | Ecomesta',
  description:
    'আপনার অনলাইন স্টোরের জন্য .com, .net, .shop সহ ডোমেইন খুঁজুন আর কিনুন। বিকাশ, নগদ, রকেট বা উপায়ে পেমেন্ট করুন; আমরা ডোমেইনটা আপনার Ecomesta স্টোরে যুক্ত করে দিই।',
});

const CRUMBS = [
  { name: 'হোম', path: '/bn' },
  { name: 'ডোমেইন', path: '/bn/domains' },
];

const STEPS = [
  { title: 'নাম খুঁজুন', text: 'যে নাম চান লিখুন। .com, .net, .shop সহ আরও অনেক এক্সটেনশন টাকায় দাম সহ দেখাবে।' },
  { title: 'মোবাইল ওয়ালেটে পেমেন্ট', text: 'Ecomesta ড্যাশবোর্ড থেকে বিকাশ, নগদ, রকেট বা উপায়ে পেমেন্ট করুন।' },
  { title: 'বাকিটা আমাদের', text: 'পেমেন্ট নিশ্চিত হলে ডোমেইন আপনার নামে রেজিস্টার হয়ে আপনার স্টোরে যুক্ত হয়ে যায়।' },
];

export default function BanglaDomainsPage() {
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(CRUMBS)]} />
      <PageHero
        locale="bn"
        eyebrow="ডোমেইন"
        title="আপনার স্টোরের জন্য নিজের ডোমেইন নিন"
        intro="নাম খুঁজুন, বিকাশ বা নগদে পেমেন্ট করুন — আমরা ডোমেইনটা আপনার Ecomesta স্টোরে যুক্ত করে দিই, DNS সেটআপ লাগবে না। প্রতি বছর ড্যাশবোর্ড থেকেই রিনিউ করুন।"
        crumbs={CRUMBS}
      />
      <Container className="py-12">
        <FadeUp className="mx-auto max-w-3xl">
          <DomainSearch locale="bn" />
          <p className="mt-4 text-sm text-[var(--color-muted)]">
            দাম প্রতি বছরের। কিনতে Ecomesta অ্যাকাউন্ট লাগবে — কিনুন চাপার পর লগইন বা নতুন অ্যাকাউন্ট খুলতে পারবেন।
          </p>
        </FadeUp>
        <ol className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-[var(--color-border)] bg-white p-6">
              <p className="text-sm font-semibold text-[var(--color-accent)]">ধাপ {i + 1}</p>
              <h2 className="mt-2 font-display text-xl tracking-tight">{step.title}</h2>
              <p className="mt-2 text-[var(--color-muted)]">{step.text}</p>
            </li>
          ))}
        </ol>
      </Container>
      <CtaSection locale="bn" />
    </>
  );
}
