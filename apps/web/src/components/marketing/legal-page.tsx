import type { ReactNode } from 'react';
import Link from 'next/link';
import { LEGAL_NAV } from '@ecomesta/ui/marketing';
import { JsonLd, PageHero } from '@/components/marketing/blocks';
import { Container } from '@/components/marketing/ui';
import { breadcrumbJsonLd } from '@/lib/marketing/seo';
import { contactEmail } from '@/lib/marketing/site';

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

/** Date shown as "Last updated" on every legal page. */
export const LEGAL_UPDATED = '6 October 2026';

export function P({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed text-[var(--color-muted)]">{children}</p>;
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 leading-relaxed text-[var(--color-muted)] marker:text-[var(--brand-green)]">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-[var(--color-accent)] underline underline-offset-4 hover:text-[var(--color-accent-hover)]">
      {children}
    </Link>
  );
}

/** How to reach us: the contact email when one is configured, otherwise the contact page. */
export function ContactLine() {
  const email = contactEmail();
  return email ? (
    <>
      email us at{' '}
      <a href={`mailto:${email}`} className="font-medium text-[var(--color-accent)] underline underline-offset-4">
        {email}
      </a>{' '}
      or use our <InlineLink href="/contact">contact page</InlineLink>
    </>
  ) : (
    <>
      reach us through our <InlineLink href="/contact">contact page</InlineLink>
    </>
  );
}

export function LegalPage({
  path,
  title,
  intro,
  sections,
}: {
  path: string;
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: title, path },
  ];
  const others = LEGAL_NAV.filter((page) => page.href !== path);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <PageHero eyebrow="Legal" title={title} intro={intro} crumbs={crumbs}>
        <p className="mt-6 inline-flex rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-sm text-[var(--color-muted)]">
          Last updated: <span className="ml-1 font-medium text-[var(--color-ink)]">{LEGAL_UPDATED}</span>
        </p>
      </PageHero>

      <Container className="grid gap-10 py-12 sm:py-14 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="On this page" className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">On this page</p>
            <ol className="mt-3 space-y-2 text-sm">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="flex gap-2 text-[var(--color-muted)] hover:text-[var(--color-accent)]">
                    <span aria-hidden="true" className="w-5 shrink-0 tabular-nums text-[var(--color-accent)]">
                      {index + 1}.
                    </span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <div className="max-w-3xl">
          <div className="space-y-10">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24">
                <h2 id={`${section.id}-title`} className="font-display text-2xl tracking-tight text-[var(--color-ink)]">
                  <span className="text-[var(--color-accent)]">{index + 1}.</span> {section.title}
                </h2>
                <div className="mt-4 space-y-4">{section.content}</div>
              </section>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-[var(--color-border)] bg-[var(--brand-tint)] p-6">
            <h2 className="font-semibold text-[var(--color-ink)]">Other policies</h2>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {others.map((page) => (
                <li key={page.href}>
                  <InlineLink href={page.href}>{page.label}</InlineLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </>
  );
}
