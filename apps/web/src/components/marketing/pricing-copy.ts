import type { MarketingLocale } from '@ecomesta/ui/marketing';
import type { BillingCycleCode } from '@ecomesta/utils';

export interface PricingCardCopy {
  billingPeriod: string;
  plansLabel: string;
  cycleLabel: Record<BillingCycleCode, string>;
  save: (percent: number) => string;
  mostPopular: string;
  suffix: Record<BillingCycleCode, string>;
  billedMonthly: string;
  perMonthSaving: (perMonth: string, percent: number) => string;
  choose: (plan: string) => string;
  howToPay: (amount: string, cycle: BillingCycleCode) => string;
  /** Badge on a plan with a free trial. */
  trialBadge: (days: number) => string;
  /** Under the button of a plan with a free trial. */
  trialOrPay: (days: number, amount: string, cycle: BillingCycleCode) => string;
  /** Plan text that comes from the API in English. */
  translate: (text: string) => string;
}

const EN_WORDS: Record<BillingCycleCode, string> = {
  MONTHLY: 'per month',
  SEMI_ANNUAL: 'every 6 months',
  YEARLY: 'per year',
};

const BN_WORDS: Record<BillingCycleCode, string> = {
  MONTHLY: 'প্রতি মাসের',
  SEMI_ANNUAL: '৬ মাসের',
  YEARLY: '১ বছরের',
};

/** Bangla for the plan names' taglines and features the API sends in English. */
const BN_PLAN_TEXT: Record<string, string> = {
  'For new online businesses': 'নতুন অনলাইন ব্যবসার জন্য',
  'For growing online businesses': 'বাড়তে থাকা অনলাইন ব্যবসার জন্য',
  'For established online businesses': 'প্রতিষ্ঠিত অনলাইন ব্যবসার জন্য',
  'Online store on your own Ecomesta web address': 'Ecomesta-র ঠিকানায় আপনার নিজের অনলাইন স্টোর',
  'Up to 25 products with variants and categories': 'ভ্যারিয়েন্ট আর ক্যাটাগরিসহ ২৫টি পর্যন্ত প্রোডাক্ট',
  '1 GB storage': '১ GB জায়গা',
  'Orders, customers and inventory in one dashboard': 'অর্ডার, কাস্টমার আর স্টক এক ড্যাশবোর্ডে',
  'Cash on Delivery checkout': 'ক্যাশ অন ডেলিভারি চেকআউট',
  'Default storefront theme': 'ডিফল্ট স্টোর থিম',
  'Sales overview for the last 30 days': 'গত ৩০ দিনের বিক্রির হিসাব',
  'Everything in Starter': 'Starter-এর সব কিছু',
  'Up to 100 products': '১০০টি পর্যন্ত প্রোডাক্ট',
  '3 GB storage': '৩ GB জায়গা',
  'Connect your own domain': 'নিজের ডোমেইন যুক্ত করুন',
  'Online payments with SSLCommerz (bKash, Nagad, cards)': 'SSLCommerz দিয়ে অনলাইন পেমেন্ট (bKash, Nagad, কার্ড)',
  'Discount coupons and Bangladesh delivery zones': 'ডিসকাউন্ট কুপন আর বাংলাদেশের ডেলিভারি জোন',
  'All storefront themes': 'সব স্টোর থিম',
  'Facebook Pixel, Google Analytics & Tag Manager': 'Facebook Pixel, Google Analytics ও Tag Manager',
  'Up to 5 landing pages with their own order form': 'অর্ডার ফর্মসহ ৫টি পর্যন্ত ল্যান্ডিং পেজ',
  'Full sales and visitor analytics': 'বিক্রি আর ভিজিটরের পুরো অ্যানালিটিক্স',
  'Everything in Growth': 'Growth-এর সব কিছু',
  'Unlimited products': 'যত খুশি প্রোডাক্ট',
  '5 GB storage': '৫ GB জায়গা',
  'Stripe for international card payments': 'বিদেশি কার্ড পেমেন্টের জন্য Stripe',
  'Priority support': 'অগ্রাধিকার সাপোর্ট',
  'Premium themes included': 'প্রিমিয়াম থিম সাথে',
  'Unlimited landing pages': 'যত খুশি ল্যান্ডিং পেজ',
};

export const PRICING_CARD_COPY: Record<MarketingLocale, PricingCardCopy> = {
  en: {
    billingPeriod: 'Billing period',
    plansLabel: 'Plans',
    cycleLabel: { MONTHLY: 'Monthly', SEMI_ANNUAL: '6 Months', YEARLY: 'Yearly' },
    save: (percent) => `Save ${percent}%`,
    mostPopular: 'Most Popular',
    suffix: { MONTHLY: '/month', SEMI_ANNUAL: '/ 6 months', YEARLY: '/year' },
    billedMonthly: 'Billed monthly',
    perMonthSaving: (perMonth, percent) => `${perMonth}/month · Save ${percent}%`,
    choose: (plan) => `Choose ${plan}`,
    howToPay: (amount, cycle) =>
      `Pay ${amount} ${EN_WORDS[cycle]} with bKash, Nagad, Rocket or Upay when you create your store. It goes live as soon as we confirm the payment.`,
    trialBadge: (days) => `${days}-day free trial`,
    trialOrPay: (days, amount, cycle) =>
      `Start with a ${days}-day free trial — no payment needed, your store goes live at once. Then pay ${amount} ${EN_WORDS[cycle]} with bKash, Nagad, Rocket or Upay.`,
    translate: (text) => text,
  },
  bn: {
    billingPeriod: 'বিলের মেয়াদ',
    plansLabel: 'প্যাকেজ',
    cycleLabel: { MONTHLY: 'মাসিক', SEMI_ANNUAL: '৬ মাস', YEARLY: 'বাৎসরিক' },
    save: (percent) => `${percent}% সাশ্রয়`,
    mostPopular: 'সবচেয়ে জনপ্রিয়',
    suffix: { MONTHLY: '/মাস', SEMI_ANNUAL: '/ ৬ মাস', YEARLY: '/বছর' },
    billedMonthly: 'প্রতি মাসে বিল',
    perMonthSaving: (perMonth, percent) => `মাসে ${perMonth} · ${percent}% সাশ্রয়`,
    choose: (plan) => `${plan} নিন`,
    howToPay: (amount, cycle) =>
      `স্টোর খোলার সময় ${BN_WORDS[cycle]} ${amount} bKash, Nagad, Rocket বা Upay দিয়ে পাঠান। পেমেন্ট নিশ্চিত হলেই স্টোর চালু হয়ে যায়।`,
    trialBadge: (days) => `${days.toLocaleString('bn-BD')} দিনের ফ্রি ট্রায়াল`,
    trialOrPay: (days, amount, cycle) =>
      `${days.toLocaleString('bn-BD')} দিনের ফ্রি ট্রায়াল দিয়ে শুরু করুন — এখন কোনো পেমেন্ট লাগবে না, স্টোর সাথে সাথে চালু হবে। পরে ${BN_WORDS[cycle]} ${amount} bKash, Nagad, Rocket বা Upay দিয়ে দিন।`,
    translate: (text) => BN_PLAN_TEXT[text] ?? text,
  },
};
