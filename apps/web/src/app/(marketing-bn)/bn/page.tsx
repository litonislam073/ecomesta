import { MarketingHome } from '@/components/marketing/marketing-home';
import { loadPublicPlans } from '@/lib/marketing/plans';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/bn',
  locale: 'bn',
  title: 'ই-কমার্স ওয়েবসাইট বাংলাদেশ: মাসে ৳৯৯ থেকে অনলাইন স্টোর | Ecomesta',
  description:
    'মাসে ৳৯৯ থেকে নিজের ই-কমার্স ওয়েবসাইট খুলুন। ক্যাশ অন ডেলিভারি, bKash ও Nagad পেমেন্ট, কুরিয়ার বুকিং আর ডেলিভারি জোন — সব এক জায়গা থেকে চালান।',
});

export const revalidate = 300;

export default async function BanglaHomePage() {
  return <MarketingHome plans={await loadPublicPlans()} locale="bn" />;
}
