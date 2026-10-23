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
          'Ecomesta is an ecommerce platform for Bangladesh businesses. It gives you an online store plus a merchant dashboard for products, inventory, orders, payments, shipping and courier booking (Steadfast, Pathao, RedX, Paperfly, eCourier), customers, coupons, marketing tracking, themes and domains.',
      },
      {
        question: 'How do I create a store?',
        answer:
          'Sign up with your store name and store address, choose a plan and billing period, then in the last step either pay with bKash, Nagad, Rocket or Upay, or — when that plan offers a free trial — start the trial. With payment, your store is created right away so you can add products while the Ecomesta team confirms the payment (usually within a few hours), then it goes live for customers. With a trial, the store goes live straight away and you pay before the trial ends.',
      },
      {
        question: 'Can I delete sample products?',
        answer:
          'Yes. The optional sample products are marked as Sample in the dashboard and can be edited or archived like any other product. Sample products are only offered before you add your own products and can be imported once per store.',
      },
      {
        question: 'Does Ecomesta have an affiliate program?',
        answer:
          'Yes. Anyone with an Ecomesta account can apply — no store needed. Once approved you get a referral link and earn 20% of the first plan payment of every business that signs up through it within 30 days. After a 7-day hold you can withdraw from ৳500 to bKash, Nagad, Rocket or Upay.',
      },
      {
        question: 'Is there a free trial?',
        answer:
          'You pay for your plan when you sign up, unless the plan you choose offers a free trial. Each plan’s trial length is set by Ecomesta (0, 7, or 30 days) and shown on the pricing page and at sign-up. When a trial is available, choose "Start free trial": your store goes live straight away and you pay before the trial ends. Monthly, 6-month (10% off) and yearly (25% off) billing are available.',
      },
      {
        question: 'Can I use my own domain?',
        answer:
          'Yes, on the Growth and Business plans. Every store has a free platform subdomain, and you can connect a domain you own by verifying it with a DNS TXT record and pointing it to the platform.',
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
          'Yes, on the Growth and Business plans (not Starter). Connect your SSLCommerz merchant account in Payment settings. Customers pay on the SSLCommerz hosted page, and each payment is validated server-side before the order is marked paid.',
      },
      {
        question: 'Can I connect Stripe?',
        answer:
          'Yes, on the Business plan only, if you have a Stripe account that supports your business. Stripe payments use hosted Stripe Checkout and are confirmed through signed webhooks.',
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
          'Yes, on the Growth and Business plans. Create percentage or fixed-amount coupons with minimum order values, maximum discounts, usage limits, per-customer limits and validity dates.',
      },
      {
        question: 'Can I track orders?',
        answer:
          'Yes. Orders have separate order, payment and fulfillment statuses, shipments with tracking numbers and a timeline. Customers can check progress on your store’s order tracking page.',
      },
      {
        question: 'Can I book Steadfast, Pathao or RedX from Ecomesta?',
        answer:
          'Yes, on every plan. Steadfast, Pathao, RedX, Paperfly and eCourier can be connected in Settings → Couriers with the API details from your courier account; then book a parcel from an order and refresh its delivery status there. For RedX and eCourier you also pick the courier’s delivery area when booking. Delivery Tiger, CarryBee and Karatoa Courier are not connected for direct booking yet: book with them as usual, choose the courier on the order’s shipment and add the tracking number.',
      },
      {
        question: 'Can I customize my storefront?',
        answer:
          'Yes. Pick a theme (Default, Minimal, or the premium ShopEase or Kenakata) and customize it in a live editor: logo, colours, fonts, announcement bar, header, hero, homepage sections you can add, hide and reorder, footer and SEO — saved as a draft and published when you are ready.',
      },
      {
        question: 'Can I add Facebook Pixel or Google Analytics?',
        answer:
          'Yes, on the Growth and Business plans. In Marketing → Marketing & tracking paste your Facebook Pixel ID, Google Tag Manager Container ID, GA4 Measurement ID or Search Console verification tag. Shopping events such as add to cart and purchase are sent automatically.',
      },
      {
        question: 'Can I see my store’s sales and visitors?',
        answer:
          'Yes. The dashboard shows today’s and this week’s sales, and Analytics shows sales, orders and best-selling products over time. On the Growth and Business plans you also see visitors, conversion rate, where visitors come from, the shopping funnel and any date range, with CSV export. Starter shows sales for the last 30 days. Visitors are counted without cookies and need no setup.',
      },
      {
        question: 'Can I build landing pages?',
        answer:
          'Yes, on the Growth (up to 5 pages) and Business (unlimited) plans. In Marketing → Landing pages pick one of 10 designs — single product, festival sale, fashion lookbook, food & health, story sales page, gadget, beauty & skincare, baby & kids, home & kitchen or trend/streetwear — choose your products, edit the text and pictures in a live editor and publish. Shoppers order on the page itself.',
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
