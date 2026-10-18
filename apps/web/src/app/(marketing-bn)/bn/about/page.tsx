import { CtaSection, JsonLd, PageHero } from '@/components/marketing/blocks';
import { FadeUp } from '@/components/animations/fade';
import { CheckList, Container } from '@/components/marketing/ui';
import { breadcrumbJsonLd, buildMetadata, organizationJsonLd } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/bn/about',
  locale: 'bn',
  title: 'Ecomesta সম্পর্কে — বাংলাদেশকে মাথায় রেখে বানানো ই-কমার্স প্ল্যাটফর্ম',
  description:
    'Ecomesta বাংলাদেশের ব্যবসা যেভাবে বিক্রি করে সেভাবে বানানো ই-কমার্স প্ল্যাটফর্ম: টাকায় দাম, দেশের ঠিকানা, জোনভিত্তিক ডেলিভারি, ক্যাশ অন ডেলিভারি আর অনলাইন পেমেন্ট।',
});

const CRUMBS = [
  { name: 'হোম', path: '/bn' },
  { name: 'আমাদের সম্পর্কে', path: '/bn/about' },
];

export default function BanglaAboutPage() {
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(CRUMBS), organizationJsonLd()]} />
      <PageHero
        locale="bn"
        eyebrow="আমাদের সম্পর্কে"
        title="বাংলাদেশকে ঘিরে বানানো ই-কমার্স সফটওয়্যার"
        intro="Ecomesta আছে যাতে বাংলাদেশের ব্যবসাগুলো প্লাগইন, স্প্রেডশিট আর চ্যাট জোড়াতালি না দিয়েই ঠিকঠাক একটি অনলাইন স্টোর চালাতে পারে।"
        crumbs={CRUMBS}
      />
      <Container className="max-w-3xl space-y-12 py-14">
        <FadeUp as="section">
          <h2 className="font-display text-2xl tracking-tight">কেন Ecomesta বানালাম</h2>
          <p className="mt-4 text-lg leading-relaxed text-[var(--color-muted)]">
            অনেক ই-কমার্স টুল আগে অন্য দেশের বাজারের জন্য বানানো। বাংলাদেশে বিক্রির নিজস্ব বাস্তবতা আছে: টাকায় দাম,
            এলাকা অনুযায়ী ডেলিভারি চার্জ, ক্যাশ অন ডেলিভারি পছন্দ করা কাস্টমার আর দেশের পেমেন্ট গেটওয়ে। Ecomesta
            এগুলো পরে যোগ না করে, এগুলো দিয়েই শুরু করে।
          </p>
        </FadeUp>
        <FadeUp as="section">
          <h2 className="font-display text-2xl tracking-tight">আমরা যা গুরুত্ব দিই</h2>
          <CheckList
            className="mt-5"
            items={[
              'নির্ভুলতা — দাম, ছাড় আর ডেলিভারি চার্জ সার্ভারে হিসাব হয়',
              'ভরসা — প্রোভাইডার নিশ্চিত করলে তবেই অনলাইন পেমেন্ট গণ্য হয়',
              'গোপনীয়তা — প্রতিটি স্টোরের তথ্য অন্য স্টোর থেকে আলাদা',
              'সততা — প্রোডাক্ট আজ যা করে তাই বলি, ভবিষ্যতে কী হতে পারে তা নয়',
            ]}
          />
        </FadeUp>
        <FadeUp as="section">
          <h2 className="font-display text-2xl tracking-tight">আমরা এখন কোথায়</h2>
          <p className="mt-4 text-lg leading-relaxed text-[var(--color-muted)]">
            Ecomesta এরই মধ্যে অনলাইন স্টোরের মূল সবকিছু দেয় — ক্যাটালগ, স্টক, অর্ডার, পেমেন্ট, ডেলিভারি জোন,
            কুরিয়ার বুকিং, কুপন, ল্যান্ডিং পেজ, থিম আর নিজের ডোমেইন। প্যাকেজ শুরু মাসে ৳৯৯ থেকে, আর মার্চেন্টদের
            মতামত নিয়ে আমরা প্ল্যাটফর্মকে প্রতিনিয়ত উন্নত করছি।
          </p>
        </FadeUp>
      </Container>
      <CtaSection locale="bn" />
    </>
  );
}
