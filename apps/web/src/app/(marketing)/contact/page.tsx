import { CtaSection, JsonLd, LinkCard, PageHero } from '@/components/marketing/blocks';
import { ContactForm } from '@/components/marketing/contact-form';
import { FadeUp } from '@/components/animations/fade';
import { ButtonLink, Container } from '@/components/marketing/ui';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/marketing/seo';
import { SITE_NAME, absoluteUrl, contactEmail, loginUrl, merchantUrl, registerUrl } from '@/lib/marketing/site';

export const metadata = buildMetadata({
  path: '/contact',
  title: 'Contact Ecomesta',
  description:
    'Contact the Ecomesta team about plans, getting started, payments or your online store. Send us a message and we will call or email you back.',
});

const CRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Contact', path: '/contact' },
];

const NEXT_STEPS = [
  { title: 'You send a message', text: 'Tell us who you are and what you need — a few lines are enough.' },
  { title: 'Our team reads it', text: 'A person on the Ecomesta team reviews every message, not a bot.' },
  { title: 'We get back to you', text: 'We call you on the number you gave, or email you if you added one.' },
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

export default function ContactPage() {
  const email = contactEmail();

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(CRUMBS),
          { '@context': 'https://schema.org', '@type': 'ContactPage', name: `Contact ${SITE_NAME}`, url: absoluteUrl('/contact') },
        ]}
      />
      <PageHero
        eyebrow="Contact"
        title="Talk to us"
        intro="Questions about plans, getting started or how Ecomesta fits your business? Send us a message and our team will get back to you."
        crumbs={CRUMBS}
      />

      <Container className="grid gap-8 py-14 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-10">
        <FadeUp
          as="section"
          aria-labelledby="send-message"
          className="self-start rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-[0_12px_32px_-16px_rgba(2,40,87,0.18)] sm:p-8"
        >
          <h2 id="send-message" className="font-display text-2xl tracking-tight sm:text-3xl">
            Send us a message
          </h2>
          <p className="mt-2 text-[var(--color-muted)]">
            Include your store name if you already have one. We only use your details to answer you.
          </p>
          <div className="mt-6">
            <ContactForm />
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
              Reach the Ecomesta team
            </h2>
            <ul className="mt-5 space-y-5">
              {email ? (
                <li className="flex gap-4">
                  <ChannelIcon>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </ChannelIcon>
                  <div className="min-w-0">
                    <p className="font-semibold">Email</p>
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
                  <p className="font-semibold">Support chat</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    Have a quick question? Use the chat button at the bottom of the page for instant answers — it can
                    pass you to a person when needed.
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
                  <p className="font-semibold">Already selling on Ecomesta?</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    Sign in and open <strong className="text-[var(--color-ink)]">Help &amp; support</strong> in your
                    dashboard — your request reaches us with your store details.
                  </p>
                  <a
                    href={merchantUrl('/dashboard/support')}
                    className="mt-1 inline-block text-sm font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline"
                  >
                    Open Help &amp; support →
                  </a>
                </div>
              </li>
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href={registerUrl()} cta="create-store-contact">
                Create Your Store
              </ButtonLink>
              <ButtonLink href={loginUrl()} variant="secondary">
                Merchant login
              </ButtonLink>
            </div>
          </FadeUp>

          <FadeUp as="section" delay={0.1} aria-labelledby="self-serve" className="space-y-4">
            <h2 id="self-serve" className="font-display text-2xl tracking-tight">
              Find answers now
            </h2>
            <LinkCard href="/faq" title="FAQ" description="Stores, payments, delivery, checkout and more." />
            <LinkCard href="/resources" title="Resources" description="Setup guides for every part of the platform." />
            <LinkCard href="/pricing" title="Pricing" description="Plans and prices in BDT, from ৳99 a month." />
          </FadeUp>
        </div>
      </Container>

      <section aria-labelledby="what-next" className="border-t border-[var(--color-border)] bg-[var(--brand-paper)]">
        <Container className="py-14">
          <h2 id="what-next" className="font-display text-3xl tracking-tight">
            What happens next
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
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-[var(--color-muted)]">{step.text}</p>
              </FadeUp>
            ))}
          </ol>
        </Container>
      </section>

      <CtaSection />
    </>
  );
}
