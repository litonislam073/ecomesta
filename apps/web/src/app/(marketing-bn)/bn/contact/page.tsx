import { CONTACT_ICON_PATHS, SOCIAL_LINKS, SUPPORT_PHONE, SUPPORT_WHATSAPP } from '@ecomesta/ui/marketing';
import { CtaSection, JsonLd, LinkCard, PageHero } from '@/components/marketing/blocks';
import { ContactForm } from '@/components/marketing/contact-form';
import { FadeUp } from '@/components/animations/fade';
import { ButtonLink, Container } from '@/components/marketing/ui';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/marketing/seo';
import { SITE_NAME, absoluteUrl, contactEmail, loginUrl, merchantUrl, registerUrl } from '@/lib/marketing/site';

export const metadata = buildMetadata({
  path: '/bn/contact',
  locale: 'bn',
  title: 'Ecomesta-র সাথে যোগাযোগ — বাংলাদেশে ই-কমার্স সাপোর্ট',
  description:
    '09697-493407 নম্বরে কল করুন, হোয়াটসঅ্যাপে মেসেজ দিন বা প্যাকেজ, শুরু করা, পেমেন্ট বা আপনার অনলাইন স্টোর নিয়ে Ecomesta টিমকে মেসেজ পাঠান।',
});

const CRUMBS = [
  { name: 'হোম', path: '/bn' },
  { name: 'যোগাযোগ', path: '/bn/contact' },
];

const NEXT_STEPS = [
  { title: 'আপনি মেসেজ পাঠান', text: 'আপনি কে আর কী দরকার জানান — কয়েক লাইনই যথেষ্ট।' },
  { title: 'আমাদের টিম পড়ে', text: 'প্রতিটি মেসেজ Ecomesta টিমের একজন মানুষ দেখেন, কোনো বট নয়।' },
  { title: 'আমরা যোগাযোগ করি', text: 'আপনার দেওয়া নম্বরে কল করি, বা ইমেইল দিলে ইমেইল করি।' },
];

function ChannelIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-tint)] text-[var(--color-accent)]"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        {children}
      </svg>
    </span>
  );
}

