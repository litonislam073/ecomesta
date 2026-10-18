import { ContactLine, InlineLink, LegalPage, List, P, type LegalSection } from '@/components/marketing/legal-page';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/bn/cookie-policy',
  locale: 'bn',
  title: 'কুকি নীতি — Ecomesta',
  description: 'Ecomesta-র ওয়েবসাইট, মার্চেন্ট ড্যাশবোর্ড আর অনলাইন স্টোরে যেসব কুকি আর এ ধরনের প্রযুক্তি ব্যবহার হয়, আর কীভাবে নিয়ন্ত্রণ করবেন।',
});

const COOKIES = [
  {
    name: 'ecomesta_refresh_token',
    purpose: 'মার্চেন্ট ড্যাশবোর্ডে নিরাপদে লগইন রাখে (HttpOnly, স্ক্রিপ্ট পড়তে পারে না)।',
    essential: true,
  },
  {
    name: 'ecomesta.storeSlug, ecomesta.canonicalHost',
    purpose: 'পেজটি কোন স্টোরের তা মনে রাখে, যাতে সঠিক স্টোর দেখায়।',
    essential: true,
  },
  { name: 'কার্ট (ব্রাউজার স্টোরেজ)', purpose: 'স্টোরে কাস্টমারের কার্টের আইটেম মনে রাখে।', essential: true },
  {
    name: 'Google Tag Manager / Google Analytics (_ga, _ga_*)',
    purpose: 'ভিজিট গোনে আর ecomesta.com কীভাবে ব্যবহার হয় দেখায়। শুধু আমাদের ওয়েবসাইটে, মার্চেন্টদের স্টোরে কখনো নয়।',
    essential: false,
  },
];

const SECTIONS: LegalSection[] = [
  {
    id: 'what-are-cookies',
    title: 'কুকি কী',
    content: (
      <P>
        কুকি হলো ছোট টেক্সট ফাইল, যা ওয়েবসাইট আপনার ব্রাউজারে সেভ করে। ব্রাউজারের লোকাল স্টোরেজের মতো প্রযুক্তিও একইভাবে কাজ
        করে। এগুলো দিয়ে সাইট এক পেজ থেকে আরেক পেজে আর বারবার ভিজিটে আপনাকে মনে রাখে।
      </P>
    ),
  },
  {
    id: 'cookies-we-use',
    title: 'যেসব কুকি ব্যবহার করি',
    content: (
      <>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-[var(--brand-tint)] text-[var(--color-ink)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">নাম</th>
                <th scope="col" className="px-4 py-3 font-semibold">উদ্দেশ্য</th>
                <th scope="col" className="px-4 py-3 font-semibold">ধরন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-muted)]">
              {COOKIES.map((cookie) => (
                <tr key={cookie.name}>
                  <td className="px-4 py-3 align-top font-medium text-[var(--color-ink)]">{cookie.name}</td>
                  <td className="px-4 py-3 align-top leading-relaxed">{cookie.purpose}</td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        cookie.essential
                          ? 'bg-[var(--brand-green-tint)] text-[var(--brand-green-text)]'
                          : 'bg-[var(--brand-tint-strong)] text-[var(--color-accent)]'
                      }`}
                    >
                      {cookie.essential ? 'অপরিহার্য' : 'অ্যানালিটিক্স'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          <strong className="text-[var(--color-ink)]">অপরিহার্য</strong> কুকি লগইন, স্টোর আর কার্ট চালানোর জন্য দরকার, তাই বন্ধ করা
          যায় না। <strong className="text-[var(--color-ink)]">অ্যানালিটিক্স</strong> কুকি আমাদের ওয়েবসাইট উন্নত করতে সাহায্য করে।
        </P>
      </>
    ),
  },
  {
    id: 'third-parties',
    title: 'অন্য প্রতিষ্ঠানের কুকি',
    content: (
      <>
        <P>কিছু ফিচারে অন্য প্রতিষ্ঠানের সেবা ব্যবহার হয়, যারা নিজস্ব কুকি বসাতে পারে:</P>
        <List
          items={[
            'Google — Google সাইন-ইন, Google Tag Manager আর Google Analytics।',
            'Cloudflare — সাইটকে অপব্যবহার থেকে রক্ষার জন্য নিরাপত্তা আর পারফরম্যান্স কুকি।',
            'পেমেন্ট প্রোভাইডার — যেমন SSLCommerz বা Stripe, স্টোরে অনলাইন চেকআউটের সময়।',
          ]}
        />
        <P>এই প্রতিষ্ঠানগুলো সেই তথ্য তাদের নিজস্ব গোপনীয়তা নীতি অনুযায়ী ব্যবহার করে।</P>
      </>
    ),
  },
  {
    id: 'merchant-stores',
    title: 'মার্চেন্টদের স্টোরে কুকি',
    content: (
      <P>
        Ecomesta-র অনলাইন স্টোরগুলো ওপরের অপরিহার্য কুকি ব্যবহার করে। মার্চেন্ট চাইলে নিজের স্টোরে নিজস্ব টুল যোগ করতে পারেন;
        সেগুলোর দায় মার্চেন্টের, আর সেগুলো স্টোরের নিজস্ব নীতিমালার আওতায়।
      </P>
    ),
  },
  {
    id: 'control',
    title: 'কুকি যেভাবে নিয়ন্ত্রণ করবেন',
    content: (
      <P>
        ব্রাউজারের সেটিং থেকে কুকি আটকাতে বা মুছতে পারেন। অপরিহার্য কুকি আটকালে লগইন বা কার্ট ব্যবহার করতে পারবেন না। যেকোনো
        ওয়েবসাইটে Google Analytics বন্ধ করতে Google-এর অপ্ট-আউট ব্রাউজার অ্যাড-অন ব্যবহার করতে পারেন।
      </P>
    ),
  },
  {
    id: 'more',
    title: 'আরও তথ্য',
    content: (
      <P>
        ব্যক্তিগত তথ্য আমরা সাধারণভাবে কীভাবে ব্যবহার করি তা জানতে আমাদের <InlineLink href="/bn/privacy-policy">গোপনীয়তা নীতি</InlineLink>{' '}
        পড়ুন। প্রশ্ন থাকলে <ContactLine locale="bn" />।
      </P>
    ),
  },
];

export default function BanglaCookiePolicyPage() {
  return (
    <LegalPage
      locale="bn"
      path="/bn/cookie-policy"
      title="কুকি নীতি"
      intro="Ecomesta যেসব কুকি আর এ ধরনের প্রযুক্তি ব্যবহার করে, কেন করে আর আপনি কীভাবে নিয়ন্ত্রণ করবেন।"
      sections={SECTIONS}
    />
  );
}
