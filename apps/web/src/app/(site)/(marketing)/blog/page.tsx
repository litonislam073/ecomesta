import { BlogIndexView } from '@/components/marketing/blog-views';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/blog',
  title: 'Ecomesta Blog — Guides for Selling Online in Bangladesh',
  description:
    'Practical guides for online stores in Bangladesh: website costs, delivery charges, Cash on Delivery vs online payments and moving from Facebook to your own store.',
});

export default function BlogPage() {
  return <BlogIndexView />;
}
