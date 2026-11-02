import type { MarketingLocale } from '@ecomesta/ui/marketing';
import { CtaSection, FaqList, JsonLd, PageHero } from '@/components/marketing/blocks';
import { FadeUp } from '@/components/animations/fade';
import { ButtonLink, CheckList, Container, SectionHeader } from '@/components/marketing/ui';
import { breadcrumbJsonLd, faqJsonLd, type Faq } from '@/lib/marketing/seo';
import { registerUrl } from '@/lib/marketing/site';
import { href } from '@/lib/marketing/ui-copy';

export const SHOPIFY_COMPARISON_PATH = '/shopify-alternative-bangladesh';

interface Row {
  topic: string;
  ecomesta: string;
  shopify: string;
}

interface ComparisonCopy {
  home: string;
  crumb: string;
  eyebrow: string;
  title: string;
  intro: string;
  primary: string;
  secondary: string;
  verdictTitle: string;
  verdict: string[];
  tableTitle: string;
  tableNote: string;
  columns: [string, string, string];
  rows: Row[];
  costTitle: string;
  costIntro: string;
  costRows: { label: string; value: string }[];
  costNote: string;
  chooseShopifyTitle: string;
  chooseShopify: string[];
  chooseEcomestaTitle: string;
  chooseEcomesta: string[];
  switchTitle: string;
  switchIntro: string;
  switchSteps: string[];
  faqTitle: string;
  faqs: Faq[];
  ctaTitle: string;
  ctaDescription: string;
  updated: string;
}

