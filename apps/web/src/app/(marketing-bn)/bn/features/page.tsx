import { HubPageView } from '@/components/marketing/content-page';
import { pagesForHub } from '@/lib/marketing/content';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/bn/features',
  locale: 'bn',
  title: 'বাংলাদেশের অনলাইন স্টোরের জন্য ই-কমার্স ফিচার | Ecomesta',
  description:
    'Ecomesta-র ফিচারগুলো দেখুন: অনলাইন স্টোর, প্রোডাক্ট ও স্টক ম্যানেজমেন্ট, অর্ডার, কাস্টমার, কুপন, ল্যান্ডিং পেজ, স্টোর ডিজাইন, নিজের ডোমেইন আর অর্ডার ট্র্যাকিং।',
});

export default function BanglaFeaturesPage() {
  return (
    <HubPageView
      locale="bn"
      crumbs={[
        { name: 'হোম', path: '/bn' },
        { name: 'ফিচার', path: '/bn/features' },
      ]}
      eyebrow="ফিচার"
      title="অনলাইন স্টোর চালাতে যা যা লাগে"
      intro="প্রতিটি ফিচার একই প্ল্যাটফর্মে বানানো, তাই প্রোডাক্ট, স্টক, অর্ডার, পেমেন্ট আর ডেলিভারি একসাথে যুক্ত থাকে। একটি ফিচার বেছে দেখুন এটি এখন ঠিক কীভাবে কাজ করে।"
      pages={pagesForHub('features', 'bn')}
    />
  );
}
