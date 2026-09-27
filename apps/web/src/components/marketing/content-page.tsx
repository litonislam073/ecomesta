import { contentPath, type ContentPage } from '@/lib/marketing/content';
import { breadcrumbJsonLd, faqJsonLd, type Crumb } from '@/lib/marketing/seo';
import { registerUrl } from '@/lib/marketing/site';
import { FadeUp } from '../animations/fade';
import { StaggerContainer } from '../animations/stagger';
import { StaggerItem } from '../animations/stagger-item';
import { CtaSection, FaqList, Flow, JsonLd, LinkCard, PageHero } from './blocks';
import { ButtonLink, CheckList, Container } from './ui';

const HUB_LABELS: Record<ContentPage['hub'], string> = {
  features: 'Features',
  payments: 'Payments',
  shipping: 'Shipping',
  solutions: 'Solutions',
};

export function contentCrumbs(page: ContentPage): Crumb[] {
  return [
    { name: 'Home', path: '/' },
    { name: HUB_LABELS[page.hub], path: `/${page.hub}` },
    { name: page.name, path: contentPath(page) },
  ];
}

export function ContentPageView({ page }: { page: ContentPage }) {
  const crumbs = contentCrumbs(page);
  const jsonLd = [breadcrumbJsonLd(crumbs), ...(page.faqs.length ? [faqJsonLd(page.faqs)] : [])];

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHero eyebrow={page.eyebrow} title={page.h1} intro={page.intro} crumbs={crumbs}>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={registerUrl()} cta={`create-store-${page.hub}-${page.slug}`}>
            Create Your Store
          </ButtonLink>
          <ButtonLink href="/features" variant="secondary">
            Explore Features
          </ButtonLink>
        </div>
      </PageHero>

      <Container className="grid gap-12 py-14 lg:grid-cols-[1fr_300px] lg:gap-16">
        <div className="min-w-0 space-y-12">
          {page.sections.map((section) => (
            <FadeUp as="section" key={section.heading} aria-labelledby={slugify(section.heading)}>
              <h2
                id={slugify(section.heading)}
                className="font-display text-2xl tracking-tight text-[var(--color-ink)] sm:text-3xl"
              >
                {section.heading}
              </h2>
              {section.flow ? (
                <div className="mt-5">
                  <Flow steps={section.flow} label={section.heading} />
                </div>
              ) : null}
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-4 text-lg leading-relaxed text-[var(--color-muted)]">
                  {paragraph}
                </p>
              ))}
              {section.bullets ? <CheckList items={section.bullets} className="mt-5" /> : null}
            </FadeUp>
          ))}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
              At a glance
            </h2>
            <CheckList items={page.highlights} className="mt-4 text-[15px]" />
            <ButtonLink href={registerUrl()} size="sm" cta={`create-store-aside-${page.slug}`} className="mt-6 w-full">
              Create Your Store
            </ButtonLink>
          </div>
        </aside>
      </Container>

      {page.faqs.length ? (
        <section aria-labelledby="page-faq" className="border-t border-[var(--color-border)] bg-white/60 py-14">
          <Container className="max-w-3xl">
            <FadeUp>
              <h2 id="page-faq" className="font-display text-2xl tracking-tight sm:text-3xl">
                Frequently asked questions
              </h2>
              <div className="mt-6">
                <FaqList faqs={page.faqs} />
              </div>
            </FadeUp>
          </Container>
        </section>
      ) : null}

      <section aria-labelledby="related-heading" className="py-14">
        <Container>
          <FadeUp as="h2" distance={16} id="related-heading" className="font-display text-2xl tracking-tight sm:text-3xl">
            Related
          </FadeUp>
          <StaggerContainer as="ul" className="mt-6 grid gap-4 md:grid-cols-3">
            {page.related.map((link) => (
              <StaggerItem as="li" key={link.href}>
                <LinkCard href={link.href} title={link.label} description={link.description} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      <CtaSection />
    </>
  );
}

export function HubPageView({
  crumbs,
  eyebrow,
  title,
  intro,
  pages,
  children,
}: {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  intro: string;
  pages: ContentPage[];
  children?: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <PageHero eyebrow={eyebrow} title={title} intro={intro} crumbs={crumbs}>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={registerUrl()} cta={`create-store-hub-${crumbs.at(-1)?.path.slice(1)}`}>
            Create Your Store
          </ButtonLink>
        </div>
      </PageHero>
      <section aria-label={`${eyebrow} pages`} className="py-14">
        <Container>
          <StaggerContainer as="ul" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => (
              <StaggerItem as="li" key={page.slug}>
                <LinkCard href={contentPath(page)} title={page.name} description={page.summary} headingLevel={2} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>
      {children}
      <CtaSection />
    </>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
