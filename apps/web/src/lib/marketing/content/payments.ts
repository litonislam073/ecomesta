import type { ContentPage } from './types';

export const PAYMENT_PAGES: ContentPage[] = [
  {
    hub: 'payments',
    slug: 'cash-on-delivery',
    name: 'Cash on Delivery',
    title: 'Cash on Delivery for Your Online Store in Bangladesh | Ecomesta',
    description:
      'Offer Cash on Delivery at checkout and control where it is available with a COD setting on each shipping method. Orders arrive with payment pending until you collect.',
    eyebrow: 'Cash on Delivery',
    h1: 'Offer Cash on Delivery where it makes sense',
    intro:
      'Many customers in Bangladesh still prefer to pay when the parcel arrives. Ecomesta supports Cash on Delivery out of the box and lets you decide, per delivery method, where COD is allowed.',
    summary: 'Let customers pay when their order is delivered.',
    highlights: [
      'COD available at checkout',
      'Allow or block COD per shipping method',
      'Payment status tracked on each order',
      'Works alongside online payments',
    ],
    sections: [
      {
        heading: 'How COD works for your customers',
        flow: [
          'Customer chooses Cash on Delivery',
          'Order is placed with payment pending',
          'You confirm and ship the order',
          'Courier collects the payment',
          'You mark the order as paid',
        ],
      },
      {
        heading: 'Control where COD is offered',
        paragraphs: [
          'Each shipping method has a “COD allowed” setting. For example, you might allow COD for Inside Dhaka delivery but require online payment for outside-Dhaka express delivery. Checkout only offers COD when the selected delivery method allows it, and Ecomesta enforces the same rule on the server.',
        ],
      },
      {
        heading: 'Other offline options',
        paragraphs: [
          'Besides COD, you can offer bank transfer or another offline payment option. These orders also arrive with payment pending, and you update the payment status after you receive the money.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I turn off COD for some areas?',
        answer:
          'Yes. COD is controlled per shipping method, and shipping methods can belong to specific shipping zones. Disable COD on the methods where you do not want it.',
      },
      {
        question: 'Who marks a COD order as paid?',
        answer:
          'Your team updates the payment status in the dashboard once the payment has been collected.',
      },
    ],
    related: [
      {
        href: '/shipping/zones',
        label: 'Shipping zones',
        description: 'Configure COD per delivery method.',
      },
      {
        href: '/payments/sslcommerz',
        label: 'SSLCommerz',
        description: 'Accept online payments in Bangladesh.',
      },
      {
        href: '/features/order-management',
        label: 'Order management',
        description: 'Track payment status per order.',
      },
    ],
  },
  {
    hub: 'payments',
    slug: 'sslcommerz',
    name: 'SSLCommerz',
    title: 'Accept SSLCommerz Payments on Your Online Store | Ecomesta',
    description:
      'Connect your SSLCommerz merchant account to Ecomesta. Customers pay on the hosted SSLCommerz page and each payment is validated before the order is marked paid.',
    eyebrow: 'SSLCommerz',
    h1: 'Accept online payments with SSLCommerz',
    intro:
      'SSLCommerz is a widely used payment gateway in Bangladesh. Connect your own SSLCommerz merchant account and customers can pay online through the SSLCommerz hosted payment page.',
    summary: 'Bangladesh-focused hosted checkout with server-side validation.',
    highlights: [
      'Uses your own SSLCommerz merchant account',
      'Hosted payment page — no card data on your store',
      'Server-side payment validation',
      'Sandbox mode for testing',
    ],
    sections: [
      {
        heading: 'Payment flow',
        flow: [
          'Customer places the order',
          'Redirect to SSLCommerz',
          'Customer completes payment',
          'SSLCommerz notifies Ecomesta',
          'Ecomesta validates the payment',
          'Order marked paid',
        ],
        paragraphs: [
          'The order is only marked paid after Ecomesta confirms the transaction directly with SSLCommerz and checks that the amount matches the order total. The customer’s return to your store alone never marks an order as paid.',
        ],
      },
      {
        heading: 'What your customers see',
        paragraphs: [
          'After placing the order, the customer is redirected to the SSLCommerz page to pay. The payment methods shown there are the ones enabled on your SSLCommerz account. Afterwards they return to a success, failure or cancellation page on your store, and can try again if a payment did not go through.',
        ],
      },
      {
        heading: 'Setting it up',
        bullets: [
          'Open Payment settings in the merchant dashboard',
          'Enter your SSLCommerz store ID and store password',
          'Choose sandbox or live mode and run the connection test',
          'Enable SSLCommerz for checkout',
        ],
        paragraphs: [
          'Credentials are stored encrypted, and only store owners, admins and store managers can change payment settings.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Do I need my own SSLCommerz account?',
        answer:
          'Yes. Ecomesta connects to your SSLCommerz merchant account using your store ID and store password.',
      },
      {
        question: 'Does Ecomesta integrate bKash or Nagad directly?',
        answer:
          'No. There is no direct bKash or Nagad integration. Customers pay through the methods available on your SSLCommerz payment page.',
      },
      {
        question: 'Are refunds processed through Ecomesta?',
        answer:
          'Not automatically. Issue refunds from your SSLCommerz merchant panel and update the payment status in Ecomesta.',
      },
    ],
    related: [
      {
        href: '/payments/cash-on-delivery',
        label: 'Cash on Delivery',
        description: 'Offer pay-on-delivery alongside online payments.',
      },
      {
        href: '/payments/online-payments',
        label: 'Online payments',
        description: 'Stripe and test payments.',
      },
      {
        href: '/shipping',
        label: 'Shipping',
        description: 'Delivery charges added before payment.',
      },
    ],
  },
  {
    hub: 'payments',
    slug: 'online-payments',
    name: 'Online Payments',
    title: 'Online Payments for Ecommerce Stores in Bangladesh | Ecomesta',
    description:
      'How online payments work on Ecomesta: SSLCommerz and Stripe hosted checkout, a test provider for development, server-calculated totals and verified payment confirmations.',
    eyebrow: 'Online payments',
    h1: 'Online payments that are verified, not assumed',
    intro:
      'Ecomesta supports hosted online payments through SSLCommerz and Stripe, plus a test provider for trying the flow. In every case, totals are calculated by the server and a payment only counts once the provider confirms it.',
    summary: 'SSLCommerz, Stripe and a test provider.',
    highlights: [
      'SSLCommerz hosted payments',
      'Stripe Checkout where configured',
      'Test provider for development',
      'Server-side amount checks',
    ],
    sections: [
      {
        heading: 'Available online providers',
        bullets: [
          'SSLCommerz — Bangladesh-focused hosted payment page, validated with SSLCommerz after each payment',
          'Stripe — hosted Stripe Checkout for card payments, confirmed through signed Stripe webhooks, where you have a Stripe account that supports your business',
          'Test payments — a deterministic provider for development and staging, so you can try the full checkout without real money',
        ],
        paragraphs: [
          'Each provider is enabled and configured per store. A provider only appears at checkout after the store has connected and enabled it.',
        ],
      },
      {
        heading: 'Why server-side verification matters',
        bullets: [
          'The amount charged always comes from the order total calculated by Ecomesta',
          'A payment is marked paid only when the provider’s confirmation matches the order amount',
          'Duplicate provider notifications are ignored, so an order is never paid twice',
          'Customers can retry a failed or cancelled payment without placing a new order',
        ],
      },
      {
        heading: 'Merchant configuration',
        paragraphs: [
          'Store managers connect providers from Payment settings: enter credentials, choose test or live mode, run a connection test and enable the provider. Secrets are stored encrypted and never shown again in full.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I connect Stripe?',
        answer:
          'Yes, if you have a Stripe account that supports your business. Add your Stripe secret key and webhook secret in Payment settings.',
      },
      {
        question: 'Is every provider available to every store automatically?',
        answer:
          'No. Each store connects the providers it wants with its own merchant accounts. Cash on Delivery needs no external account.',
      },
    ],
    related: [
      {
        href: '/payments/sslcommerz',
        label: 'SSLCommerz',
        description: 'Details of the SSLCommerz flow.',
      },
      {
        href: '/payments/cash-on-delivery',
        label: 'Cash on Delivery',
        description: 'Offline payment on delivery.',
      },
      {
        href: '/shipping',
        label: 'Bangladesh shipping',
        description: 'Delivery zones and charges.',
      },
    ],
  },
];
