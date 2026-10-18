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
    slug: 'how-to-start-online-business-bangladesh',
    title: 'How to Start an Online Business in Bangladesh: The Complete 2026 Guide',
    description:
      'Step-by-step guide to starting an online business in Bangladesh: what to sell, budget, trade license and DBID, your store, pricing, delivery, payments and ads.',
    category: 'bangladesh-ecommerce',
    publishedTime: '2026-10-18',
    modifiedTime: '2026-10-18',
    readingMinutes: 12,
    intro:
      'Starting an online business no longer needs big capital or technical skills, but starting without a plan wastes both money and time. This guide walks through every step of starting an online business in Bangladesh — from choosing products to your first 30 days — in plain language, with real numbers.',
    sections: [
      {
        heading: '1. Decide what to sell',
        paragraphs: [
          'A successful online business starts with the right product. Pick something you know well, that people want, and that still leaves a profit after delivery and advertising. Start with one focused category — for example only women’s clothing, only organic food or only mobile accessories — rather than everything at once.',
        ],
        bullets: [
          'Check demand: see what people ask for and talk about in Facebook groups and pages',
          'Work out the profit: what is left after buying price, packaging, delivery, ads and returns',
          'Light, unbreakable products are easier and cheaper to deliver',
          'Make sure you can restock if demand grows',
        ],
      },
      {
        heading: '2. Set your budget',
        paragraphs: [
          'Many people only budget for stock, but an online business has other costs. Make a simple plan first, and keep money aside for two or three months of advertising — sales usually start slowly.',
        ],
        bullets: [
          'First stock: start small and order more of what sells',
          'Product photos: clear phone photos in good light are enough',
          'Online store: from ৳99 a month on a platform like Ecomesta — no hosting or developer needed',
          'Advertising: start with a small daily budget on Facebook and scale what works',
          'Packaging and delivery: polybags, boxes, stickers and courier charges',
        ],
      },
      {
        heading: '3. The paperwork you need',
        paragraphs: [
          'An online business in Bangladesh usually needs the following. Even if you do not have everything on day one, sort it out early — it builds customer trust and helps with payment gateways and banks.',
        ],
        bullets: [
          'Trade license — from your city corporation, municipality or union parishad; big cities accept online applications',
          'DBID (Digital Business Identity) — free from the Ministry of Commerce at dbid.gov.bd, using your website or Facebook page and NID',
          'TIN — for tax returns and banking',
          'A business mobile wallet and bank account — keep personal and business money separate',
          'Terms and a refund policy on your store — DBID rules expect your terms in Bangla',
        ],
      },
      {
        heading: '4. Where to sell: Facebook page, marketplace or your own store',
        paragraphs: [
          'A Facebook page alone is easy to start with, but as orders grow, quoting prices in the inbox, copying addresses and keeping track becomes hard. Marketplaces have many buyers, but take a commission and the customer is not really yours.',
          'The best approach is both: use Facebook to get attention and take orders on your own online store. There, customers see prices, sizes and stock themselves, enter their own address, and every order has a number and sits in one place.',
        ],
      },
      {
        heading: '5. Open your online store',
        paragraphs: [
          'You do not need to code to open a store. On Ecomesta, sign up with your store name and address, choose a plan and pay with bKash, Nagad, Rocket or Upay — the store is created right away. Then finish these steps:',
        ],
        flow: ['Open the store', 'Add your logo and colours', 'Add categories and products', 'Set delivery charges', 'Turn on payments', 'Place a test order'],
      },
      {
        heading: '6. Product photos and descriptions',
        paragraphs: ['Online customers cannot touch the product, so photos and descriptions do the selling.'],
        bullets: [
          'Shoot in daylight against a plain background, from several angles',
          'Write size, colour, material and usage clearly',
          'Create variants for sizes or colours, each with its own stock',
          'Show both the regular and the offer price — offers stand out',
          'Add customer reviews and real photos when you have them',
        ],
      },
      {
        heading: '7. Price so the profit does not disappear',
        paragraphs: [
          'Many new sellers copy competitors’ prices and then find they lose money on every order. Work out the full cost of one order before you set a price.',
          'Example: a product costs ৳400, packaging ৳20, the average ad cost per order ৳100 and the average loss on returned parcels ৳30 — ৳550 in total. If the customer pays delivery separately, selling at ৳750–৳800 leaves a healthy profit.',
        ],
      },
      {
        heading: '8. Delivery and couriers',
        paragraphs: [
          'Delivery in Bangladesh is priced by area — usually less inside Dhaka and more outside. Base your customer charge on what your courier charges you, and remember the courier’s COD charge on Cash on Delivery orders.',
          'In Ecomesta you set delivery charges by division, district and upazila, and customers see the right charge as soon as they pick their area at checkout. Connect Steadfast, Pathao, RedX, Paperfly or eCourier to book parcels straight from the order.',
        ],
        bullets: [
          'Two zones are enough to start: inside Dhaka and outside Dhaka',
          'Free delivery above an order value raises your average order',
          'Send customers the tracking number after shipping — fewer “where is my order” messages',
        ],
      },
      {
        heading: '9. Payments: Cash on Delivery and online payment',
        paragraphs: [
          'Most customers in Bangladesh still prefer Cash on Delivery, so you need it. Adding online payment brings money in at the time of order and reduces returned parcels.',
        ],
        bullets: [
          'Keep Cash on Delivery for regular orders',
          'Connect SSLCommerz so customers can pay online with bKash, Nagad and cards',
          'Consider taking the delivery charge in advance for distant or high-value orders',
        ],
      },
      {
        heading: '10. Marketing: getting your first customers',
        paragraphs: [
          'Early sales usually come from Facebook. Post good content regularly and test small ad budgets to see which products and photos get the best response.',
        ],
        bullets: [
          'Add Facebook Pixel to your store so your ads reach people more likely to buy',
          'Build a landing page with an order form for one product and send your ads there',
          'Post short videos of the product in use and customer reviews',
          'Run coupon offers before festivals',
          'Tell past customers about new products — cheaper than finding new ones',
        ],
      },
      {
        heading: '11. Reduce fake orders and returns',
        paragraphs: ['Returned parcels eat your profit — you pay delivery both ways. A few habits cut them a lot.'],
        bullets: [
          'Call to confirm the order before you ship',
          'Use real photos and accurate sizes — wrong expectations cause returns',
          'Take the delivery charge in advance on suspicious or distant orders',
          'Keep track of numbers that repeatedly refuse parcels',
        ],
      },
      {
        heading: '12. Your first 30 days',
        flow: ['Choose products and margins', 'Open the store with about 10 products', 'Set delivery and payments', 'Add your store link to your Facebook page', 'Test ads with a small budget', 'Scale what sells'],
        paragraphs: [
          'Starting matters more than being perfect. Each week, check which products sell, which ads work and where parcels come back — then adjust. Online businesses grow through patience and steady work.',
        ],
      },
    ],
    related: [
      { href: '/blog/ecommerce-website-cost-bangladesh', label: 'How much an ecommerce website costs' },
      { href: '/blog/delivery-charges-bangladesh-online-store', label: 'How to set delivery charges' },
      { href: '/pricing', label: 'Ecomesta plans and prices' },
    ],
  },
  {
    slug: 'ecommerce-website-cost-bangladesh',
    title: 'How Much Does an Ecommerce Website Cost in Bangladesh? (2026 Guide)',
    description:
      'Real 2026 ecommerce website costs in Bangladesh: custom builds, WooCommerce, Shopify and ready-made platforms from ৳99 a month, plus hidden costs and a budget.',
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
      { href: '/shopify-alternative-bangladesh', label: 'Ecomesta vs Shopify for Bangladesh stores' },
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