const COPY: Record<MarketingLocale, ComparisonCopy> = {
  en: {
    home: 'Home',
    crumb: 'Shopify alternative',
    eyebrow: 'Ecomesta vs Shopify',
    title: 'The Shopify alternative built for selling in Bangladesh',
    intro:
      'Shopify is a great global platform, but selling in Bangladesh means taka prices, Cash on Delivery, SSLCommerz online payments, local couriers and delivery charges by district. Here is an honest comparison to help you choose.',
    primary: 'Create Your Store',
    secondary: 'See prices',
    verdictTitle: 'The short version',
    verdict: [
      'Selling mainly to customers in Bangladesh? Ecomesta costs less, bills in taka and has Cash on Delivery, SSLCommerz, local couriers and Bangladesh delivery areas built in.',
      'Selling mainly abroad in dollars, or need a specific app from Shopify’s huge app store? Shopify is the stronger choice.',
      'Ecomesta does not take a cut of your sales — you only pay the plan.',
    ],
    tableTitle: 'Side-by-side comparison',
    tableNote: 'Shopify details are from Shopify’s public pricing and help pages as of October 2026; check shopify.com for the latest.',
    columns: ['', 'Ecomesta', 'Shopify'],
    rows: [
      { topic: 'Plan price', ecomesta: '৳99, ৳299 or ৳699 a month, in taka', shopify: 'From US$39 a month (US$29 a month billed yearly), in dollars' },
      { topic: 'Paying for your plan', ecomesta: 'bKash, Nagad, Rocket or Upay', shopify: 'International card in US dollars' },
      {
        topic: 'Fee on your sales',
        ecomesta: 'None — Ecomesta takes no cut of your orders',
        shopify: 'Shopify Payments is not available in Bangladesh, so a third-party gateway adds a Shopify fee (2% on Basic)',
      },
      { topic: 'Cash on Delivery', ecomesta: 'Built in, allowed or blocked per delivery method', shopify: 'Available as a manual payment method; COD rules usually need apps' },
      { topic: 'bKash, Nagad and cards', ecomesta: 'Through SSLCommerz, built in (Growth and Business)', shopify: 'Through a third-party gateway you set up yourself' },
      {
        topic: 'Courier booking',
        ecomesta: 'Steadfast, Pathao, RedX, Paperfly and eCourier, booked straight from the order',
        shopify: 'Through third-party apps',
      },
      {
        topic: 'Delivery charges by area',
        ecomesta: '8 divisions, 64 districts and 552 upazilas built in',
        shopify: 'Country and region zones; district or upazila rates need apps or workarounds',
      },
      { topic: 'Landing pages for Facebook ads', ecomesta: '10 designs with their own order form (Growth and Business)', shopify: 'Through themes or page-builder apps' },
      { topic: 'Support', ecomesta: 'Local team by phone (09697-493407) and WhatsApp', shopify: 'Global support' },
      { topic: 'Apps and international selling', ecomesta: 'Focused on Bangladesh; Stripe for international cards on Business', shopify: 'Thousands of apps, multi-currency and global selling' },
    ],
    costTitle: 'What a year costs',
    costIntro: 'For a small store paying yearly, before ads and stock:',
    costRows: [
      { label: 'Ecomesta Growth, paid yearly', value: '৳2,691' },
      { label: 'Shopify Basic, paid yearly (US$29 × 12)', value: 'US$348 — about ৳42,000 at ৳120 per dollar, plus any paid apps' },
    ],
    costNote: 'Shopify also adds its 2% third-party gateway fee on Basic for online payments in Bangladesh. Exchange rates and Shopify prices change, so treat the taka figure as an estimate.',
    chooseShopifyTitle: 'Choose Shopify if…',
    chooseShopify: [
      'Most of your customers are outside Bangladesh and pay in dollars',
      'You depend on a particular app from the Shopify App Store',
      'You have a company in a country where Shopify Payments works',
    ],
    chooseEcomestaTitle: 'Choose Ecomesta if…',
    chooseEcomesta: [
      'You sell to customers in Bangladesh and many prefer Cash on Delivery',
      'You want to pay for your plan in taka with bKash or Nagad',
      'You book Steadfast, Pathao or RedX and charge delivery by district',
      'You run Facebook ads and want landing pages with an order form',
      'You want a small, predictable monthly cost with no cut of your sales',
    ],
    switchTitle: 'Moving from Shopify to Ecomesta',
    switchIntro: 'There is no automatic import yet, so plan a short switch-over:',
    switchSteps: [
      'Create your Ecomesta store',
      'Add categories and products',
      'Set delivery zones and payments',
      'Connect your courier',
      'Point your domain to Ecomesta',
      'Place a test order',
    ],
    faqTitle: 'Questions about switching from Shopify',
    faqs: [
      {
        question: 'Is Ecomesta a good Shopify alternative in Bangladesh?',
        answer:
          'For stores selling mainly in Bangladesh, yes: prices are in taka from ৳99 a month, you pay with bKash, Nagad, Rocket or Upay, and Cash on Delivery, SSLCommerz, local courier booking and district-level delivery charges are built in.',
      },
      {
        question: 'Does Ecomesta charge a transaction fee?',
        answer: 'No. Ecomesta does not take a cut of your orders. Your payment gateway (for example SSLCommerz) charges its own fee under your agreement with it.',
      },
      {
        question: 'Can I move my Shopify store to Ecomesta?',
        answer:
          'Yes, but there is no automatic import yet. You add your categories and products in the dashboard, set up delivery and payments, then point your domain to Ecomesta on the Growth or Business plan.',
      },
      {
        question: 'Can I keep my own domain?',
        answer: 'Yes, on the Growth and Business plans you can connect a domain you own. Every store also gets a free Ecomesta web address.',
      },
      {
        question: 'Can I sell to customers abroad with Ecomesta?',
        answer: 'The Business plan includes Stripe for international card payments if you have a Stripe account that supports your business. Ecomesta is built mainly for selling in Bangladesh.',
      },
    ],
    ctaTitle: 'Try the Bangladesh-first alternative',
    ctaDescription: 'Open your store in taka, take Cash on Delivery and online payments, and book your courier from each order.',
    updated: 'Last checked: October 2026',
  },
  bn: {
    home: 'হোম',
    crumb: 'Shopify-র বিকল্প',
    eyebrow: 'Ecomesta বনাম Shopify',
    title: 'বাংলাদেশে বিক্রির জন্য বানানো Shopify-র বিকল্প',
    intro:
      'Shopify বিশ্বজুড়ে চমৎকার একটি প্ল্যাটফর্ম, কিন্তু বাংলাদেশে বিক্রি মানে টাকায় দাম, ক্যাশ অন ডেলিভারি, SSLCommerz অনলাইন পেমেন্ট, দেশের কুরিয়ার আর জেলা অনুযায়ী ডেলিভারি চার্জ। বাছাই করতে সাহায্যের জন্য এখানে একটি সৎ তুলনা দেওয়া হলো।',
    primary: 'স্টোর খুলুন',
    secondary: 'দাম দেখুন',
    verdictTitle: 'সংক্ষেপে',
    verdict: [
      'মূলত বাংলাদেশের কাস্টমারদের কাছে বিক্রি করেন? Ecomesta-য় খরচ কম, বিল টাকায়, আর ক্যাশ অন ডেলিভারি, SSLCommerz, দেশের কুরিয়ার আর বাংলাদেশের ডেলিভারি এলাকা আগে থেকেই যোগ করা।',
      'মূলত বিদেশে ডলারে বিক্রি করেন, বা Shopify-র বিশাল অ্যাপ স্টোরের নির্দিষ্ট কোনো অ্যাপ লাগে? তাহলে Shopify ভালো পছন্দ।',
      'Ecomesta আপনার বিক্রি থেকে কোনো অংশ নেয় না — শুধু প্যাকেজের টাকা দেন।',
    ],
    tableTitle: 'পাশাপাশি তুলনা',
    tableNote: 'Shopify-র তথ্য অক্টোবর ২০২৬ পর্যন্ত Shopify-র প্রকাশ্য দাম আর সাহায্য পেজ থেকে নেওয়া; সর্বশেষ তথ্যের জন্য shopify.com দেখুন।',
    columns: ['', 'Ecomesta', 'Shopify'],
    rows: [
      { topic: 'প্যাকেজের দাম', ecomesta: 'মাসে ৳৯৯, ৳২৯৯ বা ৳৬৯৯, টাকায়', shopify: 'মাসে US$39 থেকে (বছরে দিলে মাসে US$29), ডলারে' },
      { topic: 'প্যাকেজের টাকা দেওয়া', ecomesta: 'bKash, Nagad, Rocket বা Upay', shopify: 'ডলারে আন্তর্জাতিক কার্ড' },
      {
        topic: 'বিক্রির ওপর ফি',
        ecomesta: 'নেই — Ecomesta আপনার অর্ডার থেকে কোনো অংশ নেয় না',
        shopify: 'বাংলাদেশে Shopify Payments নেই, তাই অন্য গেটওয়ে ব্যবহারে Shopify-র ফি যোগ হয় (Basic-এ ২%)',
      },
      { topic: 'ক্যাশ অন ডেলিভারি', ecomesta: 'আগে থেকেই আছে, ডেলিভারি পদ্ধতি অনুযায়ী চালু বা বন্ধ', shopify: 'ম্যানুয়াল পেমেন্ট হিসেবে আছে; COD-এর নিয়মে সাধারণত অ্যাপ লাগে' },
      { topic: 'bKash, Nagad আর কার্ড', ecomesta: 'SSLCommerz দিয়ে, আগে থেকেই আছে (Growth আর Business)', shopify: 'নিজে সেট করা অন্য গেটওয়ে দিয়ে' },
      { topic: 'কুরিয়ার বুকিং', ecomesta: 'Steadfast, Pathao, RedX, Paperfly আর eCourier, সরাসরি অর্ডার থেকে বুক', shopify: 'অন্য প্রতিষ্ঠানের অ্যাপ দিয়ে' },
      {
        topic: 'এলাকা অনুযায়ী ডেলিভারি চার্জ',
        ecomesta: '৮টি বিভাগ, ৬৪টি জেলা আর ৫৫২টি উপজেলা আগে থেকেই যোগ করা',
        shopify: 'দেশ আর অঞ্চলভিত্তিক জোন; জেলা বা উপজেলার চার্জে অ্যাপ বা বিকল্প উপায় লাগে',
      },
      { topic: 'ফেসবুক বিজ্ঞাপনের ল্যান্ডিং পেজ', ecomesta: 'নিজস্ব অর্ডার ফর্মসহ ১০টি ডিজাইন (Growth আর Business)', shopify: 'থিম বা পেজ-বিল্ডার অ্যাপ দিয়ে' },
      { topic: 'সাপোর্ট', ecomesta: 'দেশি টিম, ফোনে (09697-493407) আর হোয়াটসঅ্যাপে', shopify: 'বৈশ্বিক সাপোর্ট' },
      { topic: 'অ্যাপ আর বিদেশে বিক্রি', ecomesta: 'বাংলাদেশকেন্দ্রিক; Business-এ আন্তর্জাতিক কার্ডের জন্য Stripe', shopify: 'হাজারো অ্যাপ, একাধিক মুদ্রা আর বিশ্বজুড়ে বিক্রি' },
    ],
    costTitle: 'এক বছরে কত খরচ',
    costIntro: 'বছরে একবারে টাকা দেওয়া একটি ছোট স্টোরের জন্য, বিজ্ঞাপন আর স্টক বাদে:',
    costRows: [
      { label: 'Ecomesta Growth, বছরে একবারে', value: '৳২,৬৯১' },
      { label: 'Shopify Basic, বছরে একবারে (US$29 × ১২)', value: 'US$348 — ডলারপ্রতি ৳১২০ ধরলে প্রায় ৳৪২,০০০, সাথে পেইড অ্যাপের খরচ' },
    ],
    costNote: 'বাংলাদেশে অনলাইন পেমেন্টে Shopify Basic-এ অন্য গেটওয়ের ২% ফি-ও যোগ করে। ডলারের দাম আর Shopify-র দাম বদলায়, তাই টাকার হিসাবটি আনুমানিক ধরুন।',
    chooseShopifyTitle: 'Shopify বাছুন, যদি…',
    chooseShopify: [
      'আপনার বেশিরভাগ কাস্টমার বাংলাদেশের বাইরে আর ডলারে টাকা দেন',
      'Shopify App Store-এর নির্দিষ্ট কোনো অ্যাপের ওপর নির্ভর করেন',
      'এমন দেশে আপনার কোম্পানি আছে যেখানে Shopify Payments চলে',
    ],
    chooseEcomestaTitle: 'Ecomesta বাছুন, যদি…',
    chooseEcomesta: [
      'বাংলাদেশের কাস্টমারদের কাছে বিক্রি করেন আর অনেকেই ক্যাশ অন ডেলিভারি চান',
      'bKash বা Nagad দিয়ে টাকায় প্যাকেজের টাকা দিতে চান',
      'Steadfast, Pathao বা RedX বুক করেন আর জেলা অনুযায়ী ডেলিভারি চার্জ নেন',
      'ফেসবুকে বিজ্ঞাপন চালান আর অর্ডার ফর্মসহ ল্যান্ডিং পেজ চান',
      'বিক্রি থেকে কোনো অংশ ছাড়া, ছোট আর নির্দিষ্ট মাসিক খরচ চান',
    ],
    switchTitle: 'Shopify থেকে Ecomesta-য় আসা',
    switchIntro: 'এখনো নিজে থেকে প্রোডাক্ট আনার সুবিধা নেই, তাই অল্প সময়ের একটি পরিকল্পনা করুন:',
    switchSteps: ['Ecomesta স্টোর খুলুন', 'ক্যাটাগরি আর প্রোডাক্ট যোগ করুন', 'ডেলিভারি জোন আর পেমেন্ট সেট করুন', 'কুরিয়ার যুক্ত করুন', 'ডোমেইন Ecomesta-য় আনুন', 'পরীক্ষামূলক অর্ডার দিন'],
    faqTitle: 'Shopify থেকে আসা নিয়ে প্রশ্ন',
    faqs: [
      {
        question: 'বাংলাদেশে Shopify-র ভালো বিকল্প কি Ecomesta?',
        answer:
          'যে স্টোর মূলত বাংলাদেশে বিক্রি করে, তার জন্য হ্যাঁ: দাম টাকায়, মাসে ৳৯৯ থেকে; bKash, Nagad, Rocket বা Upay দিয়ে পেমেন্ট; আর ক্যাশ অন ডেলিভারি, SSLCommerz, দেশের কুরিয়ার বুকিং আর জেলাভিত্তিক ডেলিভারি চার্জ আগে থেকেই আছে।',
      },
      {
        question: 'Ecomesta কি ট্রানজেকশন ফি নেয়?',
        answer: 'না। Ecomesta আপনার অর্ডার থেকে কোনো অংশ নেয় না। আপনার পেমেন্ট গেটওয়ে (যেমন SSLCommerz) তাদের সাথে আপনার চুক্তি অনুযায়ী নিজস্ব ফি নেয়।',
      },
      {
        question: 'আমার Shopify স্টোর কি Ecomesta-য় আনা যাবে?',
        answer: 'হ্যাঁ, তবে এখনো নিজে থেকে আনার সুবিধা নেই। ড্যাশবোর্ডে ক্যাটাগরি আর প্রোডাক্ট যোগ করুন, ডেলিভারি আর পেমেন্ট সেট করুন, তারপর Growth বা Business প্যাকেজে আপনার ডোমেইন Ecomesta-য় আনুন।',
      },
      {
        question: 'নিজের ডোমেইন কি রাখা যাবে?',
        answer: 'হ্যাঁ, Growth আর Business প্যাকেজে নিজের ডোমেইন যুক্ত করা যায়। প্রতিটি স্টোর একটি ফ্রি Ecomesta ওয়েব ঠিকানাও পায়।',
      },
      {
        question: 'Ecomesta দিয়ে কি বিদেশের কাস্টমারের কাছে বিক্রি করা যায়?',
        answer: 'Business প্যাকেজে আন্তর্জাতিক কার্ড পেমেন্টের জন্য Stripe আছে, যদি আপনার ব্যবসা সমর্থন করে এমন Stripe অ্যাকাউন্ট থাকে। Ecomesta মূলত বাংলাদেশে বিক্রির জন্য বানানো।',
      },
    ],
    ctaTitle: 'বাংলাদেশের জন্য বানানো বিকল্পটি ব্যবহার করে দেখুন',
    ctaDescription: 'টাকায় স্টোর খুলুন, ক্যাশ অন ডেলিভারি আর অনলাইন পেমেন্ট নিন, আর প্রতিটি অর্ডার থেকে কুরিয়ার বুক করুন।',
    updated: 'সর্বশেষ যাচাই: অক্টোবর ২০২৬',
  },
};

