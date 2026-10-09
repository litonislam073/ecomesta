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
          'Sign up with your store name and store address, choose a plan and billing period, and pay with bKash, Nagad, Rocket or Upay in the last step. Your store is created right away, so you can add products while the Ecomesta team confirms the payment (usually within a few hours); then the store goes live for customers.',
      },
      {
        question: 'Can I delete sample products?',
        answer:
          'Yes. The optional sample products are marked as Sample in the dashboard and can be edited or archived like any other product. Sample products are only offered before you add your own products and can be imported once per store.',
      },
      {
        question: 'Is there a free trial?',
        answer:
          'No. You pay for the plan you choose when you sign up. Monthly, 6-month (10% off) and yearly (25% off) billing are available.',
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
          'Yes, on the Growth and Business plans. Connect your SSLCommerz merchant account in Payment settings. Customers pay on the SSLCommerz hosted page, and each payment is validated server-side before the order is marked paid.',
      },
      {
        question: 'Can I connect Stripe?',
        answer:
          'Yes, on the Business plan, if you have a Stripe account that supports your business. Stripe payments use hosted Stripe Checkout and are confirmed through signed webhooks.',
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
          'Yes. Pick a theme (Default, Minimal or the premium ShopEase) and customize it in a live editor: logo, colours, fonts, announcement bar, header, hero, homepage sections you can add, hide and reorder, footer and SEO — saved as a draft and published when you are ready.',
      },
      {
        question: 'Can I add Facebook Pixel or Google Analytics?',
        answer:
          'Yes, on the Growth and Business plans. In Marketing → Marketing & tracking paste your Facebook Pixel ID, Google Tag Manager Container ID, GA4 Measurement ID or Search Console verification tag. Shopping events such as add to cart and purchase are sent automatically.',
      },
      {
        question: 'Can I build landing pages?',
        answer:
          'Not yet. Landing pages for campaigns are coming soon and are already listed in the dashboard as Coming soon. Meanwhile you can shape your homepage with theme sections and run offers with coupons.',
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
