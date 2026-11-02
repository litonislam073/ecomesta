import type { ReactNode } from 'react';
import type { MarketingLocale } from '@ecomesta/ui/marketing';
import { ALL_FAQS } from '@/lib/marketing/content/faq';
import { SOLUTION_PAGES } from '@/lib/marketing/content';
import type { Faq } from '@/lib/marketing/seo';
import { AnimatedNumber } from '../animations/animated-number';
import type { IconName } from './icons';

type Link = { href: string; label: string };

export interface HomeCopy {
  hero: {
    badge: string;
    title: string;
    intro: string;
    primary: string;
    secondary: string;
    /** Price and payment facts shown right under the buttons. */
    offer: string[];
    points: string[];
  };
  manage: { heading: string; items: { icon: IconName; label: string; href: string }[] };
  features: {
    eyebrow: string;
    title: string;
    description: string;
    items: { icon: IconName; title: string; body: string; points: string[]; href: string; linkLabel: string }[];
  };
  payments: {
    eyebrow: string;
    title: string;
    description: string;
    items: { icon: IconName; title: string; body: string; href: string }[];
    note: string;
  };
  shipping: {
    eyebrow: string;
    title: string;
    description: ReactNode;
    points: string[];
    links: Link[];
    chartTitle: string;
    chartSteps: string[];
  };
  builder: {
    eyebrow: string;
    title: string;
    description: string;
    flowLabel: string;
    flowSteps: string[];
    groups: { title: string; items: string[] }[];
    link: Link;
  };
  solutions: { eyebrow: string; title: string; items: { slug: string; name: string; summary: string }[] };
  faq: { eyebrow: string; title: string; intro: string; links: Link[]; items: Faq[] };
  /** Undefined keeps the English call-to-action band. */
  cta?: { title: string; description: string; primary: string; secondary: string };
}

const HOME_FAQ_QUESTIONS = [
  'What is Ecomesta?',
  'Does Ecomesta support Cash on Delivery?',
  'Can I use my own domain?',
  'Can I book Steadfast courier from Ecomesta?',
  'Can I add Facebook Pixel or Google Analytics?',
  'Do customers need an account?',
];