export default function BanglaContactPage() {
  const email = contactEmail();

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(CRUMBS),
          { '@context': 'https://schema.org', '@type': 'ContactPage', name: `${SITE_NAME}-এর সাথে যোগাযোগ`, url: absoluteUrl('/bn/contact'), inLanguage: 'bn' },
        ]}
      />
      <PageHero
        locale="bn"
        eyebrow="যোগাযোগ"
        title="আমাদের সাথে কথা বলুন"
        intro="প্যাকেজ, শুরু করা বা Ecomesta আপনার ব্যবসায় কীভাবে মানাবে — প্রশ্ন আছে? মেসেজ পাঠান, আমাদের টিম যোগাযোগ করবে।"
        crumbs={CRUMBS}
      />

      <Container className="grid gap-8 py-14 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-10">
        <FadeUp
          as="section"
          aria-labelledby="send-message"
          className="self-start rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-[0_12px_32px_-16px_rgba(2,40,87,0.18)] sm:p-8"
        >
          <h2 id="send-message" className="font-display text-2xl tracking-tight sm:text-3xl">
            আমাদের মেসেজ পাঠান
          </h2>
          <p className="mt-2 text-[var(--color-muted)]">
            স্টোর থাকলে তার নামও লিখুন। আপনার তথ্য শুধু উত্তর দেওয়ার জন্যই ব্যবহার করি।
          </p>
          <div className="mt-6">
            <ContactForm locale="bn" />
          </div>
        </FadeUp>

        <div className="space-y-6">
          <FadeUp
            as="section"
            delay={0.06}
            aria-labelledby="reach-us"
            className="rounded-2xl border border-[var(--color-border)] bg-white p-6 sm:p-7"
          >
            <h2 id="reach-us" className="font-display text-2xl tracking-tight">
              Ecomesta টিমের সাথে যোগাযোগ
            </h2>
            <ul className="mt-5 space-y-5">
              <li className="flex gap-4">
                <ChannelIcon>
                  <path d={CONTACT_ICON_PATHS.phone} />
                </ChannelIcon>
                <div>
                  <p className="font-semibold">ফোন</p>
                  <a
                    href={SUPPORT_PHONE.href}
                    data-cta="call-contact"
                    className="font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline"
                  >
                    {SUPPORT_PHONE.display}
                  </a>
                </div>
              </li>
              <li className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f9ee] text-[#128C7E]"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d={CONTACT_ICON_PATHS.whatsapp} />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold">হোয়াটসঅ্যাপ</p>
                  <a
                    href={SUPPORT_WHATSAPP.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-cta="whatsapp-contact"
                    className="font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline"
                  >
                    {SUPPORT_WHATSAPP.display}
                  </a>
                </div>
              </li>
              {email ? (
                <li className="flex gap-4">
                  <ChannelIcon>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </ChannelIcon>
                  <div className="min-w-0">
                    <p className="font-semibold">ইমেইল</p>
                    <a
                      href={`mailto:${email}`}
                      className="break-all font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline"
                    >
                      {email}
                    </a>
                  </div>
                </li>
              ) : null}
              <li className="flex gap-4">
                <ChannelIcon>
                  <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
                </ChannelIcon>
                <div>
                  <p className="font-semibold">সাপোর্ট চ্যাট</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    ছোট প্রশ্ন? সাথে সাথে উত্তর পেতে পেজের নিচের চ্যাট বাটন ব্যবহার করুন — দরকার হলে এটি আপনাকে
                    একজন মানুষের কাছে পৌঁছে দেয়।
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <ChannelIcon>
                  <path d="M4 7h16v12H4z" />
                  <path d="M4 7 6 4h12l2 3" />
                  <path d="M9 12h6" />
                </ChannelIcon>
                <div>
                  <p className="font-semibold">আগে থেকেই Ecomesta-তে বিক্রি করছেন?</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    লগইন করে ড্যাশবোর্ডের <strong className="text-[var(--color-ink)]">Help &amp; support</strong> খুলুন —
                    আপনার অনুরোধ স্টোরের তথ্যসহ আমাদের কাছে আসে।
                  </p>
                  <a
                    href={merchantUrl('/dashboard/support')}
                    className="mt-1 inline-block text-sm font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline"
                  >
                    Help &amp; support খুলুন →
                  </a>
                </div>
              </li>
            </ul>
            <div className="mt-6 border-t border-[var(--color-border)] pt-5">
              <p className="text-sm font-semibold">Ecomesta-কে ফলো করুন</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {SOCIAL_LINKS.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold hover:border-[var(--color-accent)]"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={`h-4 w-4 ${social.label === 'Facebook' ? 'text-[#1877F2]' : 'text-[#FF0000]'}`}>
                        <path d={social.label === 'Facebook' ? CONTACT_ICON_PATHS.facebook : CONTACT_ICON_PATHS.youtube} />
                      </svg>
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href={registerUrl()} cta="create-store-contact">
                স্টোর খুলুন
              </ButtonLink>
              <ButtonLink href={loginUrl()} variant="secondary">
                মার্চেন্ট লগইন
              </ButtonLink>
            </div>
          </FadeUp>

          <FadeUp as="section" delay={0.1} aria-labelledby="self-serve" className="space-y-4">
            <h2 id="self-serve" className="font-display text-2xl tracking-tight">
              এখনই উত্তর খুঁজুন
            </h2>
            <LinkCard href="/bn/faq" title="সাধারণ প্রশ্ন" description="স্টোর, পেমেন্ট, ডেলিভারি, চেকআউট আর আরও অনেক কিছু।" locale="bn" />
            <LinkCard href="/bn/resources" title="গাইড ও রিসোর্স" description="প্ল্যাটফর্মের প্রতিটি অংশের সেটআপ গাইড।" locale="bn" />
            <LinkCard href="/bn/pricing" title="প্যাকেজ ও দাম" description="টাকায় প্যাকেজ আর দাম, মাসে ৳৯৯ থেকে।" locale="bn" />
          </FadeUp>
        </div>
      </Container>

      <section aria-labelledby="what-next" className="border-t border-[var(--color-border)] bg-[var(--brand-paper)]">
        <Container className="py-14">
          <h2 id="what-next" className="font-display text-3xl tracking-tight">
            এরপর যা হয়
          </h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {NEXT_STEPS.map((step, index) => (
              <FadeUp
                as="li"
                key={step.title}
                delay={index * 0.06}
                className="rounded-2xl border border-[var(--color-border)] bg-white p-6"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-white">
                  {(index + 1).toLocaleString('bn-BD')}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-[var(--color-muted)]">{step.text}</p>
              </FadeUp>
            ))}
          </ol>
        </Container>
      </section>

      <CtaSection locale="bn" />
    </>
  );
}
