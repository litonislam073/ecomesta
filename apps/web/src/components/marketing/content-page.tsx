import type { MarketingLocale } from '@ecomesta/ui/marketing';
import { contentPath, type ContentPage } from '@/lib/marketing/content';
import { breadcrumbJsonLd, faqJsonLd, type Crumb } from '@/lib/marketing/seo';
import { registerUrl } from '@/lib/marketing/site';
import { UI_COPY, href } from '@/lib/marketing/ui-copy';
import { FadeUp } from '../animations/fade';
import { StaggerContainer } from '../animations/stagger';
import { StaggerItem } from '../animations/stagger-item';
import { CtaSection, FaqList, Flow, JsonLd, LinkCard, PageHero } from './blocks';
import { ButtonLink, CheckList, Container } from './ui';

/** The page's address in the given language (`/features/coupons` or `/bn/features/coupons`). */
export function localizedContentPath(page: ContentPage, locale: MarketingLocale = 'en'): string {
  return href(contentPath(page), locale);
}

export function contentCrumbs(page: ContentPage, locale: MarketingLocale = 'en'): Crumb[] {
  const copy = UI_COPY[locale];
  return [
    { name: copy.home, path: href('/', locale) },
    { name: copy.hubs[page.hub], path: href(`/${page.hub}`, locale) },
    { name: page.name, path: localizedContentPath(page, locale) },
  ];
}

export function ContentPageView({ page, locale = 'en' }: { page: ContentPage; locale?: MarketingLocale }) {
  const copy = UI_COPY[locale];
  const crumbs = contentCrumbs(page, locale);
  const jsonLd = [breadcrumbJsonLd(crumbs), ...(page.faqs.length ? [faqJsonLd(page.faqs)] : [])];

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHero eyebrow={page.eyebrow} title={page.h1} intro={page.intro} crumbs={crumbs} locale={locale}>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={registerUrl()} cta={`create-store-${page.hub}-${page.slug}`}>
            {copy.createStore}
          </ButtonLink>
          <ButtonLink href={href('/features', locale)} variant="secondary">
            {copy.exploreFeatures}
          </ButtonLink>
        </div>
      </PageHero>

      <Container className="grid gap-12 py-14 lg:grid-cols-[1fr_300px] lg:gap-16">
        <div className="min-w-0 space-y-12">
          {page.sections.map((section, index) => (
            <FadeUp as="section" key={section.heading} aria-labelledby={sectionId(section.heading, index)}>
              <h2
                id={sectionId(section.heading, index)}
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
              {copy.atAGlance}
            </h2>
            <CheckList items={page.highlights} className="mt-4 text-[15px]" />
            <ButtonLink href={registerUrl()} size="sm" cta={`create-store-aside-${page.slug}`} className="mt-6 w-full">
              {copy.createStore}
            </ButtonLink>
          </div>
        </aside>
      </Container>

      {page.faqs.length ? (
        <section aria-labelledby="page-faq" className="border-t border-[var(--color-border)] bg-white/60 py-14">
          <Container className="max-w-3xl">
            <FadeUp>
              <h2 id="page-faq" className="font-display text-2xl tracking-tight sm:text-3xl">
                {copy.faqHeading}
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
            {copy.related}
          </FadeUp>
          <StaggerContainer as="ul" className="mt-6 grid gap-4 md:grid-cols-3">
            {page.related.map((link) => (
              <StaggerItem as="li" key={link.href}>
                <LinkCard href={href(link.href, locale)} title={link.label} description={link.description} locale={locale} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      <CtaSection locale={locale} />
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
  locale = 'en',
}: {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  intro: string;
  pages: ContentPage[];
  children?: React.ReactNode;
  locale?: MarketingLocale;
}) {
  const copy = UI_COPY[locale];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <PageHero eyebrow={eyebrow} title={title} intro={intro} crumbs={crumbs} locale={locale}>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={registerUrl()} cta={`create-store-hub-${crumbs.at(-1)?.path.split('/').pop()}`}>
            {copy.createStore}
          </ButtonLink>
        </div>
      </PageHero>
      <section aria-label={copy.hubPages(eyebrow)} className="py-14">
        <Container>
          <StaggerContainer as="ul" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => (
              <StaggerItem as="li" key={page.slug}>
                <LinkCard
                  href={localizedContentPath(page, locale)}
                  title={page.name}
                  description={page.summary}
                  headingLevel={2}
                  locale={locale}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>
      {children}
      <CtaSection locale={locale} />
    </>
  );
}

/** Anchor id from the heading; Bangla headings have no Latin letters, so fall back to the position. */
function sectionId(heading: string, index: number): string {
  return slugify(heading) || `section-${index + 1}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
