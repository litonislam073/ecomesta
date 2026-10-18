import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogPostView, blogPostPath, findBlogPost } from '@/components/marketing/blog-views';
import { blogShareImagePath } from '@/lib/marketing/blog-covers';
import { blogPosts } from '@/lib/marketing/content';
import { buildMetadata } from '@/lib/marketing/seo';

type Params = { params: { slug: string } };

export const dynamicParams = false;

export function generateStaticParams() {
  return blogPosts('bn').map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const post = findBlogPost(params.slug, 'bn');
  if (!post) {
    return {};
  }
  return buildMetadata({
    path: blogPostPath(post.slug, 'bn'),
    locale: 'bn',
    title: post.title,
    description: post.description,
    type: 'article',
    publishedTime: post.publishedTime,
    modifiedTime: post.modifiedTime,
    image: blogShareImagePath(post.slug),
  });
}

export default function BanglaBlogPostPage({ params }: Params) {
  const post = findBlogPost(params.slug, 'bn');
  if (!post) {
    notFound();
  }
  return <BlogPostView post={post} locale="bn" />;
}
