import Link from 'next/link';
import type { Crumb, Faq } from '@/lib/marketing/seo';
import { registerUrl } from '@/lib/marketing/site';
import { ButtonLink, Container } from './ui';

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-[var(--color-muted)]">
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1.5">
              {last ? (
                <span aria-current="page" className="text-[var(--color-ink)]">
                  {crumb.name}
                </span>
              ) : (
                <>
                  <Link href={crumb.path} className="hover:text-[var(--color-accent)] hover:underline">
                    {crumb.name}
                  </Link>
                  <span aria-hidden="true">/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Flow({ steps, label }: { steps: string[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-wrap items-stretch gap-2">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink)] shadow-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-bold text-white">
              {index + 1}
            </span>
            {step}
          </span>
          {index < steps.length - 1 ? (
            <span aria-hidden="true" className="text-[var(--color-muted)]">
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function FaqList({ faqs, headingLevel = 3 }: { faqs: Faq[]; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white">
      {faqs.map((faq) => (
        <details key={faq.question} className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">
            <Heading className="text-base font-semibold text-[var(--color-ink)]">{faq.question}</Heading>
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-accent)] transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="pb-5 leading-relaxed text-[var(--color-muted)]">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function LinkCard({
  href,
  title,
  description,
  headingLevel = 3,
}: {
  href: string;
  title: string;
  description: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
    >
      <Heading className="font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
        {title}
      </Heading>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{description}</p>
      <span aria-hidden="true" className="mt-auto pt-4 text-sm font-semibold text-[var(--color-accent)]">
        Learn more →
      </span>
    </Link>
  );
}

export function CtaSection({
  title = 'Ready to open your online store?',
  description = 'Create your store, add products and start taking orders with Cash on Delivery or online payments.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section aria-labelledby="cta-heading" className="py-16 sm:py-20">
      <Container>
        <div className="relative overflow-hidden rounded-2xl bg-[#10231e] px-6 py-12 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(circle at 15% 20%, rgba(52,168,140,0.35), transparent 45%), radial-gradient(circle at 85% 90%, rgba(212,160,90,0.25), transparent 40%)',
            }}
          />
          <div className="relative">
            <h2 id="cta-heading" className="font-display text-3xl tracking-tight text-white sm:text-4xl">
              {title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-[#c9d6d1]">{description}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href={registerUrl()} cta="create-store-cta-band">
                Create Your Store
              </ButtonLink>
              <ButtonLink href="/features" variant="secondary">
                Explore Features
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function PageHero({
  eyebrow,
  title,
  intro,
  crumbs,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  crumbs?: Crumb[];
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-[var(--color-border)] bg-gradient-to-b from-[#eef5f2] to-[#fbfaf7]">
      <Container className="py-12 sm:py-16">
        {crumbs ? <Breadcrumbs crumbs={crumbs} /> : null}
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-muted)]">{intro}</p>
        {children}
      </Container>
    </section>
  );
}
