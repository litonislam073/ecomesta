import type { ContentSection } from './types.js';

export interface BlogCategory {
  slug: string;
  name: string;
}

export const BLOG_CATEGORIES: BlogCategory[] = [
  { slug: 'ecommerce', name: 'Ecommerce' },
  { slug: 'online-selling', name: 'Online Selling' },
  { slug: 'ecommerce-marketing', name: 'Ecommerce Marketing' },
  { slug: 'product-management', name: 'Product Management' },
  { slug: 'inventory', name: 'Inventory' },
  { slug: 'payments', name: 'Payments' },
  { slug: 'shipping', name: 'Shipping' },
  { slug: 'bangladesh-ecommerce', name: 'Bangladesh Ecommerce' },
  { slug: 'store-growth', name: 'Store Growth' },
];

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedTime: string;
  modifiedTime: string;
  readingMinutes: number;
  intro: string;
  sections: ContentSection[];
  related: { href: string; label: string }[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'ecommerce-website-cost-bangladesh',
    title: 'How Much Does an Ecommerce Website Cost in Bangladesh? (2026 Guide)',
    description:
      'Real 2026 costs of an ecommerce website in Bangladesh: custom development, WooCommerce and Shopify, and ready-made platforms from ৳99 a month — plus the hidden costs and a first-year budget.',
    category: 'bangladesh-ecommerce',
    publishedTime: '2026-10-17',
    modifiedTime: '2026-10-17',
    readingMinutes: 7,
    intro:
      'An ecommerce website in Bangladesh can cost anything from ৳99 a month to more than ৳85,000 up front. The price depends less on “a website” and more on how it is built, who maintains it and what you pay every month after launch. This guide breaks down the three common routes, the costs people forget, and a simple first-year budget so you can choose with real numbers.',
    sections: [
      {
        heading: 'The short answer',
        bullets: [
          'Custom-built website: usually ৳20,000–৳85,000 or more one-time, plus yearly hosting, domain and developer support',
          'WooCommerce or Shopify: the software looks cheap or free, but hosting, themes, apps and setup add up — and Shopify bills in US dollars every month',
          'Ready-made Bangladesh platform such as Ecomesta: from ৳99 a month, with hosting, security, checkout and updates included',
        ],
      },
      {
        heading: 'Option 1: A custom-built website',
        paragraphs: [
          'Hiring an agency or freelancer to build your store gives you a design made just for you. Published Bangladesh price lists in mid-2026 put a basic Laravel or PHP ecommerce website at roughly ৳21,000–৳25,000, a Shopify store setup around ৳32,000, a multi-vendor marketplace around ৳50,000, and a custom React or Node.js build at ৳85,000 or more. Agencies that quote for larger projects often start at ৳60,000–৳150,000.',
          'The build price is only the beginning. A custom site needs hosting, an SSL certificate, a domain, payment-gateway integration, security updates and someone to fix things when they break. If the original developer is not available, small changes can become expensive.',
        ],
        bullets: [
          'Best for: businesses with unusual requirements and a budget for ongoing development',
          'Watch out for: who owns the code, what support is included after launch, and the yearly renewal cost',
        ],
      },
      {
        heading: 'Option 2: WooCommerce or Shopify',
        paragraphs: [
          'WooCommerce is free to install on WordPress, which is why it powers most stores in Bangladesh. You still pay for hosting, a premium theme, plugins for local couriers and payments, and usually a developer to set it up and keep plugins updated. Slow hosting or an outdated plugin can take the whole store down.',
          'Shopify is easy to use, but plans are charged in US dollars every month and many features — local courier booking, Cash on Delivery rules, Bangladesh delivery areas — need paid apps. Paying a dollar subscription with a Bangladeshi card is also not always simple. Check Shopify’s current pricing and the apps you would need before you decide.',
        ],
      },
      {
        heading: 'Option 3: A ready-made platform built for Bangladesh',
        paragraphs: [
          'A hosted ecommerce platform gives you a working store in minutes: storefront, cart, checkout, order management, hosting and security, for a fixed monthly fee in taka. You do not pay a developer to start, and the platform keeps the software updated.',
          'Ecomesta, for example, has three plans. Starter is ৳99 a month for up to 25 products with Cash on Delivery checkout. Growth is ৳299 a month for up to 100 products, your own domain, SSLCommerz online payments (bKash, Nagad and cards), coupons, delivery zones, all themes, Facebook Pixel and Google Analytics, and landing pages. Business is ৳699 a month for unlimited products, Stripe for international cards and premium themes. Paying for 6 months saves 10% and paying yearly saves 25% — Growth works out to ৳2,691 for a full year.',
        ],
      },
      {
        heading: 'Costs every online store has',
        paragraphs: [
          'Whichever route you choose, budget for these too:',
        ],
        bullets: [
          'Domain name: about ৳1,500–৳2,000 a year for a .com (optional on Ecomesta — every store gets a free web address)',
          'Payment gateway fees: online gateways such as SSLCommerz charge a percentage of each payment under your agreement with them',
          'Courier charges: delivery inside and outside Dhaka, plus the cost of returned Cash on Delivery parcels',
          'Product photos and descriptions: good photos sell more than an expensive design',
          'Marketing: Facebook and Google ads, and boosting posts, are usually the biggest monthly cost once you start selling',
        ],
      },
      {
        heading: 'Example first-year budget',
        paragraphs: [
          'Here is how the first year can compare for a small shop with around 50 products. Your numbers will differ, but the pattern is typical.',
        ],
        bullets: [
          'Custom website: ৳25,000 build + about ৳5,000 hosting + ৳1,800 domain + developer fixes = roughly ৳32,000 or more before your first sale',
          'Ecomesta Growth, paid yearly: ৳2,691 + optional ৳1,800 domain = under ৳4,500, with hosting, checkout and updates included',
          'The difference — often ৳25,000 or more — can go into stock, product photos and ads instead',
        ],
      },
      {
        heading: 'How to choose',
        flow: [
          'Count your products',
          'List the payment methods you need',
          'Decide who will maintain the site',
          'Compare the full first-year cost',
          'Start small and upgrade as you grow',
        ],
        paragraphs: [
          'If you are moving from a Facebook page or starting out, begin with a ready-made platform: you can be selling this week and you only pay a small monthly fee. Move to a custom build later if your business really needs something no platform offers.',
        ],
      },
      {
        heading: 'Don’t forget the paperwork',
        paragraphs: [
          'An online business in Bangladesh generally needs a trade license from your city corporation or local authority, a TIN for tax, and a Digital Business Identity (DBID), which the Ministry of Commerce issues free at dbid.gov.bd. Online stores are also expected to publish their terms in Bangla. Requirements change, so check the current rules or ask an adviser before you launch.',
        ],
      },
    ],
    related: [
      { href: '/pricing', label: 'Ecomesta plans and prices' },
      { href: '/features/online-store', label: 'What you get with an Ecomesta online store' },
      { href: '/blog/facebook-page-to-online-store', label: 'Moving from a Facebook page to your own store' },
    ],
  },
  {
    slug: 'delivery-charges-bangladesh-online-store',
    title: 'How to Set Delivery Charges for an Online Store in Bangladesh',
    description:
      'A practical guide to planning delivery zones, inside/outside Dhaka rates, free-delivery thresholds and Cash on Delivery rules for a Bangladesh online store.',
    category: 'shipping',
    publishedTime: '2026-09-27',
    modifiedTime: '2026-09-27',
    readingMinutes: 6,
    intro:
      'Delivery charges are one of the first things a Bangladeshi shopper checks — and one of the easiest places to lose money as a seller. This guide walks through a simple way to plan them.',
    sections: [
      {
        heading: 'Start from your real courier costs',
        paragraphs: [
          'Before choosing any number, list what your courier actually charges you: inside Dhaka, Dhaka suburbs, and outside Dhaka, including any COD collection fee. Your customer-facing charge should cover this, or you should decide consciously how much of it you absorb.',
        ],
      },
      {
        heading: 'Group locations into a small number of zones',
        paragraphs: [
          'Most stores do well with two or three zones. More zones mean more to maintain and more for customers to understand.',
        ],
        bullets: [
          'Inside Dhaka — usually defined by Dhaka district or specific upazilas/thanas',
          'Dhaka suburbs — optional, for areas your courier prices differently',
          'Rest of Bangladesh — everything else',
        ],
      },
      {
        heading: 'Choose flat or free delivery per zone',
        paragraphs: [
          'A flat rate per zone is easy for customers to understand. Free delivery can be powerful for small, light products, but price it into your margins first.',
        ],
      },
      {
        heading: 'Use a free-delivery threshold to lift order value',
        paragraphs: [
          'A threshold such as “free delivery over ৳1,500” encourages customers to add one more item. Set it a little above your current average order value, and check that the margin on a typical threshold order still covers delivery.',
        ],
      },
      {
        heading: 'Decide where Cash on Delivery is allowed',
        paragraphs: [
          'COD increases conversions, but also increases returned parcels in some areas. Many sellers allow COD inside Dhaka and on standard delivery, and ask for online payment on express options or for high-value orders.',
        ],
      },
      {
        heading: 'Setting this up in Ecomesta',
        flow: [
          'Create zones by division, district or upazila',
          'Add a flat-rate or free method to each zone',
          'Set free-shipping thresholds where useful',
          'Allow or block COD per method',
        ],
      },
    ],
    related: [
      { href: '/shipping/zones', label: 'Shipping zones and rates in Ecomesta' },
      { href: '/payments/cash-on-delivery', label: 'Cash on Delivery settings' },
    ],
  },
  {
    slug: 'cash-on-delivery-vs-online-payment',
    title: 'Cash on Delivery vs Online Payment: What Should Your Store Offer?',
    description:
      'The trade-offs between Cash on Delivery and online payments for Bangladesh online stores, and how to combine both without hurting conversions or cash flow.',
    category: 'payments',
    publishedTime: '2026-09-27',
    modifiedTime: '2026-09-27',
    readingMinutes: 5,
    intro:
      'Cash on Delivery remains popular with Bangladeshi shoppers, while online payments are growing. Offering the right mix affects your conversion rate, cash flow and returns.',
    sections: [
      {
        heading: 'Why customers choose Cash on Delivery',
        bullets: [
          'Trust — they pay only after seeing the parcel',
          'Familiarity — many first-time online buyers prefer it',
          'No need for a card or payment account',
        ],
      },
      {
        heading: 'The costs of COD for sellers',
        bullets: [
          'Cash arrives later, after the courier settles',
          'Refused parcels cost you delivery both ways',
          'More manual reconciliation of collected payments',
        ],
      },
      {
        heading: 'Why add online payments',
        paragraphs: [
          'Online payments bring money in at the time of order and reduce refused deliveries. They also suit customers who prefer not to handle cash. In Bangladesh, a hosted gateway such as SSLCommerz lets customers pay with the methods enabled on your gateway account.',
        ],
      },
      {
        heading: 'A balanced approach',
        bullets: [
          'Offer both COD and online payment on standard delivery',
          'Consider online-only payment for express or distant delivery options',
          'Make it clear at checkout which options are available for the chosen delivery method',
          'Never mark an online order as paid until the gateway confirms it',
        ],
      },
      {
        heading: 'How Ecomesta handles this',
        paragraphs: [
          'Ecomesta supports Cash on Delivery, SSLCommerz and Stripe. COD is allowed or blocked per shipping method, and online payments are validated with the provider on the server before an order is marked paid.',
        ],
      },
    ],
    related: [
      { href: '/payments', label: 'Payment options in Ecomesta' },
      { href: '/payments/sslcommerz', label: 'How SSLCommerz works in Ecomesta' },
    ],
  },
  {
    slug: 'facebook-page-to-online-store',
    title: 'Moving From a Facebook Page to Your Own Online Store: A Checklist',
    description:
      'A step-by-step checklist for Facebook and Messenger sellers in Bangladesh who want a proper online store with checkout, delivery charges and order tracking.',
    category: 'online-selling',
    publishedTime: '2026-09-27',
    modifiedTime: '2026-09-27',
    readingMinutes: 7,
    intro:
      'Facebook is a great place to be discovered, but managing orders in Messenger becomes painful as you grow. This checklist helps you move orders to your own store without losing the audience you have built.',
    sections: [
      {
        heading: '1. Prepare your product information',
        bullets: [
          'A clear name and short description for each product',
          'Prices in BDT, including any compare-at (regular) price for offers',
          'Sizes, colours or pack options you will list as variants',
          'Current stock for each product or variant',
        ],
      },
      {
        heading: '2. Organise categories',
        paragraphs: [
          'Group products the way customers think — by type, occasion or audience. Keep the top level short; five to eight categories is plenty for most stores.',
        ],
      },
      {
        heading: '3. Write down your delivery and payment rules',
        paragraphs: [
          'Decide your inside/outside Dhaka charges, any free-delivery threshold, and where you accept Cash on Delivery. Writing this down first makes store setup quick and keeps answers consistent in chat.',
        ],
      },
      {
        heading: '4. Set up the store',
        flow: [
          'Create the store',
          'Add categories and products',
          'Configure delivery zones and methods',
          'Enable COD and online payments',
          'Customise branding',
          'Place a test order',
        ],
      },
      {
        heading: '5. Move conversations to product links',
        paragraphs: [
          'When a customer asks about a product, reply with its store link. Pin your store link on your page, and add it to your post captions. Over time, customers learn that the store is the fastest way to order.',
        ],
      },
      {
        heading: '6. Use order tracking to reduce follow-up messages',
        paragraphs: [
          'Share the order reference with customers after checkout and point them to the tracking page. Add courier tracking numbers to shipments so customers can follow their parcel themselves.',
        ],
      },
    ],
    related: [
      { href: '/solutions/facebook-sellers', label: 'Ecomesta for Facebook sellers' },
      { href: '/features/order-tracking', label: 'Order tracking for customers' },
    ],
  },
];

export function formatPostDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function blogCategoryName(slug: string): string {
  return BLOG_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}
