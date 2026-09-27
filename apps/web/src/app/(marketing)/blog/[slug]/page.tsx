import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CtaSection, Flow, JsonLd, PageHero } from '@/components/marketing/blocks';
import { CheckList, Container } from '@/components/marketing/ui';
import {
  BLOG_POSTS,
  blogCategoryName,
  formatPostDate as formatDate,
} from '@/lib/marketing/content/blog';
import { articleJsonLd, breadcrumbJsonLd, buildMetadata } from '@/lib/marketing/seo';

type Params = { params: { slug: string } };

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

function findPost(slug: string) {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function generateMetadata({ params }: Params): Metadata {
  const post = findPost(params.slug);
  if (!post) {
    return {};
  }
  return buildMetadata({
    path: `/blog/${post.slug}`,
    title: post.title,
    description: post.description,
    type: 'article',
    publishedTime: post.publishedTime,
    modifiedTime: post.modifiedTime,
  });
}

export default function BlogPostPage({ params }: Params) {
  const post = findPost(params.slug);
  if (!post) {
    notFound();
  }
  const path = `/blog/${post.slug}`;
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
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
          }),
        ]}
      />
      <article>
        <PageHero eyebrow={blogCategoryName(post.category)} title={post.title} intro={post.intro} crumbs={crumbs}>
          <p className="mt-6 text-sm text-[var(--color-muted)]">
            <time dateTime={post.publishedTime}>{formatDate(post.publishedTime)}</time> ·{' '}
            {post.readingMinutes} min read
          </p>
        </PageHero>
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
              Further reading
            </h2>
            <ul className="mt-3 space-y-2">
              {post.related.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="font-medium text-[var(--color-accent)] hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/blog" className="font-medium text-[var(--color-accent)] hover:underline">
                  More articles on the Ecomesta blog
                </Link>
              </li>
            </ul>
          </aside>
        </Container>
      </article>
      <CtaSection />
    </>
  );
}
