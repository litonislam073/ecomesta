import type { Faq } from './types.js';

export interface FaqGroup {
  heading: string;
  items: Faq[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    heading: 'Getting started',
    items: [
      {
        question: 'What is Ecomesta?',
        answer:
          'Ecomesta is an ecommerce platform for Bangladesh businesses. It gives you an online store plus a merchant dashboard for products, inventory, orders, payments, shipping, customers, coupons, store design and domains.',
      },
      {
        question: 'How do I create a store?',
        answer:
          'Register a merchant account, then complete a short onboarding form with your business name, store name and store address (slug). Your store is created in BDT with the Asia/Dhaka time zone and you go straight to the dashboard.',
      },
      {
        question: 'Can I delete sample products?',
        answer:
          'Yes. The optional sample products are marked as Sample in the dashboard and can be edited or archived like any other product. Sample products are only offered before you add your own products and can be imported once per store.',
      },
      {
        question: 'Can I use my own domain?',
        answer:
          'Yes. Every store has a free platform subdomain, and you can connect a domain you own by verifying it with a DNS TXT record and pointing it to the platform.',
      },
    ],
  },
  {
    heading: 'Selling in Bangladesh',
    items: [
      {
        question: 'Can I sell in Bangladesh?',
        answer:
          'Yes — Ecomesta is built Bangladesh-first: BDT pricing, division/district/upazila addresses, zone-based delivery charges, Cash on Delivery and SSLCommerz.',
      },
      {
        question: 'Does Ecomesta support Cash on Delivery?',
        answer:
          'Yes. Cash on Delivery is available at checkout, and you can allow or block it for each shipping method.',
      },
      {
        question: 'Does Ecomesta support SSLCommerz?',
        answer:
          'Yes. Connect your SSLCommerz merchant account in Payment settings. Customers pay on the SSLCommerz hosted page, and each payment is validated server-side before the order is marked paid.',
      },
      {
        question: 'Can I connect Stripe?',
        answer:
          'Yes, if you have a Stripe account that supports your business. Stripe payments use hosted Stripe Checkout and are confirmed through signed webhooks.',
      },
    ],
  },
  {
    heading: 'Catalog and orders',
    items: [
      {
        question: 'Can I manage inventory?',
        answer:
          'Yes. Stock is tracked per product or variant, deducted automatically when an order is placed, restored when an order is cancelled, and adjustable with notes.',
      },
      {
        question: 'Can I create product variants?',
        answer:
          'Yes. Variants such as sizes or colours have their own name, SKU, price and stock.',
      },
      {
        question: 'Can I create coupons?',
        answer:
          'Yes. Create percentage or fixed-amount coupons with minimum order values, maximum discounts, usage limits, per-customer limits and validity dates.',
      },
      {
        question: 'Can I track orders?',
        answer:
          'Yes. Orders have separate order, payment and fulfillment statuses, shipments with tracking numbers and a timeline. Customers can check progress on your store’s order tracking page.',
      },
      {
        question: 'Can I customize my storefront?',
        answer:
          'Yes. Choose a theme and adjust branding, colours, fonts, the announcement bar, header, hero, homepage sections, footer and SEO settings, with draft and preview before publishing.',
      },
    ],
  },
  {
    heading: 'Your customers',
    items: [
      {
        question: 'Do customers need an account?',
        answer:
          'No. Checkout is guest-only. Customers enter their contact details and delivery address with each order and track orders with their order reference and the phone number or email they used.',
      },
      {
        question: 'How does checkout work?',
        answer:
          'Customers add products to the cart, enter contact details, choose division, district and upazila, pick a delivery method, optionally apply a coupon and choose a payment option. Ecomesta recalculates prices, discounts and delivery charges on the server before the order is placed. Online payments continue on the provider’s hosted page.',
      },
    ],
  },
];

export const ALL_FAQS: Faq[] = FAQ_GROUPS.flatMap((group) => group.items);
