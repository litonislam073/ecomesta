import { Flow } from '@/components/marketing/blocks';
import { HubPageView } from '@/components/marketing/content-page';
import { FadeUp } from '@/components/animations/fade';
import { CheckList, Container, SectionHeader } from '@/components/marketing/ui';
import { pagesForHub } from '@/lib/marketing/content';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/bn/shipping',
  locale: 'bn',
  title: 'বাংলাদেশে ই-কমার্স ডেলিভারি আর ডেলিভারি চার্জ | Ecomesta',
  description:
    'সারা বাংলাদেশে অনলাইন স্টোরের ডেলিভারি সেট করুন: বিভাগ, জেলা আর উপজেলা দিয়ে ডেলিভারি জোন, নির্দিষ্ট আর ফ্রি চার্জ, ফ্রি ডেলিভারির সীমা, COD নিয়ম আর কুরিয়ার বুকিং।',
});

export default function BanglaShippingPage() {
  return (
    <HubPageView
      locale="bn"
      crumbs={[
        { name: 'হোম', path: '/bn' },
        { name: 'ডেলিভারি', path: '/bn/shipping' },
      ]}
      eyebrow="ডেলিভারি"
      title="বাংলাদেশকে মাথায় রেখে বানানো ডেলিভারি ব্যবস্থা"
      intro="বাংলাদেশে ডেলিভারির দাম এলাকা অনুযায়ী হয়। Ecomesta-তে পুরো এলাকার তালিকা আছে আর জোন অনুযায়ী ডেলিভারি অপশন ঠিক করা যায়, তাই চেকআউটে প্রতিটি কাস্টমার সঠিক চার্জ দেখেন।"
      pages={pagesForHub('shipping', 'bn')}
    >
      <section aria-labelledby="shipping-flow" className="border-t border-[var(--color-border)] bg-white py-16">
        <Container className="space-y-10">
          <FadeUp>
            <SectionHeader
              id="shipping-flow"
              title="ঠিকানা থেকে ডেলিভারি চার্জ"
              description="কাস্টমারের ঠিকানা একটি জোন বাছে, জোন ডেলিভারি পদ্ধতি দেখায়, আর বাছাই করা পদ্ধতি চার্জ ঠিক করে — সবকিছু সার্ভারে হিসাব হয়।"
            />
          </FadeUp>
          <FadeUp delay={0.06}>
            <Flow label="ডেলিভারি চার্জের হিসাব" steps={['বিভাগ', 'জেলা', 'উপজেলা', 'ডেলিভারি জোন', 'ডেলিভারি পদ্ধতি', 'ডেলিভারি চার্জ']} />
          </FadeUp>
          <FadeUp className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold">যা যা আছে</h3>
              <CheckList
                className="mt-4"
                items={[
                  '৮টি বিভাগ, ৬৪টি জেলা আর ৫৫২টি উপজেলা ও থানা',
                  'অগ্রাধিকারসহ জোন আর পুরো স্টোরের বিকল্প পদ্ধতি',
                  'নির্দিষ্ট চার্জ আর ফ্রি ডেলিভারি পদ্ধতি',
                  'ফ্রি ডেলিভারির সীমা',
                  'পদ্ধতি অনুযায়ী ক্যাশ অন ডেলিভারি',
                  'অর্ডারে ডেলিভারির তথ্য সংরক্ষিত',
                  'অবস্থা আর ট্র্যাকিং নম্বরসহ শিপমেন্ট',
                ]}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold">কুরিয়ার</h3>
              <p className="mt-4 text-[var(--color-muted)]">
                Steadfast, Pathao, RedX, Paperfly আর eCourier যুক্ত: Settings → Couriers-এ কুরিয়ার অ্যাকাউন্টের API
                তথ্য দিন, তারপর অর্ডার থেকেই পার্সেল বুক করুন আর ডেলিভারির অবস্থা দেখুন। অন্য কুরিয়ারে আগের মতো
                বুক করে অর্ডারের শিপমেন্টে ট্র্যাকিং নম্বর দিন — কাস্টমার অর্ডার ট্র্যাকিং পেজে দেখতে পান।
              </p>
            </div>
          </FadeUp>
        </Container>
      </section>
    </HubPageView>
  );
}
