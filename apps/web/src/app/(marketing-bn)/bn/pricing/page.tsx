import { PAYMENT_GRACE_DAYS } from '@ecomesta/utils';
import { FadeUp } from '@/components/animations/fade';
import { CtaSection, FaqList, JsonLd, PageHero } from '@/components/marketing/blocks';
import { PricingPlans } from '@/components/marketing/pricing-plans';
import { ButtonLink, Container } from '@/components/marketing/ui';
import { loadPublicPlans } from '@/lib/marketing/plans';
import { breadcrumbJsonLd, buildMetadata, faqJsonLd, softwareApplicationJsonLd, type Faq } from '@/lib/marketing/seo';
import { merchantUrl, registerUrl } from '@/lib/marketing/site';

export const metadata = buildMetadata({
  path: '/bn/pricing',
  locale: 'bn',
  title: 'Ecomesta প্যাকেজ ও দাম | বাংলাদেশে অনলাইন স্টোর',
  description:
    'আপনার অনলাইন ব্যবসার জন্য Ecomesta প্যাকেজ বেছে নিন — মাসে মাত্র ৳99 থেকে শুরু। মাসিক, ৬ মাস বা বাৎসরিক, যেভাবে সুবিধা।',
});

export const revalidate = 300;

const CRUMBS = [
  { name: 'হোম', path: '/bn' },
  { name: 'প্যাকেজ ও দাম', path: '/bn/pricing' },
];

const FAQS: Faq[] = [
  {
    question: 'কীভাবে শুরু করব?',
    answer:
      'অ্যাকাউন্ট খুলুন, স্টোরের নাম আর ওয়েব ঠিকানা দিন, একটি প্যাকেজ বেছে নিন, আর শেষ ধাপে পেমেন্ট করুন। স্টোর সাথে সাথেই তৈরি হয়ে যায়, আর আমাদের টিম পেমেন্ট নিশ্চিত করলেই কাস্টমারদের জন্য চালু হয় — সাধারণত কয়েক ঘণ্টার মধ্যে। এর মধ্যে আপনি প্রোডাক্ট যোগ করতে পারেন।',
  },
  {
    question: 'প্যাকেজের মেয়াদ শেষ হলে কী হবে?',
    answer: `মেয়াদ শেষ হওয়ার আগে Plan & billing থেকে রিনিউ করুন। পেমেন্টের জন্য ${PAYMENT_GRACE_DAYS} দিন বাড়তি সময় পাবেন, এই সময়েও স্টোর চালু থাকে। এর মধ্যে পেমেন্ট না হলে পেমেন্ট না হওয়া পর্যন্ত স্টোর বন্ধ থাকে — আপনার প্রোডাক্ট, অর্ডার আর সেটিং সব রাখা থাকে।`,
  },
  {
    question: 'পেমেন্ট কীভাবে করব?',
    answer:
      'সাইন-আপের সময় (আর পরে Plan & billing-এ) যে Ecomesta নম্বর দেখানো হয়, সেখানে bKash, Nagad, Rocket বা Upay দিয়ে প্যাকেজের টাকা পাঠান, তারপর আপনার নম্বর আর ট্রানজেকশন আইডি দিন। আমাদের টিম প্রতিটি পেমেন্ট নিশ্চিত করে, সাধারণত কয়েক ঘণ্টার মধ্যে, আর প্যাকেজ চালু হলেই ইমেইল করে জানায়।',
  },
  {
    question: '৬ মাস আর বাৎসরিক প্যাকেজ কীভাবে কাজ করে?',
    answer: 'একবারে ৬ বা ১২ মাসের টাকা দেন, আর মাসে মাসে দেওয়ার চেয়ে ১০% বা ২৫% সাশ্রয় হয়।',
  },
  {
    question: 'পরে কি প্যাকেজ বদলানো যাবে?',
    answer: 'হ্যাঁ। Plan & billing থেকে নতুন প্যাকেজ বা মেয়াদ বেছে পেমেন্ট করুন; পেমেন্ট নিশ্চিত হলেই বদল কার্যকর হয়।',
  },
  {
    question: 'পেমেন্ট গেটওয়ের চার্জ কি দামের মধ্যে ধরা?',
    answer:
      'SSLCommerz দিয়ে অনলাইন পেমেন্ট Growth প্যাকেজ থেকে, আর Stripe Business প্যাকেজে পাওয়া যায়। গেটওয়েগুলো আপনার সাথে তাদের চুক্তি অনুযায়ী নিজেদের চার্জ নেয়; সেটা Ecomesta-র দামের বাইরে।',
  },
];

export default async function BanglaPricingPage() {
  const plans = await loadPublicPlans();

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(CRUMBS), softwareApplicationJsonLd(plans), faqJsonLd(FAQS)]} />
      <PageHero
        eyebrow="প্যাকেজ ও দাম"
        title="বাড়তে থাকা ব্যবসার জন্য সহজ দাম"
        intro="আপনার ব্যবসার সাথে মানানসই প্যাকেজ বেছে নিন। bKash, Nagad, Rocket বা Upay দিয়ে পেমেন্ট করে বিক্রি শুরু করুন।"
        crumbs={CRUMBS}
      />
      <section aria-labelledby="plans-heading" className="py-14 sm:py-16">
        <Container>
          <h2 id="plans-heading" className="sr-only">
            প্যাকেজ আর দাম
          </h2>
          {plans ? (
            <>
              <PricingPlans plans={plans} merchantOrigin={merchantUrl()} locale="bn" />
              <p className="mt-8 text-center text-sm text-[var(--color-muted)]">
                সব দাম বাংলাদেশি টাকায় (BDT)। স্টোর খোলার সময় প্যাকেজের টাকা দিতে হয়।
              </p>
            </>
          ) : (
            <div className="mx-auto max-w-xl rounded-2xl border border-[var(--color-border)] bg-white p-8 text-center">
              <p className="font-semibold text-[var(--color-ink)]">এই মুহূর্তে দাম দেখানো যাচ্ছে না।</p>
              <p className="mt-2 text-[var(--color-muted)]">
                তবুও স্টোর খুলতে পারেন; সাইন-আপের সময় বর্তমান দাম দেখানো হয়। দাম দেখতে পেজটি আবার লোড করুন।
              </p>
              <ButtonLink href={registerUrl()} cta="pricing-start-fallback" className="mt-6">
                স্টোর খুলুন
              </ButtonLink>
            </div>
          )}
        </Container>
      </section>
      <section aria-labelledby="pricing-faq" className="border-t border-[var(--color-border)] bg-white/60 py-14">
        <Container className="max-w-3xl">
          <FadeUp>
            <h2 id="pricing-faq" className="font-display text-2xl tracking-tight sm:text-3xl">
              দাম নিয়ে প্রশ্ন
            </h2>
            <div className="mt-6">
              <FaqList faqs={FAQS} />
            </div>
          </FadeUp>
        </Container>
      </section>
      <CtaSection
        title="আজই অনলাইন স্টোর খুলতে চান?"
        description="স্টোর খুলুন, প্রোডাক্ট যোগ করুন, আর ক্যাশ অন ডেলিভারি বা অনলাইন পেমেন্টে অর্ডার নেওয়া শুরু করুন।"
        primary={{ href: registerUrl(), label: 'স্টোর খুলুন', cta: 'create-store-cta-band' }}
        secondary={{ href: '/bn', label: 'হোমপেজে ফিরে যান' }}
      />
    </>
  );
}