export function ShopifyComparisonView({ locale = 'en' }: { locale?: MarketingLocale }) {
  const copy = COPY[locale];
  const path = href(SHOPIFY_COMPARISON_PATH, locale);
  const crumbs = [
    { name: copy.home, path: href('/', locale) },
    { name: copy.crumb, path },
  ];

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(crumbs), faqJsonLd(copy.faqs)]} />
      <PageHero eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} crumbs={crumbs} locale={locale}>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={registerUrl()} cta="create-store-shopify-comparison">
            {copy.primary}
          </ButtonLink>
          <ButtonLink href={href('/pricing', locale)} variant="secondary">
            {copy.secondary}
          </ButtonLink>
        </div>
        <p className="mt-6 text-sm text-[var(--color-muted)]">{copy.updated}</p>
      </PageHero>

      <section aria-labelledby="verdict" className="py-14">
        <Container className="max-w-4xl">
          <FadeUp className="rounded-2xl border border-[var(--color-border)] bg-white p-6 sm:p-8">
            <h2 id="verdict" className="font-display text-2xl tracking-tight sm:text-3xl">
              {copy.verdictTitle}
            </h2>
            <CheckList items={copy.verdict} className="mt-5" />
          </FadeUp>
        </Container>
      </section>

      <section aria-labelledby="comparison" className="border-t border-[var(--color-border)] bg-white py-14">
        <Container>
          <FadeUp>
            <SectionHeader id="comparison" title={copy.tableTitle} description={copy.tableNote} />
          </FadeUp>
          <FadeUp delay={0.06} className="mt-8 overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[var(--brand-tint)] text-[var(--color-ink)]">
                <tr>
                  {copy.columns.map((column, index) => (
                    <th key={index} scope="col" className={`px-4 py-3 font-semibold ${index === 1 ? 'text-[var(--color-accent)]' : ''}`}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {copy.rows.map((row) => (
                  <tr key={row.topic}>
                    <th scope="row" className="w-1/4 px-4 py-3 align-top font-semibold">
                      {row.topic}
                    </th>
                    <td className="px-4 py-3 align-top text-[var(--color-ink)]">{row.ecomesta}</td>
                    <td className="px-4 py-3 align-top text-[var(--color-muted)]">{row.shopify}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FadeUp>
        </Container>
      </section>

      <section aria-labelledby="yearly-cost" className="py-14">
        <Container className="max-w-4xl">
          <FadeUp>
            <h2 id="yearly-cost" className="font-display text-2xl tracking-tight sm:text-3xl">
              {copy.costTitle}
            </h2>
            <p className="mt-3 text-[var(--color-muted)]">{copy.costIntro}</p>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {copy.costRows.map((row, index) => (
                <div
                  key={row.label}
                  className={`rounded-2xl border p-6 ${index === 0 ? 'border-[var(--color-accent)] bg-[var(--brand-tint)]' : 'border-[var(--color-border)] bg-white'}`}
                >
                  <dt className="text-sm text-[var(--color-muted)]">{row.label}</dt>
                  <dd className="mt-2 font-display text-2xl tracking-tight text-[var(--color-ink)]">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-[var(--color-muted)]">{copy.costNote}</p>
          </FadeUp>
        </Container>
      </section>

      <section aria-label={`${copy.chooseEcomestaTitle} / ${copy.chooseShopifyTitle}`} className="border-y border-[var(--color-border)] bg-[var(--brand-paper)] py-14">
        <Container className="grid gap-6 md:grid-cols-2">
          <FadeUp className="rounded-2xl border border-[var(--color-accent)] bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold">{copy.chooseEcomestaTitle}</h2>
            <CheckList items={copy.chooseEcomesta} className="mt-4" />
          </FadeUp>
          <FadeUp delay={0.06} className="rounded-2xl border border-[var(--color-border)] bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold">{copy.chooseShopifyTitle}</h2>
            <CheckList items={copy.chooseShopify} className="mt-4" />
          </FadeUp>
        </Container>
      </section>

      <section aria-labelledby="switching" className="py-14">
        <Container className="max-w-4xl">
          <FadeUp>
            <h2 id="switching" className="font-display text-2xl tracking-tight sm:text-3xl">
              {copy.switchTitle}
            </h2>
            <p className="mt-3 text-[var(--color-muted)]">{copy.switchIntro}</p>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {copy.switchSteps.map((step, index) => (
                <li key={step} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-white">
                    {locale === 'bn' ? (index + 1).toLocaleString('bn-BD') : index + 1}
                  </span>
                  <span className="text-sm font-medium">{step}</span>
                </li>
              ))}
            </ol>
          </FadeUp>
        </Container>
      </section>

      <section aria-labelledby="comparison-faq" className="border-t border-[var(--color-border)] bg-white/60 py-14">
        <Container className="max-w-3xl">
          <FadeUp>
            <h2 id="comparison-faq" className="font-display text-2xl tracking-tight sm:text-3xl">
              {copy.faqTitle}
            </h2>
            <div className="mt-6">
              <FaqList faqs={copy.faqs} />
            </div>
          </FadeUp>
        </Container>
      </section>

      <CtaSection
        locale={locale}
        title={copy.ctaTitle}
        description={copy.ctaDescription}
        secondary={{ href: href('/pricing', locale), label: copy.secondary }}
      />
    </>
  );
}
