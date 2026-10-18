import Link from 'next/link';
import type { PublicPlan } from '@ecomesta/types';
import { localizedHref, type MarketingLocale } from '@ecomesta/ui/marketing';
import {
  faqJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from '@/lib/marketing/seo';
import { registerUrl } from '@/lib/marketing/site';
import { FadeLeft, FadeUp, ScaleIn } from '../animations/fade';
import { StaggerContainer } from '../animations/stagger';
import { StaggerItem } from '../animations/stagger-item';
import { CtaSection, FaqList, Flow, JsonLd, LinkCard } from './blocks';
import { DashboardPreview } from './dashboard-preview';
import { HOME_COPY } from './home-copy';
import { Icon, IconBadge } from './icons';
import { ButtonLink, CheckList, Container, SectionHeader, TextLink } from './ui';
import { trialHeadline } from '@/lib/marketing/trial';

export function MarketingHome({
  plans,
  locale = 'en',
}: { plans?: PublicPlan[] | null; locale?: MarketingLocale } = {}) {
  const register = registerUrl();
  const copy = HOME_COPY[locale];
  const link = (path: string) => localizedHref(path, locale);
  // A trial the Super Admin has switched on leads the price facts under the buttons.
  const trial = trialHeadline(plans, locale);
  const heroOffer = trial ? [trial, ...copy.hero.offer] : copy.hero.offer;
  const homeFaqs = copy.faq.items;

  return (
    <>
      <JsonLd
        data={[organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd(plans), faqJsonLd(homeFaqs)]}
      />

      <section aria-labelledby="hero-heading" className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div
          aria-hidden="true"
          className="em-drift pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 10% 0%, rgba(1,135,240,0.14), transparent 70%), radial-gradient(ellipse 45% 40% at 100% 100%, rgba(3,165,129,0.14), transparent 70%)',
          }}
        />
        <Container className="relative grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <FadeUp
              on="load"
              as="p"
              distance={12}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-sm font-medium text-[var(--color-accent)]"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              {copy.hero.badge}
            </FadeUp>
            <FadeUp
              on="load"
              as="h1"
              delay={0.04}
              id="hero-heading"
              className="mt-6 font-display text-4xl leading-[1.08] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-[3.4rem]"
            >
              {copy.hero.title}
            </FadeUp>
            <FadeUp on="load" as="p" delay={0.12} className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
              {copy.hero.intro}
            </FadeUp>
            <div className="mt-8 flex flex-wrap gap-3">
              <FadeUp on="load" as="span" delay={0.18} className="inline-flex">
                <ButtonLink href={register} cta="create-store-hero">
                  {copy.hero.primary}
                </ButtonLink>
              </FadeUp>
              <FadeUp on="load" as="span" delay={0.24} className="inline-flex">
                <ButtonLink href={link("/features")} variant="secondary">
                  {copy.hero.secondary}
                </ButtonLink>
              </FadeUp>
            </div>
            <FadeUp
              on="load"
              as="ul"
              delay={0.27}
              distance={12}
              aria-label={locale === 'bn' ? 'দাম আর পেমেন্ট' : 'Price and payment'}
              className="mt-6 inline-flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[var(--brand-green)]/30 bg-[var(--brand-green-tint)] px-4 py-3 text-sm font-semibold text-[var(--brand-green-text)]"
            >
              {heroOffer.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand-green)] text-white">
                    <svg viewBox="0 0 20 20" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </FadeUp>
            <FadeUp on="load" as="ul" delay={0.3} distance={12} className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-muted)]">
              {copy.hero.points.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 text-[var(--brand-green)]" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </FadeUp>
          </div>
          <ScaleIn on="load" delay={0.15} className="lg:pl-4">
            <DashboardPreview />
          </ScaleIn>
        </Container>
      </section>

      <section aria-labelledby="manage-heading" className="py-16">
        <Container>
          <FadeUp as="h2" distance={12} id="manage-heading" className="text-center text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
            {copy.manage.heading}
          </FadeUp>
          <StaggerContainer as="ul" step={0.05} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {copy.manage.items.map((item) => (
              <StaggerItem as="li" key={item.label}>
                <Link
                  href={link(item.href)}
                  className="em-hover-lift flex h-full flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-2 py-4 text-center text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <Icon name={item.icon} className="em-hover-icon h-6 w-6 text-[var(--color-accent)]" />
                  {item.label}
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      <section aria-labelledby="features-heading" className="border-y border-[var(--color-border)] bg-white py-20">
        <Container>
          <FadeUp>
            <SectionHeader
              id="features-heading"
              eyebrow={copy.features.eyebrow}
              title={copy.features.title}
              description={copy.features.description}
            />
          </FadeUp>
          <StaggerContainer as="ul" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {copy.features.items.map((feature) => (
              <StaggerItem as="li" key={feature.title} className="em-hover-lift flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--brand-paper)] p-6">
                <IconBadge name={feature.icon} />
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-[var(--color-muted)]">{feature.body}</p>
                <CheckList items={feature.points} className="mt-4 text-sm" />
                <TextLink href={link(feature.href)} className="mt-auto pt-5 text-sm">
                  {feature.linkLabel} →
                </TextLink>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      <section aria-labelledby="payments-heading" className="py-20">
        <Container>
          <FadeUp>
            <SectionHeader
              id="payments-heading"
              eyebrow={copy.payments.eyebrow}
              title={copy.payments.title}
              description={copy.payments.description}
            />
          </FadeUp>
          <StaggerContainer as="ul" className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {copy.payments.items.map((payment) => (
              <StaggerItem as="li" key={payment.title}>
                <Link
                  href={link(payment.href)}
                  className="em-hover-lift group flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-white p-6 hover:border-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  <IconBadge name={payment.icon} />
                  <h3 className="mt-4 text-lg font-semibold group-hover:text-[var(--color-accent)]">{payment.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{payment.body}</p>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
          <p className="mt-6 max-w-3xl text-sm text-[var(--color-muted)]">{copy.payments.note}</p>
        </Container>
      </section>

      <section aria-labelledby="shipping-heading" className="border-y border-[var(--color-border)] bg-[var(--brand-tint)] py-20">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <FadeLeft>
            <SectionHeader
              id="shipping-heading"
              eyebrow={copy.shipping.eyebrow}
              title={copy.shipping.title}
              description={copy.shipping.description}
            />
            <CheckList className="mt-6" items={copy.shipping.points} />
            <div className="mt-8 flex flex-wrap gap-4">
              {copy.shipping.links.map((item) => (
                <TextLink key={item.href} href={link(item.href)}>
                  {item.label} →
                </TextLink>
              ))}
            </div>
          </FadeLeft>
          <ScaleIn scale={0.98} duration={0.7} delay={0.08} className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-[var(--color-muted)]">{copy.shipping.chartTitle}</p>
            <ol className="mt-4 space-y-2">
              {copy.shipping.chartSteps.map((step, index, all) => (
                <li key={step}>
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--brand-paper)] px-4 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="font-medium">{step}</span>
                  </div>
                  {index < all.length - 1 ? (
                    <span aria-hidden="true" className="ml-6 block h-2 border-l-2 border-dashed border-[var(--color-border)]" />
                  ) : null}
                </li>
              ))}
            </ol>
          </ScaleIn>
        </Container>
      </section>

      <section aria-labelledby="builder-heading" className="py-20">
        <Container>
          <FadeUp>
            <SectionHeader
              id="builder-heading"
              eyebrow={copy.builder.eyebrow}
              title={copy.builder.title}
              description={copy.builder.description}
            />
          </FadeUp>
          <FadeUp delay={0.08} className="mt-8">
            <Flow label={copy.builder.flowLabel} steps={copy.builder.flowSteps} />
          </FadeUp>
          <StaggerContainer className="mt-10 grid gap-5 md:grid-cols-3">
            {copy.builder.groups.map((group) => (
              <StaggerItem key={group.title} className="em-hover-lift rounded-xl border border-[var(--color-border)] bg-white p-6">
                <h3 className="font-semibold">{group.title}</h3>
                <CheckList items={group.items} className="mt-4 text-sm" />
              </StaggerItem>
            ))}
          </StaggerContainer>
          <p className="mt-6">
            <TextLink href={link(copy.builder.link.href)}>{copy.builder.link.label} →</TextLink>
          </p>
        </Container>
      </section>

      <section aria-labelledby="solutions-heading" className="border-t border-[var(--color-border)] bg-white py-20">
        <Container>
          <FadeUp>
            <SectionHeader
              id="solutions-heading"
              eyebrow={copy.solutions.eyebrow}
              title={copy.solutions.title}
            />
          </FadeUp>
          <StaggerContainer as="ul" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.solutions.items.map((page) => (
              <StaggerItem as="li" key={page.slug}>
                <LinkCard href={link(`/solutions/${page.slug}`)} title={page.name} description={page.summary} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      <section aria-labelledby="home-faq-heading" className="py-20">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <FadeUp>
            <SectionHeader id="home-faq-heading" eyebrow={copy.faq.eyebrow} title={copy.faq.title} />
            <p className="mt-4 text-[var(--color-muted)]">{copy.faq.intro}</p>
            <div className="mt-6 flex flex-wrap gap-4">
              {copy.faq.links.map((item) => (
                <TextLink key={item.href} href={link(item.href)}>
                  {item.label} →
                </TextLink>
              ))}
            </div>
          </FadeUp>
          <FadeUp delay={0.08}>
            <FaqList faqs={homeFaqs} />
          </FadeUp>
        </Container>
      </section>

      {copy.cta ? (
        <CtaSection
          title={copy.cta.title}
          description={copy.cta.description}
          primary={{ href: register, label: copy.cta.primary, cta: 'create-store-cta-band' }}
          secondary={{ href: link('/features'), label: copy.cta.secondary }}
        />
      ) : (
        <CtaSection />
      )}
    </>
  );
}
