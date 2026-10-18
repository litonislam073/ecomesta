import { HubPageView } from '@/components/marketing/content-page';
import { pagesForHub } from '@/lib/marketing/content';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/bn/solutions',
  locale: 'bn',
  title: 'বাংলাদেশের ব্যবসার জন্য ই-কমার্স সমাধান | Ecomesta',
  description:
    'ছোট ব্যবসা, ফেসবুক সেলার, প্রতিষ্ঠিত অনলাইন ব্যবসা আর দোকান — বাংলাদেশে অনলাইনে বিক্রি করতে চাইলে Ecomesta কীভাবে মানায়, দেখুন।',
});

export default function BanglaSolutionsPage() {
  return (
    <HubPageView
      locale="bn"
      crumbs={[
        { name: 'হোম', path: '/bn' },
        { name: 'সমাধান', path: '/bn/solutions' },
      ]}
      eyebrow="সমাধান"
      title="আপনার বিক্রির ধরন অনুযায়ী অনলাইন স্টোর"
      intro="প্রথম অনলাইন দোকান খুলছেন বা ব্যস্ত একটি দোকান গোছাচ্ছেন — একই প্ল্যাটফর্ম মানিয়ে নেয়। আপনার অবস্থার সবচেয়ে কাছেরটি বেছে নিন।"
      pages={pagesForHub('solutions', 'bn')}
    />
  );
}
