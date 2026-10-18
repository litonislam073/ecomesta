import { BlogIndexView } from '@/components/marketing/blog-views';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/bn/blog',
  locale: 'bn',
  title: 'Ecomesta ব্লগ — বাংলাদেশে অনলাইনে বিক্রির গাইড',
  description:
    'বাংলাদেশে অনলাইন স্টোর চালানোর কাজের গাইড: ওয়েবসাইটের খরচ, ডেলিভারি চার্জ, ক্যাশ অন ডেলিভারি ও অনলাইন পেমেন্ট, ফেসবুক থেকে নিজের স্টোরে যাওয়া আর আরও অনেক কিছু।',
});

export default function BanglaBlogPage() {
  return <BlogIndexView locale="bn" />;
}
