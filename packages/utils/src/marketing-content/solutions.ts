import type { ContentPage } from './types.js';

export const SOLUTION_PAGES: ContentPage[] = [
  {
    hub: 'solutions',
    slug: 'small-business',
    name: 'Small Businesses',
    title: 'Online Store for Small Businesses in Bangladesh | Ecomesta',
    description:
      'Take your small business online: a storefront, BDT pricing, Cash on Delivery, delivery charges by location and a simple dashboard for products and orders.',
    eyebrow: 'For small businesses',
    h1: 'Take your small business online, step by step',
    intro:
      'You already know your products and your customers. What you may not have is a website that takes orders while you sleep. Ecomesta gives you a working online store without hiring a developer.',
    summary: 'Move from offline sales to online orders.',
    highlights: [
      'No coding or hosting to manage',
      'Start with Cash on Delivery',
      'Sample products to preview your store',
      'Add online payments when you are ready',
    ],
    sections: [
      {
        heading: 'A realistic first week',
        flow: [
          'Register and name your store',
          'Import sample products to preview',
          'Replace them with your products',
          'Set delivery charges',
          'Share your store link',
        ],
      },
      {
        heading: 'Start simple, grow later',
        paragraphs: [
          'Begin with Cash on Delivery and one or two delivery zones — that is enough to take real orders. When customers ask to pay online, connect SSLCommerz. When your brand grows, connect your own domain.',
        ],
      },
      {
        heading: 'What you will use most',
        bullets: [
          'Products and categories to list what you sell',
          'Inventory to avoid selling items you no longer have',
          'Orders to confirm, ship and complete each sale',
          'Coupons for festival or launch offers',
        ],
      },
    ],
    faqs: [
      {
        question: 'I only sell a few products. Is Ecomesta too much?',
        answer:
          'No. You can run a store with a handful of products and a single delivery method, and use more features only when you need them.',
      },
      {
        question: 'Can I remove the sample products later?',
        answer:
          'Yes. Sample products are marked in the dashboard and can be edited or archived like any other product.',
      },
    ],
    related: [
      {
        href: '/features/online-store',
        label: 'Online store',
        description: 'What is included in your storefront.',
      },
      {
        href: '/payments/cash-on-delivery',
        label: 'Cash on Delivery',
        description: 'The easiest way to start selling.',
      },
      {
        href: '/pricing',
        label: 'Pricing',
        description: 'How to get started.',
      },
    ],
  },
  {
    hub: 'solutions',
    slug: 'facebook-sellers',
    name: 'Facebook Sellers',
    title: 'Online Store for Facebook Sellers in Bangladesh | Ecomesta',
    description:
      'Selling through Facebook and Messenger? Give customers a proper storefront with prices, stock, checkout and order tracking, and stop managing orders in chat threads.',
    eyebrow: 'For Facebook sellers',
    h1: 'From inbox orders to a real online store',
    intro:
      'Taking orders in Messenger works — until you are answering the same price question fifty times a day, losing track of addresses, and overselling items you no longer have. A storefront turns those conversations into structured orders.',
    summary: 'Turn Messenger conversations into structured orders.',
    highlights: [
      'Share one store link in posts and chats',
      'Prices, variants and stock shown clearly',
      'Customers enter their own address',
      'Every order in one dashboard',
    ],
    sections: [
      {
        heading: 'Problems a storefront solves',
        bullets: [
          'Repeated “price?” and “available?” questions — the product page answers them',
          'Addresses copied from chat by hand — customers select division, district and upazila themselves',
          'Delivery charges calculated manually — Ecomesta calculates them from the address',
          'Orders scattered across chats — every order has a number, status and timeline',
          'Overselling — stock is deducted automatically when an order is placed',
        ],
      },
      {
        heading: 'Keep your page, add a checkout',
        paragraphs: [
          'You do not have to leave Facebook. Keep posting and chatting, but link customers to the product page on your store to order. Your page brings attention; your store handles the order.',
        ],
      },
      {
        heading: 'Payment options your buyers expect',
        paragraphs: [
          'Offer Cash on Delivery for buyers who prefer it, and connect SSLCommerz for those who want to pay online. You decide where COD is allowed through your delivery methods.',
        ],
      },
      {
        heading: 'Launch offers with coupon codes',
        paragraphs: [
          'Post a coupon code with a usage limit or an end date, and Ecomesta enforces the rules at checkout — no need to calculate discounts in chat.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Does Ecomesta connect to my Facebook page or shop?',
        answer:
          'There is no Facebook integration. You share your store and product links in posts and conversations.',
      },
      {
        question: 'Can customers still ask questions before ordering?',
        answer:
          'Of course. Keep chatting as usual — the store simply gives them a reliable place to place the order.',
      },
    ],
    related: [
      {
        href: '/features/order-management',
        label: 'Order management',
        description: 'One place for every order.',
      },
      {
        href: '/shipping/bangladesh',
        label: 'Bangladesh delivery',
        description: 'Automatic delivery charges.',
      },
      {
        href: '/blog/facebook-page-to-online-store',
        label: 'Moving from a Facebook page to a store',
        description: 'A practical checklist.',
      },
    ],
  },
  {
    hub: 'solutions',
    slug: 'online-business',
    name: 'Online Businesses',
    title: 'Ecommerce Management Platform for Online Businesses | Ecomesta',
    description:
      'Already selling online? Centralise your catalog, inventory, orders, payments, delivery zones and storefront design in one platform built for Bangladesh.',
    eyebrow: 'For online businesses',
    h1: 'Bring your online store operations together',
    intro:
      'If your catalog lives in one sheet, orders in another and delivery charges in your head, it is time to centralise. Ecomesta keeps the pieces of an online business connected.',
    summary: 'Centralise catalog, orders, payments and delivery.',
    highlights: [
      'Catalog and inventory in sync',
      'Verified online payments',
      'Zone-based delivery with COD rules',
      'Custom domain and SEO settings',
    ],
    sections: [
      {
        heading: 'Connected operations',
        bullets: [
          'Orders deduct stock automatically; cancellations restore it',
          'Delivery charges and discounts are calculated on the server for every order',
          'Online payments are confirmed with the provider before an order is marked paid',
          'Each order keeps a snapshot of items, prices, address and shipping method',
        ],
      },
      {
        heading: 'Your brand, your domain',
        paragraphs: [
          'Connect your existing domain, set your primary address for search engines, and configure SEO title, description and share image from the theme settings.',
        ],
      },
      {
        heading: 'Team roles',
        paragraphs: [
          'Ecomesta separates owners and managers, who can change settings, from staff with read-only access — so the right people can make changes.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I import my existing catalog?',
        answer:
          'Bulk catalog import is not available yet. Products are added from the dashboard.',
      },
      {
        question: 'Can I run more than one store?',
        answer:
          'Ecomesta is multi-store by design, and each store keeps its own catalog, orders and settings.',
      },
    ],
    related: [
      {
        href: '/payments/online-payments',
        label: 'Online payments',
        description: 'How payments are verified.',
      },
      {
        href: '/features/custom-domain',
        label: 'Custom domain',
        description: 'Use the domain you already own.',
      },
      {
        href: '/features/inventory-management',
        label: 'Inventory management',
        description: 'Stock that follows your orders.',
      },
    ],
  },
  {
    hub: 'solutions',
    slug: 'retailers',
    name: 'Retailers',
    title: 'Online Store and Inventory Software for Retailers | Ecomesta',
    description:
      'For retail shops adding online sales: manage products with variants, track stock per size or colour, and fulfil online orders with delivery across Bangladesh.',
    eyebrow: 'For retailers',
    h1: 'Add online sales to your retail shop',
    intro:
      'Retailers juggle many products, sizes and colours. Ecomesta helps you list your range online, keep stock accurate per variant and fulfil orders for customers beyond your shop’s neighbourhood.',
    summary: 'Variants, stock control and nationwide delivery.',
    highlights: [
      'Variants with their own SKU and price',
      'Stock per variant',
      'Adjustments with notes',
      'Delivery zones across Bangladesh',
    ],
    sections: [
      {
        heading: 'Organise a large range',
        paragraphs: [
          'Use nested categories to mirror your shop’s sections, variants for sizes and colours, and SKUs and barcodes to match your existing labels. Search and filters help your team find products quickly.',
        ],
      },
      {
        heading: 'Keep online stock honest',
        paragraphs: [
          'When you receive stock or sell in the shop, record an adjustment with a note so your online stock stays accurate. Online orders deduct stock automatically.',
        ],
      },
      {
        heading: 'Reach customers outside your area',
        paragraphs: [
          'Set delivery charges by division, district or upazila, decide where COD is allowed, and give customers a tracking page for their orders.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Does Ecomesta include a point-of-sale system?',
        answer:
          'No. Ecomesta is for online selling. You record in-shop sales as stock adjustments to keep online inventory accurate.',
      },
    ],
    related: [
      {
        href: '/features/inventory-management',
        label: 'Inventory management',
        description: 'Stock control for online stores.',
      },
      {
        href: '/features/product-management',
        label: 'Product management',
        description: 'Variants, categories and status.',
      },
      {
        href: '/shipping/zones',
        label: 'Shipping zones',
        description: 'Delivery options by area.',
      },
    ],
  },
];
