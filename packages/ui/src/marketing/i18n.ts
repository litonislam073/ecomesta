import { FOOTER_NAV, LEGAL_NAV, PRIMARY_NAV, type NavItem } from './nav';

export type MarketingLocale = 'en' | 'bn';

/** English pages that also have a Bangla version under /bn. */
export const BN_PAGES = ['/', '/pricing'] as const;

const BN_PREFIX = '/bn';

export function hasBanglaVersion(enPath: string): boolean {
  return (BN_PAGES as readonly string[]).includes(enPath);
}

/** `/` → `/bn`, `/pricing` → `/bn/pricing`. */
export function toBanglaPath(enPath: string): string {
  return enPath === '/' ? BN_PREFIX : `${BN_PREFIX}${enPath}`;
}

/** `/bn` → `/`, `/bn/pricing` → `/pricing`; null for paths outside /bn. */
export function toEnglishPath(path: string): string | null {
  if (path === BN_PREFIX || path === `${BN_PREFIX}/`) return '/';
  if (path.startsWith(`${BN_PREFIX}/`)) return path.slice(BN_PREFIX.length);
  return null;
}

/** The same page in the other language, or null when it has no translation. */
export function alternateLanguagePath(pathname: string): { locale: MarketingLocale; href: string } | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  const english = toEnglishPath(path);
  if (english !== null) return hasBanglaVersion(english) ? { locale: 'en', href: english } : null;
  return hasBanglaVersion(path) ? { locale: 'bn', href: toBanglaPath(path) } : null;
}

/** Links a page in the visitor's language when that version exists. */
export function localizedHref(enPath: string, locale: MarketingLocale): string {
  return locale === 'bn' && hasBanglaVersion(enPath) ? toBanglaPath(enPath) : enPath;
}

const BN_LABELS: Record<string, string> = {
  // Primary navigation
  Home: 'হোম',
  Features: 'ফিচার',
  Payments: 'পেমেন্ট',
  Shipping: 'ডেলিভারি',
  Pricing: 'প্যাকেজ ও দাম',
  Solutions: 'সমাধান',
  Resources: 'গাইড',
  // Footer
  'All features': 'সব ফিচার',
  'Online store': 'অনলাইন স্টোর',
  'Product management': 'প্রোডাক্ট ম্যানেজমেন্ট',
  'Inventory management': 'স্টক ম্যানেজমেন্ট',
  'Order management': 'অর্ডার ম্যানেজমেন্ট',
  'Store customization': 'স্টোর ডিজাইন',
  'Custom domain': 'নিজের ডোমেইন',
  'Payment options': 'পেমেন্টের উপায়',
  'Cash on Delivery': 'ক্যাশ অন ডেলিভারি',
  SSLCommerz: 'SSLCommerz',
  'Shipping overview': 'ডেলিভারি সেটআপ',
  'Bangladesh delivery': 'বাংলাদেশে ডেলিভারি',
  'Shipping zones': 'ডেলিভারি জোন',
  'Small businesses': 'ছোট ব্যবসা',
  'Facebook sellers': 'ফেসবুক সেলার',
  'Online businesses': 'অনলাইন ব্যবসা',
  Retailers: 'দোকান ও রিটেইলার',
  'Resource center': 'গাইড ও রিসোর্স',
  Blog: 'ব্লগ',
  FAQ: 'সাধারণ প্রশ্ন',
  'About Ecomesta': 'Ecomesta সম্পর্কে',
  Contact: 'যোগাযোগ',
  'Affiliate program': 'অ্যাফিলিয়েট প্রোগ্রাম',
  'Privacy Policy': 'গোপনীয়তা নীতি',
  'Terms & Conditions': 'শর্তাবলি',
  'Refund Policy': 'রিফান্ড নীতি',
  'Cookie Policy': 'কুকি নীতি',
  // Footer headings
  Product: 'প্রোডাক্ট',
  'Payments & shipping': 'পেমেন্ট ও ডেলিভারি',
  Company: 'কোম্পানি',
};

function translateItem(item: NavItem, locale: MarketingLocale): NavItem {
  if (locale === 'en') return item;
  return { href: localizedHref(item.href, locale), label: BN_LABELS[item.label] ?? item.label };
}

export function primaryNav(locale: MarketingLocale): NavItem[] {
  return PRIMARY_NAV.map((item) => translateItem(item, locale));
}

export function footerNav(locale: MarketingLocale): { heading: string; items: NavItem[] }[] {
  return FOOTER_NAV.map((group) => ({
    heading: locale === 'bn' ? (BN_LABELS[group.heading] ?? group.heading) : group.heading,
    items: group.items.map((item) => translateItem(item, locale)),
  }));
}

export function legalNav(locale: MarketingLocale): NavItem[] {
  return LEGAL_NAV.map((item) => translateItem(item, locale));
}

/** Words the header, footer and menus use. */
export const SHELL_COPY = {
  en: {
    skip: 'Skip to content',
    login: 'Login',
    merchantLogin: 'Merchant login',
    createStore: 'Create Your Store',
    tagline: 'An ecommerce platform for Bangladesh businesses — online store, orders, payments and delivery in one place.',
    call: 'Call',
    phone: 'Phone',
    social: 'Ecomesta on social media',
    /** `{network}` is replaced with Facebook, YouTube… */
    socialLink: 'Ecomesta on {network}',
    rights: 'All rights reserved.',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    primaryLabel: 'Primary',
    footerLabel: 'Footer',
    legalLabel: 'Legal',
    mobileLabel: 'Mobile',
  },
  bn: {
    skip: 'মূল লেখায় যান',
    login: 'লগইন',
    merchantLogin: 'মার্চেন্ট লগইন',
    createStore: 'স্টোর খুলুন',
    tagline: 'বাংলাদেশের ব্যবসার জন্য ই-কমার্স প্ল্যাটফর্ম — অনলাইন স্টোর, অর্ডার, পেমেন্ট আর ডেলিভারি এক জায়গায়।',
    call: 'কল করুন',
    phone: 'ফোন',
    social: 'সোশ্যাল মিডিয়ায় Ecomesta',
    socialLink: '{network}-এ Ecomesta',
    rights: 'সর্বস্বত্ব সংরক্ষিত।',
    openMenu: 'মেনু খুলুন',
    closeMenu: 'মেনু বন্ধ করুন',
    primaryLabel: 'প্রধান মেনু',
    footerLabel: 'ফুটার',
    legalLabel: 'নীতিমালা',
    mobileLabel: 'মোবাইল মেনু',
  },
} as const;

export type ShellCopy = (typeof SHELL_COPY)[MarketingLocale];
