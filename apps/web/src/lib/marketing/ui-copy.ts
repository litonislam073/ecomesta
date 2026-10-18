import { localizedHref, type MarketingLocale } from '@ecomesta/ui/marketing';
import type { ContentHub } from '@/lib/marketing/content';

/** Words the shared marketing blocks use, in English and Bangla. */
export const UI_COPY = {
  en: {
    home: 'Home',
    breadcrumb: 'Breadcrumb',
    hubs: { features: 'Features', payments: 'Payments', shipping: 'Shipping', solutions: 'Solutions' } as Record<ContentHub, string>,
    createStore: 'Create Your Store',
    exploreFeatures: 'Explore Features',
    atAGlance: 'At a glance',
    faqHeading: 'Frequently asked questions',
    related: 'Related',
    learnMore: 'Learn more',
    hubPages: (eyebrow: string) => `${eyebrow} pages`,
    ctaTitle: 'Ready to open your online store?',
    ctaDescription: 'Create your store, add products and start taking orders with Cash on Delivery or online payments.',
  },
  bn: {
    home: 'হোম',
    breadcrumb: 'পেজের অবস্থান',
    hubs: { features: 'ফিচার', payments: 'পেমেন্ট', shipping: 'ডেলিভারি', solutions: 'সমাধান' } as Record<ContentHub, string>,
    createStore: 'স্টোর খুলুন',
    exploreFeatures: 'ফিচার দেখুন',
    atAGlance: 'এক নজরে',
    faqHeading: 'সাধারণ প্রশ্ন',
    related: 'আরও দেখুন',
    learnMore: 'আরও জানুন',
    hubPages: (eyebrow: string) => `${eyebrow} — সব পেজ`,
    ctaTitle: 'আজই অনলাইন স্টোর খুলতে চান?',
    ctaDescription: 'স্টোর খুলুন, প্রোডাক্ট যোগ করুন, আর ক্যাশ অন ডেলিভারি বা অনলাইন পেমেন্টে অর্ডার নেওয়া শুরু করুন।',
  },
} as const;

export type UiCopy = (typeof UI_COPY)[MarketingLocale];

/** A marketing path in the visitor's language (`/features` → `/bn/features`). */
export function href(path: string, locale: MarketingLocale): string {
  return localizedHref(path, locale);
}
