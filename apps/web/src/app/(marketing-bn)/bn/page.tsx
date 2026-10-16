import { MarketingHome } from '@/components/marketing/marketing-home';
import { loadPublicPlans } from '@/lib/marketing/plans';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/bn',
  locale: 'bn',
  title: 'Ecomesta — বাংলাদেশে অনলাইন স্টোর খুলুন ও চালান',
  description:
    'আপনার ব্যবসার জন্য অনলাইন স্টোর খুলুন। প্রোডাক্ট, স্টক, অর্ডার, ক্যাশ অন ডেলিভারি, SSLCommerz পেমেন্ট আর কুরিয়ার বুকিং — সব এক জায়গা থেকে চালান।',
});

export const revalidate = 300;

export default async function BanglaHomePage() {
  return <MarketingHome plans={await loadPublicPlans()} locale="bn" />;
}
