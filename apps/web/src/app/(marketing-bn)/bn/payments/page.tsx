import { HubPageView } from '@/components/marketing/content-page';
import { FadeUp } from '@/components/animations/fade';
import { CheckList, Container, SectionHeader } from '@/components/marketing/ui';
import { pagesForHub } from '@/lib/marketing/content';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/bn/payments',
  locale: 'bn',
  title: 'বাংলাদেশে অনলাইন স্টোরের পেমেন্টের উপায় | Ecomesta',
  description:
    'অনলাইন স্টোরে ক্যাশ অন ডেলিভারি, SSLCommerz আর Stripe পেমেন্ট নিন। Ecomesta-তে পেমেন্টের উপায়, যাচাই আর মার্চেন্টের সেটআপ কীভাবে কাজ করে জানুন।',
});

const OPTIONS = [
  { name: 'ক্যাশ অন ডেলিভারি', who: 'যে কাস্টমাররা হাতে পেয়ে টাকা দিতে চান', setup: 'বাইরের অ্যাকাউন্ট লাগে না; ডেলিভারি পদ্ধতি অনুযায়ী চালু' },
  { name: 'SSLCommerz', who: 'বাংলাদেশে অনলাইন পেমেন্ট', setup: 'আপনার SSLCommerz store ID আর password' },
  { name: 'Stripe', who: 'Stripe Checkout দিয়ে কার্ড পেমেন্ট', setup: 'আপনার Stripe secret key আর webhook secret' },
  { name: 'ব্যাংক ট্রান্সফার / অন্য অফলাইন', who: 'যে পেমেন্ট আপনি নিজে নিশ্চিত করেন', setup: 'পেমেন্ট সেটিং থেকে চালু করুন' },
  { name: 'টেস্ট পেমেন্ট', who: 'ডেভেলপমেন্ট আর স্টেজিং', setup: 'আসল টাকা লেনদেন হয় না' },
];

export default function BanglaPaymentsPage() {
  return (
    <HubPageView
      locale="bn"
      crumbs={[
        { name: 'হোম', path: '/bn' },
        { name: 'পেমেন্ট', path: '/bn/payments' },
      ]}
      eyebrow="পেমেন্ট"
      title="কাস্টমার যেভাবে দিতে চান, সেভাবে পেমেন্ট নিন"
      intro="ক্যাশ অন ডেলিভারি আর অনলাইন পেমেন্ট পাশাপাশি দিন। প্রতিটি স্টোর নিজের পেমেন্ট অ্যাকাউন্ট যুক্ত করে, আর অর্ডার paid হওয়ার আগে প্রতিটি অনলাইন পেমেন্ট প্রোভাইডারের সাথে নিশ্চিত হয়।"
      pages={pagesForHub('payments', 'bn')}
    >
      <section aria-labelledby="payment-options" className="border-t border-[var(--color-border)] bg-white py-16">
        <Container>
          <FadeUp>
            <SectionHeader
              id="payment-options"
              title="এক নজরে পেমেন্টের উপায়"
              description="স্টোর যুক্ত করে চালু করলে তবেই প্রোভাইডার চেকআউটে দেখায়।"
            />
          </FadeUp>
          <FadeUp delay={0.06} className="mt-8 overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-[var(--brand-tint)] text-[var(--color-ink)]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">উপায়</th>
                  <th scope="col" className="px-4 py-3 font-semibold">যাদের জন্য ভালো</th>
                  <th scope="col" className="px-4 py-3 font-semibold">যা লাগবে</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {OPTIONS.map((option) => (
                  <tr key={option.name}>
                    <th scope="row" className="px-4 py-3 font-semibold">{option.name}</th>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{option.who}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{option.setup}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FadeUp>
          <FadeUp className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold">কাস্টমার যা দেখেন</h3>
              <CheckList
                className="mt-4"
                items={[
                  'বাছাই করা ডেলিভারি পদ্ধতিতে যেসব উপায় আছে',
                  'অনলাইন পেমেন্টের জন্য প্রোভাইডারের পেজে যাওয়া',
                  'স্টোরে ফিরে সফল, ব্যর্থ বা বাতিলের পেজ',
                  'পেমেন্ট না হলে আবার দেওয়ার সুযোগ',
                ]}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold">এখনো যা নেই</h3>
              <p className="mt-4 text-[var(--color-muted)]">
                সরাসরি bKash, Nagad বা Rocket সংযোগ নেই, আর গেটওয়ের রিফান্ড নিজে থেকে হয় না। কাস্টমার আপনার
                SSLCommerz অ্যাকাউন্টে চালু থাকা উপায়গুলো ব্যবহার করতে পারেন, আর রিফান্ড প্রোভাইডারের নিজের
                প্যানেল থেকে দেওয়া হয়।
              </p>
            </div>
          </FadeUp>
        </Container>
      </section>
    </HubPageView>
  );
}