const EN: HomeCopy = {
  hero: {
    badge: 'Ecommerce website builder for Bangladesh',
    title: 'Build Your Online Store. Sell More. Manage Everything in One Place.',
    intro:
      'Get your ecommerce website in Bangladesh from ৳99 a month. Products, orders, Cash on Delivery, online payments through SSLCommerz, courier booking and themes — all from one platform.',
    primary: 'Create Your Store',
    secondary: 'Explore Features',
    offer: ['Plans from ৳99/month', 'Pay with bKash, Nagad, Rocket or Upay', 'No fee on your sales'],
    points: ['Cash on Delivery', 'Online payments via SSLCommerz', 'Steadfast, Pathao & RedX booking', 'Live theme editor'],
  },
  manage: {
    heading: 'Manage your whole store from one platform',
    items: [
      { icon: 'store', label: 'Online Store', href: '/features/online-store' },
      { icon: 'box', label: 'Products', href: '/features/product-management' },
      { icon: 'layers', label: 'Inventory', href: '/features/inventory-management' },
      { icon: 'receipt', label: 'Orders', href: '/features/order-management' },
      { icon: 'card', label: 'Payments', href: '/payments' },
      { icon: 'truck', label: 'Shipping', href: '/shipping' },
      { icon: 'users', label: 'Customers', href: '/features/customer-management' },
      { icon: 'tag', label: 'Coupons', href: '/features/coupons' },
      { icon: 'chart', label: 'Tracking', href: '/features/marketing-tracking' },
      { icon: 'megaphone', label: 'Landing pages', href: '/features/landing-pages' },
      { icon: 'palette', label: 'Themes', href: '/features/store-customization' },
    ],
  },
  features: {
    eyebrow: 'Features',
    title: 'Everything you need to sell online',
    description:
      'The tools a Bangladesh online store uses every day — connected, so stock, payments and delivery charges stay consistent.',
    items: [
      {
        icon: 'store',
        title: 'Store Builder',
        body: 'Create a professional online store and customize the storefront.',
        points: ['Cart, guest checkout and order tracking', 'Free platform subdomain'],
        href: '/features/online-store',
        linkLabel: 'How the online store works',
      },
      {
        icon: 'box',
        title: 'Product Management',
        body: 'Manage products, categories, variants and inventory.',
        points: ['Variants with their own price and stock', 'Product and category images'],
        href: '/features/product-management',
        linkLabel: 'Explore product management',
      },
      {
        icon: 'receipt',
        title: 'Order Management',
        body: 'Track orders from pending through fulfillment.',
        points: ['Order, payment and fulfillment status', 'Book courier parcels from the order'],
        href: '/features/order-management',
        linkLabel: 'See how orders flow',
      },
      {
        icon: 'users',
        title: 'Customer Management',
        body: 'Manage customer records and addresses.',
        points: ['Multiple addresses per customer', 'Private to your store'],
        href: '/features/customer-management',
        linkLabel: 'About customer records',
      },
      {
        icon: 'card',
        title: 'Payments',
        body: 'Cash on Delivery on every plan; SSLCommerz on Growth and Business; Stripe on Business.',
        points: ['Providers connected per store', 'Payments verified on the server'],
        href: '/payments',
        linkLabel: 'Compare payment options',
      },
      {
        icon: 'truck',
        title: 'Bangladesh Shipping',
        body: 'Divisions, districts and upazilas with zone-based rates.',
        points: ['Free-shipping thresholds', 'COD allowed per delivery method'],
        href: '/shipping',
        linkLabel: 'Plan your delivery zones',
      },
      {
        icon: 'route',
        title: 'Courier Booking',
        body: 'Connect Steadfast, Pathao, RedX, Paperfly or eCourier and book parcels without leaving Ecomesta.',
        points: ['Address, phone and COD amount sent for you', 'Delivery status refreshed from the order'],
        href: '/shipping/bangladesh',
        linkLabel: 'How courier booking works',
      },
      {
        icon: 'tag',
        title: 'Coupons',
        body: 'Percentage and fixed discounts with rules you control.',
        points: ['Usage and per-customer limits', 'Minimum order value and validity dates'],
        href: '/features/coupons',
        linkLabel: 'Set up coupon codes',
      },
      {
        icon: 'chart',
        title: 'Marketing & Tracking',
        body: 'Facebook Pixel, Google Tag Manager, Google Analytics 4 and Search Console.',
        points: ['Paste an ID — no code', 'Add to cart and purchase events sent for you'],
        href: '/features/marketing-tracking',
        linkLabel: 'Measure your ads',
      },
      {
        icon: 'megaphone',
        title: 'Landing Pages',
        body: 'One-page offers for your Facebook and Google ads, from 10 ready designs, with an order form on the page.',
        points: ['Single product, festival sale, fashion, gadgets, beauty and more', 'Growth: 5 pages · Business: unlimited'],
        href: '/features/landing-pages',
        linkLabel: 'Build a landing page',
      },
      {
        icon: 'palette',
        title: 'Themes & Live Editor',
        body: 'Default, Minimal and premium themes like ShopEase and Kenakata, customized in a live editor.',
        points: ['Add, hide and reorder homepage sections', 'Desktop, tablet and mobile preview'],
        href: '/features/store-customization',
        linkLabel: 'Customize your storefront',
      },
      {
        icon: 'image',
        title: 'Image Gallery',
        body: 'Upload photos once and reuse them for products, categories, banners and your logo.',
        points: ['JPEG, PNG or WebP uploads', '1–5 GB storage by plan'],
        href: '/features/product-management',
        linkLabel: 'Manage your catalog',
      },
      {
        icon: 'globe',
        title: 'Custom Domains',
        body: 'Connect a domain you own to your store.',
        points: ['DNS TXT verification', 'Primary domain for search engines'],
        href: '/features/custom-domain',
        linkLabel: 'Connect your domain',
      },
    ],
  },
  payments: {
    eyebrow: 'Payments',
    title: 'Accept Payments Your Customers Prefer',
    description:
      'Offer Cash on Delivery and online payments side by side. Each store connects the providers it wants with its own merchant accounts.',
    items: [
      {
        icon: 'cash',
        title: 'Cash on Delivery',
        body: 'Customers pay when the order is delivered. Allow or block COD for each delivery method.',
        href: '/payments/cash-on-delivery',
      },
      {
        icon: 'shield',
        title: 'Online payments via SSLCommerz',
        body: 'Customers pay online on the SSLCommerz page, where the methods turned on in your SSLCommerz account (such as bKash, Nagad or cards) appear (Growth and Business plans). Every payment is verified before the order is marked paid.',
        href: '/payments/sslcommerz',
      },
      {
        icon: 'card',
        title: 'Stripe',
        body: 'Hosted Stripe Checkout for international card payments on the Business plan, when you have a supported Stripe account.',
        href: '/payments/online-payments',
      },
      {
        icon: 'bank',
        title: 'Offline options',
        body: 'Optionally offer bank transfer or another offline method with your own instructions, and mark the payment once you receive it.',
        href: '/payments/cash-on-delivery',
      },
    ],
    note:
      'Your own plan is paid in taka with bKash, Nagad, Rocket or Upay, from ৳99 a month, and Ecomesta takes no fee on your sales. Customer bKash and Nagad run through your SSLCommerz account on Growth and Business — not a direct bKash or Nagad connection.',
  },
  shipping: {
    eyebrow: 'Bangladesh shipping',
    title: 'Delivery charges that follow real delivery areas',
    description: (
      <>
        All <AnimatedNumber value={8} duration={0.8} /> divisions, <AnimatedNumber value={64} /> districts and{' '}
        <AnimatedNumber value={552} /> upazilas are built in. Group them into zones, add delivery methods and let
        checkout calculate the right charge.
      </>
    ),
    points: [
      'Zone-based flat or free delivery',
      'Free-shipping thresholds per method',
      'Cash on Delivery allowed or blocked per method',
      'Shipping details saved on every order',
      'Courier parcels booked straight from the order',
    ],
    links: [
      { href: '/shipping/bangladesh', label: 'Bangladesh delivery setup' },
      { href: '/shipping/zones', label: 'Zones and rates' },
    ],
    chartTitle: 'How a delivery charge is chosen',
    chartSteps: ['Division', 'District', 'Upazila', 'Shipping zone', 'Shipping method', 'Shipping rate'],
  },
  builder: {
    eyebrow: 'Store builder',
    title: 'Launch your online store without building everything from scratch',
    description: 'Set up your brand, catalog, payments and delivery in the dashboard — no code, servers or plugins to manage.',
    flowLabel: 'Steps to launch a store',
    flowSteps: ['Create Store', 'Customize', 'Add Products', 'Configure Payments', 'Configure Shipping', 'Start Selling'],
    groups: [
      { title: 'Brand', items: ['Logo and favicon uploads', 'Brand colours', 'Typography', 'Announcement bar'] },
      {
        title: 'Layout',
        items: [
          'Hero, categories with images and featured products',
          'Deal of the day, rich text and image banners',
          'Show, hide and reorder sections',
          'Footer and social links',
        ],
      },
      { title: 'Reach', items: ['SEO title and description', 'Facebook Pixel and Google Analytics', 'Free subdomain', 'Custom domain'] },
    ],
    link: { href: '/features/store-customization', label: 'See every storefront setting' },
  },
  solutions: {
    eyebrow: 'Solutions',
    title: 'Built for how Bangladesh businesses sell',
    items: SOLUTION_PAGES.map((page) => ({ slug: page.slug, name: page.name, summary: page.summary })),
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions before you start',
    intro: 'Straight answers about what Ecomesta does today.',
    links: [
      { href: '/faq', label: 'Read all FAQs' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/blog', label: 'Blog' },
      { href: '/contact', label: 'Contact' },
    ],
    items: ALL_FAQS.filter((faq) => HOME_FAQ_QUESTIONS.includes(faq.question)),
  },
};

const BN: HomeCopy = {
  hero: {
    badge: 'বাংলাদেশে ই-কমার্স ওয়েবসাইট বানানোর প্ল্যাটফর্ম',
    title: 'নিজের অনলাইন স্টোর খুলুন। বেশি বিক্রি করুন। সব কিছু এক জায়গা থেকে চালান।',
    intro:
      'মাসে মাত্র ৳৯৯ থেকে নিজের ই-কমার্স ওয়েবসাইট চালু করুন। প্রোডাক্ট, অর্ডার, ক্যাশ অন ডেলিভারি, SSLCommerz দিয়ে অনলাইন পেমেন্ট, কুরিয়ার বুকিং আর থিম — সব এক প্ল্যাটফর্মে।',
    primary: 'স্টোর খুলুন',
    secondary: 'ফিচারগুলো দেখুন',
    offer: ['মাসে ৳৯৯ থেকে প্যাকেজ', 'bKash, Nagad, Rocket বা Upay দিয়ে পেমেন্ট', 'বিক্রিতে কোনো ফি নেই'],
    points: ['ক্যাশ অন ডেলিভারি', 'SSLCommerz দিয়ে অনলাইন পেমেন্ট', 'Steadfast, Pathao ও RedX বুকিং', 'লাইভ থিম এডিটর'],
  },
  manage: {
    heading: 'পুরো স্টোর চালান এক প্ল্যাটফর্ম থেকে',
    items: [
      { icon: 'store', label: 'অনলাইন স্টোর', href: '/features/online-store' },
      { icon: 'box', label: 'প্রোডাক্ট', href: '/features/product-management' },
      { icon: 'layers', label: 'স্টক', href: '/features/inventory-management' },
      { icon: 'receipt', label: 'অর্ডার', href: '/features/order-management' },
      { icon: 'card', label: 'পেমেন্ট', href: '/payments' },
      { icon: 'truck', label: 'ডেলিভারি', href: '/shipping' },
      { icon: 'users', label: 'কাস্টমার', href: '/features/customer-management' },
      { icon: 'tag', label: 'কুপন', href: '/features/coupons' },
      { icon: 'chart', label: 'ট্র্যাকিং', href: '/features/marketing-tracking' },
      { icon: 'megaphone', label: 'ল্যান্ডিং পেজ', href: '/features/landing-pages' },
      { icon: 'palette', label: 'থিম', href: '/features/store-customization' },
    ],
  },
  features: {
    eyebrow: 'ফিচার',
    title: 'অনলাইনে বিক্রির জন্য যা যা লাগে, সব আছে',
    description:
      'বাংলাদেশের অনলাইন স্টোর প্রতিদিন যে কাজগুলো করে, তার সব টুল একসাথে জোড়া — তাই স্টক, পেমেন্ট আর ডেলিভারি চার্জে কখনো গরমিল হয় না।',
    items: [
      {
        icon: 'store',
        title: 'স্টোর বিল্ডার',
        body: 'প্রফেশনাল অনলাইন স্টোর বানান, নিজের মতো করে সাজান।',
        points: ['কার্ট, অ্যাকাউন্ট ছাড়াই চেকআউট আর অর্ডার ট্র্যাকিং', 'ফ্রি সাবডোমেইন'],
        href: '/features/online-store',
        linkLabel: 'অনলাইন স্টোর কীভাবে কাজ করে',
      },
      {
        icon: 'box',
        title: 'প্রোডাক্ট ম্যানেজমেন্ট',
        body: 'প্রোডাক্ট, ক্যাটাগরি, ভ্যারিয়েন্ট আর স্টক এক জায়গায় সামলান।',
        points: ['প্রতিটি ভ্যারিয়েন্টের আলাদা দাম ও স্টক', 'প্রোডাক্ট ও ক্যাটাগরির ছবি'],
        href: '/features/product-management',
        linkLabel: 'প্রোডাক্ট ম্যানেজমেন্ট দেখুন',
      },
      {
        icon: 'receipt',
        title: 'অর্ডার ম্যানেজমেন্ট',
        body: 'অর্ডার আসা থেকে ডেলিভারি পর্যন্ত প্রতিটি ধাপ দেখুন।',
        points: ['অর্ডার, পেমেন্ট আর ডেলিভারির স্ট্যাটাস', 'অর্ডার থেকেই কুরিয়ার পার্সেল বুক'],
        href: '/features/order-management',
        linkLabel: 'অর্ডার কীভাবে এগোয় দেখুন',
      },
      {
        icon: 'users',
        title: 'কাস্টমার ম্যানেজমেন্ট',
        body: 'কাস্টমারের তথ্য আর ঠিকানা গুছিয়ে রাখুন।',
        points: ['একজন কাস্টমারের একাধিক ঠিকানা', 'তথ্য শুধু আপনার স্টোরেই থাকে'],
        href: '/features/customer-management',
        linkLabel: 'কাস্টমারের তথ্য সম্পর্কে',
      },
      {
        icon: 'card',
        title: 'পেমেন্ট',
        body: 'সব প্যাকেজে ক্যাশ অন ডেলিভারি; Growth ও Business-এ SSLCommerz; Business-এ Stripe।',
        points: ['প্রতিটি স্টোর নিজের পেমেন্ট অ্যাকাউন্ট যুক্ত করে', 'সার্ভারে যাচাই করা পেমেন্ট'],
        href: '/payments',
        linkLabel: 'পেমেন্টের উপায়গুলো তুলনা করুন',
      },
      {
        icon: 'truck',
        title: 'বাংলাদেশে ডেলিভারি',
        body: 'বিভাগ, জেলা আর উপজেলা ধরে জোনভিত্তিক ডেলিভারি চার্জ।',
        points: ['নির্দিষ্ট টাকার অর্ডারে ফ্রি ডেলিভারি', 'ডেলিভারির ধরন অনুযায়ী COD চালু বা বন্ধ'],
        href: '/shipping',
        linkLabel: 'ডেলিভারি জোন সাজান',
      },
      {
        icon: 'route',
        title: 'কুরিয়ার বুকিং',
        body: 'Steadfast, Pathao, RedX, Paperfly বা eCourier যুক্ত করে Ecomesta থেকেই পার্সেল বুক করুন।',
        points: ['ঠিকানা, ফোন আর COD-র টাকা নিজে থেকেই চলে যায়', 'অর্ডার থেকেই ডেলিভারির স্ট্যাটাস আপডেট'],
        href: '/shipping/bangladesh',
        linkLabel: 'কুরিয়ার বুকিং কীভাবে হয়',
      },
      {
        icon: 'tag',
        title: 'কুপন',
        body: 'শতাংশ বা নির্দিষ্ট টাকার ছাড়, নিয়ম আপনার হাতে।',
        points: ['মোট ব্যবহার আর কাস্টমারপ্রতি সীমা', 'সর্বনিম্ন অর্ডার আর মেয়াদ'],
        href: '/features/coupons',
        linkLabel: 'কুপন কোড বানান',
      },
      {
        icon: 'chart',
        title: 'মার্কেটিং ও ট্র্যাকিং',
        body: 'Facebook Pixel, Google Tag Manager, Google Analytics 4 আর Search Console।',
        points: ['শুধু ID বসান — কোড লাগবে না', 'Add to cart আর purchase ইভেন্ট নিজে থেকেই যায়'],
        href: '/features/marketing-tracking',
        linkLabel: 'বিজ্ঞাপনের ফল মাপুন',
      },
      {
        icon: 'megaphone',
        title: 'ল্যান্ডিং পেজ',
        body: 'ফেসবুক আর গুগল বিজ্ঞাপনের জন্য এক পেজের অফার, ১০টি তৈরি ডিজাইন থেকে, পেজেই অর্ডার ফর্ম।',
        points: ['সিঙ্গেল প্রোডাক্ট, ঈদ সেল, ফ্যাশন, গ্যাজেট, বিউটি ও আরও', 'Growth: ৫টি পেজ · Business: যত খুশি'],
        href: '/features/landing-pages',
        linkLabel: 'ল্যান্ডিং পেজ বানান',
      },
      {
        icon: 'palette',
        title: 'থিম ও লাইভ এডিটর',
        body: 'Default, Minimal আর ShopEase, Kenakata-র মতো প্রিমিয়াম থিম, লাইভ এডিটরে সাজান।',
        points: ['হোমপেজের সেকশন যোগ, লুকানো আর আগে-পরে করা', 'ডেস্কটপ, ট্যাবলেট আর মোবাইল প্রিভিউ'],
        href: '/features/store-customization',
        linkLabel: 'স্টোর সাজান',
      },
      {
        icon: 'image',
        title: 'ছবির গ্যালারি',
        body: 'ছবি একবার আপলোড করে প্রোডাক্ট, ক্যাটাগরি, ব্যানার আর লোগোতে বারবার ব্যবহার করুন।',
        points: ['JPEG, PNG বা WebP আপলোড', 'প্যাকেজ অনুযায়ী ১–৫ GB জায়গা'],
        href: '/features/product-management',
        linkLabel: 'ক্যাটালগ সামলান',
      },
      {
        icon: 'globe',
        title: 'নিজের ডোমেইন',
        body: 'আপনার কেনা ডোমেইন স্টোরের সাথে যুক্ত করুন।',
        points: ['DNS TXT দিয়ে যাচাই', 'সার্চ ইঞ্জিনের জন্য প্রধান ডোমেইন'],
        href: '/features/custom-domain',
        linkLabel: 'ডোমেইন যুক্ত করুন',
      },
    ],
  },
  payments: {
    eyebrow: 'পেমেন্ট',
    title: 'কাস্টমার যেভাবে দিতে চায়, সেভাবেই টাকা নিন',
    description:
      'ক্যাশ অন ডেলিভারি আর অনলাইন পেমেন্ট — দুটোই একসাথে চালু রাখুন। প্রতিটি স্টোর নিজের মার্চেন্ট অ্যাকাউন্ট দিয়ে পছন্দের পেমেন্ট সার্ভিস যুক্ত করে।',
    items: [
      {
        icon: 'cash',
        title: 'ক্যাশ অন ডেলিভারি',
        body: 'অর্ডার হাতে পেয়ে কাস্টমার টাকা দেয়। ডেলিভারির ধরন অনুযায়ী COD চালু বা বন্ধ রাখুন।',
        href: '/payments/cash-on-delivery',
      },
      {
        icon: 'shield',
        title: 'SSLCommerz দিয়ে অনলাইন পেমেন্ট',
        body: 'কাস্টমার SSLCommerz-এর পেজে অনলাইনে টাকা দেন; আপনার SSLCommerz অ্যাকাউন্টে চালু থাকা উপায় (যেমন bKash, Nagad বা কার্ড) সেখানে দেখায় (Growth আর Business প্যাকেজে)। প্রতিটি পেমেন্ট যাচাই করার পরই অর্ডার "পেইড" হয়।',
        href: '/payments/sslcommerz',
      },
      {
        icon: 'card',
        title: 'Stripe',
        body: 'Business প্যাকেজে, সমর্থিত Stripe অ্যাকাউন্ট থাকলে Stripe Checkout দিয়ে আন্তর্জাতিক কার্ড পেমেন্ট নিন।',
        href: '/payments/online-payments',
      },
      {
        icon: 'bank',
        title: 'অফলাইন উপায়',
        body: 'ঐচ্ছিকভাবে নিজের নির্দেশনা দিয়ে ব্যাংক ট্রান্সফার বা অন্য অফলাইন উপায় রাখুন, টাকা পেলে পেমেন্ট মার্ক করুন।',
        href: '/payments/cash-on-delivery',
      },
    ],
    note:
      'আপনার নিজের প্যাকেজের টাকা মাসে ৳৯৯ থেকে, bKash, Nagad, Rocket বা Upay দিয়ে টাকায় দেন, আর Ecomesta আপনার বিক্রি থেকে কোনো ফি নেয় না। কাস্টমারের bKash আর Nagad Growth ও Business-এ আপনার SSLCommerz অ্যাকাউন্ট দিয়ে চলে — সরাসরি bKash বা Nagad সংযোগ নয়।',
  },
  shipping: {
    eyebrow: 'বাংলাদেশে ডেলিভারি',
    title: 'আসল ডেলিভারি এলাকা ধরে ডেলিভারি চার্জ',
    description:
      'দেশের ৮টি বিভাগ, ৬৪টি জেলা আর ৫৫২টি উপজেলা আগে থেকেই দেওয়া আছে। এগুলো দিয়ে জোন বানান, ডেলিভারির ধরন যোগ করুন — চেকআউটে ঠিক চার্জটা নিজে থেকেই হিসাব হবে।',
    points: [
      'জোন অনুযায়ী নির্দিষ্ট বা ফ্রি ডেলিভারি',
      'ডেলিভারির ধরন অনুযায়ী ফ্রি ডেলিভারির সীমা',
      'ডেলিভারির ধরন অনুযায়ী ক্যাশ অন ডেলিভারি চালু বা বন্ধ',
      'প্রতিটি অর্ডারে ডেলিভারির তথ্য সংরক্ষিত',
      'অর্ডার থেকেই কুরিয়ার পার্সেল বুক',
    ],
    links: [
      { href: '/shipping/bangladesh', label: 'বাংলাদেশে ডেলিভারি সেটআপ' },
      { href: '/shipping/zones', label: 'জোন আর চার্জ' },
    ],
    chartTitle: 'ডেলিভারি চার্জ যেভাবে ঠিক হয়',
    chartSteps: ['বিভাগ', 'জেলা', 'উপজেলা', 'ডেলিভারি জোন', 'ডেলিভারির ধরন', 'ডেলিভারি চার্জ'],
  },
  builder: {
    eyebrow: 'স্টোর বিল্ডার',
    title: 'শূন্য থেকে সব বানাতে হবে না — আজই স্টোর চালু করুন',
    description: 'ব্র্যান্ড, প্রোডাক্ট, পেমেন্ট আর ডেলিভারি সব ড্যাশবোর্ড থেকে সেট করুন — কোড, সার্ভার বা প্লাগইনের ঝামেলা নেই।',
    flowLabel: 'স্টোর চালুর ধাপ',
    flowSteps: ['স্টোর খুলুন', 'সাজান', 'প্রোডাক্ট যোগ করুন', 'পেমেন্ট সেট করুন', 'ডেলিভারি সেট করুন', 'বিক্রি শুরু করুন'],
    groups: [
      { title: 'ব্র্যান্ড', items: ['লোগো আর ফেভিকন আপলোড', 'ব্র্যান্ডের রং', 'ফন্ট', 'ঘোষণা বার'] },
      {
        title: 'লেআউট',
        items: [
          'হিরো ব্যানার, ছবিসহ ক্যাটাগরি আর বাছাই করা প্রোডাক্ট',
          'আজকের ডিল, লেখা আর ছবির ব্যানার',
          'সেকশন দেখানো, লুকানো আর আগে-পরে করা',
          'ফুটার আর সোশ্যাল লিংক',
        ],
      },
      { title: 'প্রচার', items: ['SEO টাইটেল আর বিবরণ', 'Facebook Pixel আর Google Analytics', 'ফ্রি সাবডোমেইন', 'নিজের ডোমেইন'] },
    ],
    link: { href: '/features/store-customization', label: 'স্টোরের সব সেটিং দেখুন' },
  },
  solutions: {
    eyebrow: 'সমাধান',
    title: 'বাংলাদেশের ব্যবসা যেভাবে বিক্রি করে, সেভাবেই তৈরি',
    items: [
      { slug: 'small-business', name: 'ছোট ব্যবসা', summary: 'দোকানের বিক্রি থেকে অনলাইন অর্ডারে যান।' },
      { slug: 'facebook-sellers', name: 'ফেসবুক সেলার', summary: 'মেসেঞ্জারের কথাবার্তাকে গোছানো অর্ডারে বদলান।' },
      { slug: 'online-business', name: 'অনলাইন ব্যবসা', summary: 'প্রোডাক্ট, অর্ডার, পেমেন্ট আর ডেলিভারি এক জায়গায়।' },
      { slug: 'retailers', name: 'দোকান ও রিটেইলার', summary: 'ভ্যারিয়েন্ট, স্টকের হিসাব আর সারাদেশে ডেলিভারি।' },
    ],
  },
  faq: {
    eyebrow: 'সাধারণ প্রশ্ন',
    title: 'শুরুর আগে যা জানতে চান',
    intro: 'Ecomesta এখন কী কী করে, তার সোজা উত্তর।',
    links: [
      { href: '/faq', label: 'সব প্রশ্ন পড়ুন (ইংরেজি)' },
      { href: '/bn/pricing', label: 'প্যাকেজ ও দাম' },
      { href: '/blog', label: 'ব্লগ' },
      { href: '/contact', label: 'যোগাযোগ' },
    ],
    items: [
      {
        question: 'Ecomesta কী?',
        answer:
          'Ecomesta হলো বাংলাদেশের ব্যবসার জন্য একটি ই-কমার্স প্ল্যাটফর্ম। এতে আপনি পাবেন একটি অনলাইন স্টোর আর একটি মার্চেন্ট ড্যাশবোর্ড — প্রোডাক্ট, স্টক, অর্ডার, পেমেন্ট, ডেলিভারি আর কুরিয়ার বুকিং (Steadfast, Pathao, RedX, Paperfly, eCourier), কাস্টমার, কুপন, মার্কেটিং ট্র্যাকিং, থিম আর ডোমেইনের জন্য।',
      },
      {
        question: 'Ecomesta-তে কি ক্যাশ অন ডেলিভারি আছে?',
        answer: 'হ্যাঁ। চেকআউটে ক্যাশ অন ডেলিভারি থাকে, আর প্রতিটি ডেলিভারির ধরন অনুযায়ী এটা চালু বা বন্ধ রাখতে পারেন।',
      },
      {
        question: 'নিজের ডোমেইন ব্যবহার করা যাবে?',
        answer:
          'হ্যাঁ, Growth আর Business প্যাকেজে। প্রতিটি স্টোর একটি ফ্রি সাবডোমেইন পায়, আর আপনার কেনা ডোমেইন DNS TXT রেকর্ড দিয়ে যাচাই করে স্টোরের সাথে যুক্ত করতে পারেন।',
      },
      {
        question: 'Facebook Pixel বা Google Analytics যোগ করা যাবে?',
        answer:
          'হ্যাঁ, Growth আর Business প্যাকেজে। Marketing → Marketing & tracking-এ গিয়ে Facebook Pixel ID, Google Tag Manager Container ID, GA4 Measurement ID বা Search Console verification tag বসান। Add to cart, purchase-এর মতো ইভেন্ট নিজে থেকেই পাঠানো হয়।',
      },
      {
        question: 'কাস্টমারকে কি অ্যাকাউন্ট খুলতে হয়?',
        answer:
          'না। কাস্টমার অ্যাকাউন্ট ছাড়াই অর্ডার করে — প্রতিটি অর্ডারে নাম, ফোন আর ঠিকানা দেয়, আর অর্ডার নম্বর ও ফোন নম্বর বা ইমেইল দিয়ে অর্ডার ট্র্যাক করে।',
      },
    ],
  },
  cta: {
    title: 'আজই অনলাইন স্টোর খুলতে চান?',
    description: 'স্টোর খুলুন, প্রোডাক্ট যোগ করুন, আর ক্যাশ অন ডেলিভারি বা অনলাইন পেমেন্টে অর্ডার নেওয়া শুরু করুন।',
    primary: 'স্টোর খুলুন',
    secondary: 'ফিচারগুলো দেখুন',
  },
};

export const HOME_COPY: Record<MarketingLocale, HomeCopy> = { en: EN, bn: BN };
