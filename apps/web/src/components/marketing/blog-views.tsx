import Image from 'next/image';
import Link from 'next/link';
import type { MarketingLocale } from '@ecomesta/ui/marketing';
import { CtaSection, Flow, JsonLd, PageHero } from '@/components/marketing/blocks';
import { FadeUp } from '@/components/animations/fade';
import { StaggerContainer } from '@/components/animations/stagger';
import { StaggerItem } from '@/components/animations/stagger-item';
import { CheckList, Container } from '@/components/marketing/ui';
import {
  blogCategories,
  blogCategoryLabel,
  blogPosts,
  formatPostDateFor,
  type BlogPost,
} from '@/lib/marketing/content';
import { COVER_HEIGHT, COVER_WIDTH, blogCoverDataUri, blogShareImagePath } from '@/lib/marketing/blog-covers';
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/marketing/seo';
import { UI_COPY, href } from '@/lib/marketing/ui-copy';

const BLOG_COPY = {
  en: {
    blog: 'Blog',
    eyebrow: 'Blog',
    title: 'Guides for selling online in Bangladesh',
    intro: 'Practical, specific advice for running an online store — written for merchants, not search engines.',
    latest: 'Latest articles',
    topics: 'Topics we cover',
    minRead: (minutes: number) => `${minutes} min read`,
    furtherReading: 'Further reading',
    moreArticles: 'More articles on the Ecomesta blog',
  },
  bn: {
    blog: 'ব্লগ',
    eyebrow: 'ব্লগ',
    title: 'বাংলাদেশে অনলাইনে বিক্রির গাইড',
    intro: 'অনলাইন স্টোর চালানোর কাজের, নির্দিষ্ট পরামর্শ — সার্চ ইঞ্জিনের জন্য নয়, মার্চেন্টদের জন্য লেখা।',
    latest: 'সাম্প্রতিক লেখা',
    topics: 'যেসব বিষয়ে লিখি',
    minRead: (minutes: number) => `${minutes.toLocaleString('bn-BD')} মিনিটে পড়ুন`,
    furtherReading: 'আরও পড়ুন',
    moreArticles: 'Ecomesta ব্লগে আরও লেখা',
  },
} as const;

export function blogPostPath(slug: string, locale: MarketingLocale = 'en'): string {
  return href(`/blog/${slug}`, locale);
}

export function findBlogPost(slug: string, locale: MarketingLocale = 'en'): BlogPost | undefined {
  return blogPosts(locale).find((post) => post.slug === slug);
}

export function BlogIndexView({ locale = 'en' }: { locale?: MarketingLocale }) {
  const copy = BLOG_COPY[locale];
  const crumbs = [
    { name: UI_COPY[locale].home, path: href('/', locale) },
    { name: copy.blog, path: href('/blog', locale) },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <PageHero eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} crumbs={crumbs} locale={locale} />
      <Container className="py-14">
        <section aria-labelledby="latest-posts">
          <h2 id="latest-posts" className="font-display text-2xl tracking-tight">
            {copy.latest}
          </h2>
          <StaggerContainer as="ul" className="mt-6 grid gap-5 md:grid-cols-3">
            {blogPosts(locale).map((post) => (
              <StaggerItem as="li" key={post.slug}>
                <article className="em-hover-lift flex h-full flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
                  <Image
                    src={blogCoverDataUri(post.slug)}
                    alt=""
                    width={COVER_WIDTH}
                    height={COVER_HEIGHT}
                    unoptimized
                    className="aspect-[1200/630] w-full border-b border-[var(--color-border)] object-cover"
                  />
                  <div className="flex flex-1 flex-col p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
                    {blogCategoryLabel(post.category, locale)}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold leading-snug">
                    <Link href={blogPostPath(post.slug, locale)} className="hover:text-[var(--color-accent)] hover:underline">
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{post.description}</p>
                  <p className="mt-auto pt-5 text-xs text-[var(--color-muted)]">
                    <time dateTime={post.publishedTime}>{formatPostDateFor(post.publishedTime, locale)}</time> ·{' '}
                    {copy.minRead(post.readingMinutes)}
                  </p>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
        <FadeUp as="section" aria-labelledby="topics" className="mt-14">
          <h2 id="topics" className="font-display text-2xl tracking-tight">
            {copy.topics}
          </h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {blogCategories(locale).map((category) => (
              <li
                key={category.slug}
                className="rounded-full border border-[var(--color-border)] bg-white px-4 py-1.5 text-sm text-[var(--color-muted)]"
              >
                {category.name}
              </li>
            ))}
          </ul>
        </FadeUp>
      </Container>
      <CtaSection locale={locale} />
    </>
  );
}

export function BlogPostView({ post, locale = 'en' }: { post: BlogPost; locale?: MarketingLocale }) {
  const copy = BLOG_COPY[locale];
  const path = blogPostPath(post.slug, locale);
  const crumbs = [
    { name: UI_COPY[locale].home, path: href('/', locale) },
    { name: copy.blog, path: href('/blog', locale) },
    { name: post.title, path },
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          articleJsonLd({
            path,
            title: post.title,
            description: post.description,
            publishedTime: post.publishedTime,
            modifiedTime: post.modifiedTime,
            image: blogShareImagePath(post.slug),
          }),
        ]}
      />
      <article>
        <PageHero
          eyebrow={blogCategoryLabel(post.category, locale)}
          title={post.title}
          intro={post.intro}
          crumbs={crumbs}
          locale={locale}
        >
          <p className="mt-6 text-sm text-[var(--color-muted)]">
            <time dateTime={post.publishedTime}>{formatPostDateFor(post.publishedTime, locale)}</time> ·{' '}
            {copy.minRead(post.readingMinutes)}
          </p>
        </PageHero>
        <Container className="max-w-4xl pt-10 sm:pt-12">
          <Image
            src={blogCoverDataUri(post.slug)}
            alt={post.title}
            width={COVER_WIDTH}
            height={COVER_HEIGHT}
            unoptimized
            priority
            className="aspect-[1200/630] w-full rounded-2xl border border-[var(--color-border)] object-cover shadow-[0_24px_56px_-28px_rgba(2,40,87,0.35)]"
          />
        </Container>
        <Container className="max-w-3xl space-y-10 py-14">
          {post.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-2xl tracking-tight">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-4 text-lg leading-relaxed text-[var(--color-muted)]">
                  {paragraph}
                </p>
              ))}
              {section.bullets ? <CheckList items={section.bullets} className="mt-5" /> : null}
              {section.flow ? (
                <div className="mt-5">
                  <Flow steps={section.flow} label={section.heading} />
                </div>
              ) : null}
            </section>
          ))}
          <aside aria-labelledby="further-reading" className="rounded-xl border border-[var(--color-border)] bg-white p-6">
            <h2 id="further-reading" className="font-semibold">
              {copy.furtherReading}
            </h2>
            <ul className="mt-3 space-y-2">
              {post.related.map((link) => (
                <li key={link.href}>
                  <Link href={href(link.href, locale)} className="font-medium text-[var(--color-accent)] hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={href('/blog', locale)} className="font-medium text-[var(--color-accent)] hover:underline">
                  {copy.moreArticles}
                </Link>
              </li>
            </ul>
          </aside>
        </Container>
      </article>
      <CtaSection locale={locale} />
    </>
  );
}
