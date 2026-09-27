import type { ContentSection } from './types';

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
