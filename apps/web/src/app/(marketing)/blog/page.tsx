import Link from 'next/link';
import { CtaSection, JsonLd, PageHero } from '@/components/marketing/blocks';
import { Container } from '@/components/marketing/ui';
import {
  BLOG_CATEGORIES,
  BLOG_POSTS,
  blogCategoryName,
  formatPostDate as formatDate,
} from '@/lib/marketing/content/blog';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/blog',
  title: 'Ecomesta Blog — Guides for Selling Online in Bangladesh',
  description:
    'Practical guides on running an online store in Bangladesh: delivery charges, Cash on Delivery and online payments, moving from Facebook to your own store and more.',
});

const CRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Blog', path: '/blog' },
];

export default function BlogPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(CRUMBS)} />
      <PageHero
        eyebrow="Blog"
        title="Guides for selling online in Bangladesh"
        intro="Practical, specific advice for running an online store — written for merchants, not search engines."
        crumbs={CRUMBS}
      />
      <Container className="py-14">
        <section aria-labelledby="latest-posts">
          <h2 id="latest-posts" className="font-display text-2xl tracking-tight">
            Latest articles
          </h2>
          <ul className="mt-6 grid gap-5 md:grid-cols-3">
            {BLOG_POSTS.map((post) => (
              <li key={post.slug}>
                <article className="flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-white p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
                    {blogCategoryName(post.category)}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold leading-snug">
                    <Link href={`/blog/${post.slug}`} className="hover:text-[var(--color-accent)] hover:underline">
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{post.description}</p>
                  <p className="mt-auto pt-5 text-xs text-[var(--color-muted)]">
                    <time dateTime={post.publishedTime}>{formatDate(post.publishedTime)}</time> ·{' '}
                    {post.readingMinutes} min read
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="topics" className="mt-14">
          <h2 id="topics" className="font-display text-2xl tracking-tight">
            Topics we cover
          </h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {BLOG_CATEGORIES.map((category) => (
              <li
                key={category.slug}
                className="rounded-full border border-[var(--color-border)] bg-white px-4 py-1.5 text-sm text-[var(--color-muted)]"
              >
                {category.name}
              </li>
            ))}
          </ul>
        </section>
      </Container>
      <CtaSection />
    </>
  );
}
