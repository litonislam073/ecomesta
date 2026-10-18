import { CtaSection, FaqList, JsonLd, PageHero } from '@/components/marketing/blocks';
import { FadeUp } from '@/components/animations/fade';
import { ButtonLink, Container } from '@/components/marketing/ui';
import { breadcrumbJsonLd, buildMetadata, faqJsonLd, type Faq } from '@/lib/marketing/seo';
import { merchantUrl } from '@/lib/marketing/site';

export const metadata = buildMetadata({
  path: '/bn/affiliate',
  locale: 'bn',
  title: 'Ecomesta অ্যাফিলিয়েট প্রোগ্রাম — ব্যবসা রেফার করে ২০% আয় করুন',
  description:
    'Ecomesta অ্যাফিলিয়েট প্রোগ্রামে যোগ দিন। আপনার লিংক শেয়ার করুন, আর রেফার করা প্রতিটি ব্যবসার প্রথম প্যাকেজ পেমেন্টের ২০% পান। টাকা যায় bKash, Nagad, Rocket বা Upay-তে।',
});

const CRUMBS = [
  { name: 'হোম', path: '/bn' },
  { name: 'অ্যাফিলিয়েট প্রোগ্রাম', path: '/bn/affiliate' },
];

const STEPS = [
  { title: 'অ্যাকাউন্ট খুলে আবেদন করুন', text: 'যেকোনো Ecomesta অ্যাকাউন্ট দিয়ে আবেদন করা যায় — স্টোর লাগে না। আপনি কীভাবে Ecomesta শেয়ার করবেন, জানান।' },
  { title: 'অনুমোদন পেয়ে লিংক শেয়ার করুন', text: 'আমাদের টিম অনুমোদন দিলে ড্যাশবোর্ডে আপনার নিজস্ব লিংক দেখাবে। ফেসবুক, ইউটিউব, গ্রুপ বা ক্লায়েন্টদের সাথে শেয়ার করুন।' },
  { title: 'তারা পেমেন্ট করলে আয়', text: 'আপনার রেফার করা ব্যবসা প্রথম প্যাকেজের টাকা দিলে সেই পেমেন্টের ২০% আপনি পান।' },
  { title: 'ওয়ালেটে তুলুন', text: '৭ দিন অপেক্ষার পর ৳৫০০ থেকে আপনার bKash, Nagad, Rocket বা Upay নম্বরে তুলুন।' },
];

const TERMS = [
  { value: '২০%', label: 'প্রথম প্যাকেজ পেমেন্টের' },
  { value: '৩০ দিন', label: 'আপনার লিংক মনে রাখা হয়' },
  { value: '৭ দিন', label: 'তোলার আগে অপেক্ষা' },
  { value: '৳৫০০', label: 'সর্বনিম্ন তোলা' },
];

const FAQS: Faq[] = [
  { question: 'যোগ দিতে কি Ecomesta স্টোর লাগবে?', answer: 'না। যেকোনো Ecomesta অ্যাকাউন্ট দিয়ে আবেদন করা যায়। নিজেও অনলাইনে বিক্রি করতে চাইলে তবেই স্টোর লাগবে।' },
  {
    question: 'কত আয় করব?',
    answer: 'আপনার লিংক দিয়ে সাইন-আপ করা প্রতিটি ব্যবসার প্রথম প্যাকেজ পেমেন্টের ২০% পান। রিনিউ বা পরের পেমেন্টে কমিশন হয় না।',
  },
  {
    question: 'আমার লিংক কতদিন গণ্য হয়?',
    answer: 'কেউ আপনার লিংকে ক্লিক করলে তাঁর ব্রাউজারে ৩০ দিন মনে রাখা হয়। এর মধ্যে তিনি Ecomesta অ্যাকাউন্ট খুললে আপনার রেফারেল হিসেবে গণ্য হন।',
  },
  {
    question: 'কখন টাকা তুলতে পারব?',
    answer: 'পেমেন্ট নিশ্চিত হওয়ার পর প্রতিটি কমিশন ৭ দিন অপেক্ষায় থাকে। এরপর তোলার জন্য পাওয়া যায়, আর অন্তত ৳৫০০ হলে তুলতে পারেন।',
  },
  {
    question: 'কীভাবে টাকা পাব?',
    answer: 'অ্যাফিলিয়েট ড্যাশবোর্ডে আপনার bKash, Nagad, Rocket বা Upay নম্বর দিয়ে তোলার অনুরোধ করুন। Ecomesta টিম টাকা পাঠায়, আর ট্রানজেকশন আইডিসহ আপনি একটি ইমেইল পান।',
  },
  {
    question: 'নিজের ব্যবসা কি রেফার করা যায়?',
    answer: 'না। শুধু যে ব্যবসার অংশ আপনি নন তার জন্য কমিশন দেওয়া হয়, আর অপেক্ষার সময়ে রিফান্ড বা প্রতারণার পেমেন্ট বাতিল হতে পারে।',
  },
];

export default function BanglaAffiliatePage() {
  const join = merchantUrl('/register?for=affiliate');
  const login = merchantUrl('/login?next=/dashboard/affiliate');
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(CRUMBS), faqJsonLd(FAQS)]} />
      <PageHero
        locale="bn"
        eyebrow="অ্যাফিলিয়েট প্রোগ্রাম"
        title="Ecomesta-তে আনা প্রতিটি ব্যবসার জন্য ২০% আয় করুন"
        intro="অনলাইন স্টোর চান এমন দোকানদার, ফেসবুক সেলার বা ছোট ব্যবসাকে চেনেন? আপনার লিংক শেয়ার করুন — তাঁরা প্রথম প্যাকেজের টাকা দিলে আপনি টাকা পাবেন।"
        crumbs={CRUMBS}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={join} cta="affiliate-join-hero">
            অ্যাফিলিয়েট প্রোগ্রামে যোগ দিন
          </ButtonLink>
          <ButtonLink href={login} variant="secondary">
            আমার অ্যাকাউন্ট আছে
          </ButtonLink>
        </div>
      </PageHero>

      <Container className="py-14">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TERMS.map((term, index) => (
            <FadeUp key={term.label} delay={index * 0.04} className="rounded-2xl border border-[var(--color-border)] bg-white p-6 text-center">
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
            যেভাবে কাজ করে
          </h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <FadeUp as="li" key={step.title} delay={index * 0.05} className="rounded-2xl border border-[var(--color-border)] bg-white p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-tint)] font-semibold text-[var(--color-accent)]">
                  {(index + 1).toLocaleString('bn-BD')}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{step.text}</p>
              </FadeUp>
            ))}
          </ol>
        </Container>
      </section>

      <Container className="py-14">
        <h2 className="font-display text-3xl tracking-tight sm:text-4xl">প্রশ্ন</h2>
        <div className="mt-6 max-w-3xl">
          <FaqList faqs={FAQS} />
        </div>
      </Container>

      <CtaSection
        locale="bn"
        title="Ecomesta-র সাথে আয় শুরু করুন"
        description="এক মিনিটে আবেদন করুন। অনুমোদন পেলেই আপনার লিংক শেয়ারের জন্য তৈরি।"
        primary={{ href: join, label: 'অ্যাফিলিয়েট প্রোগ্রামে যোগ দিন', cta: 'affiliate-join-cta-band' }}
        secondary={{ href: login, label: 'আমার অ্যাকাউন্ট আছে' }}
      />
    </>
  );
}
