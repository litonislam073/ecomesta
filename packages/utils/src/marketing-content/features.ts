import type { ContentPage } from './types.js';

export const FEATURE_PAGES: ContentPage[] = [
  {
    hub: 'features',
    slug: 'online-store',
    name: 'Online Store',
    title: 'Create an Online Store in Bangladesh | Ecomesta',
    description:
      'Open a branded online store with BDT pricing, guest checkout, Bangladesh delivery addresses and a free store subdomain — managed from one merchant dashboard.',
    eyebrow: 'Online store',
    h1: 'Launch your online store without building everything from scratch',
    intro:
      'Ecomesta gives every merchant a ready-to-sell storefront: product pages, categories, search, cart, checkout and order tracking. You focus on your products and customers; the platform handles the storefront and the checkout logic.',
    summary: 'A complete storefront with cart, checkout and order tracking.',
    highlights: [
      'Free store address on the Ecomesta subdomain',
      'Guest checkout with Bangladesh address fields',
      'BDT pricing and Asia/Dhaka time zone by default',
      'Connect your own domain when you are ready',
    ],
    sections: [
      {
        heading: 'From sign-up to first order',
        paragraphs: [
          'After you register, a short onboarding step asks for your business name, store name and store address. Your store is created in Bangladeshi Taka with the Asia/Dhaka time zone, and you land in the merchant dashboard.',
        ],
        flow: [
          'Create your store',
          'Customize the storefront',
          'Add products',
          'Configure payments',
          'Configure shipping',
          'Start selling',
        ],
      },
      {
        heading: 'What your customers get',
        bullets: [
          'A homepage with featured categories and featured products',
          'Category pages, product pages and variant selection (for example size or colour)',
          'Product search, category filters and sorting',
          'A cart and a guest checkout — customers do not need to create an account',
          'Division, district and upazila address selection with delivery charges calculated for their location',
          'An order tracking page where customers check their order with their order reference and the phone number or email used at checkout',
        ],
      },
      {
        heading: 'Preview with sample products',
        paragraphs: [
          'New stores can optionally import a small set of sample products and categories to see how the storefront looks before adding their own catalog. Sample items are clearly marked in the dashboard and can be edited or archived at any time. The option disappears once you add your first real product.',
        ],
      },
      {
        heading: 'Your store, isolated from everyone else',
        paragraphs: [
          'Ecomesta is a multi-tenant platform: each store’s products, orders, customers and settings are kept separate and are only accessible to that store’s team.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Do I need a developer to open a store?',
        answer:
          'No. You register, complete a short onboarding form and manage everything — products, shipping, payments and design — from the merchant dashboard.',
      },
      {
        question: 'What address will my store have?',
        answer:
          'Every store gets a subdomain on the Ecomesta platform based on your store slug. You can also connect your own domain from the Domains page in the dashboard.',
      },
      {
        question: 'Do my customers need an account to buy?',
        answer:
          'No. Checkout is guest-only: customers enter their contact details and delivery address for each order.',
      },
    ],
    related: [
      {
        href: '/features/store-customization',
        label: 'Store customization',
        description: 'Brand colours, fonts, hero, header and footer.',
      },
      {
        href: '/features/product-management',
        label: 'Product management',
        description: 'Products, variants and categories.',
      },
      {
        href: '/payments',
        label: 'Payments',
        description: 'Cash on Delivery, SSLCommerz and Stripe.',
      },
    ],
  },
  {
    hub: 'features',
    slug: 'product-management',
    name: 'Product Management',
    title: 'Ecommerce Product Management Software | Ecomesta',
    description:
      'Manage your online product catalog: products, variants, nested categories, pricing, product status and stock — with search and filters built for growing stores.',
    eyebrow: 'Product management',
    h1: 'Manage your product catalog in one place',
    intro:
      'Keep every product, variant and category organised from the merchant dashboard. Decide what is live, what is still a draft and what is archived — and let inventory follow along automatically.',
    summary: 'Products, variants, categories and product status.',
    highlights: [
      'Variants with their own price and SKU',
      'Nested categories',
      'Draft, active and archived status',
      'Compare-at and cost prices',
    ],
    sections: [
      {
        heading: 'Products and variants',
        paragraphs: [
          'Each product has a name, URL slug, short and long description, SKU, barcode and a base price in BDT. Add a compare-at price to show a discount on the storefront, and a cost price for your own records.',
          'When a product comes in several options — sizes, colours, pack sizes — create variants. Every variant has its own name, SKU and price, and its own stock.',
        ],
      },
      {
        heading: 'Categories that match how you sell',
        paragraphs: [
          'Categories can be nested, so you can build a structure such as Fashion → Men → T-Shirts. A product can belong to more than one category, and active categories appear on your storefront for browsing.',
        ],
      },
      {
        heading: 'Product status',
        bullets: [
          'Draft — prepare a product without showing it to customers',
          'Active — visible and purchasable on your storefront',
          'Archived — removed from the storefront while keeping order history intact',
        ],
      },
      {
        heading: 'Find anything quickly',
        paragraphs: [
          'Search the catalog by name or SKU, and filter by status, product type or category. Sort by last updated, creation date, name or price to review your catalog the way you need.',
        ],
      },
      {
        heading: 'Inventory settings per product',
        paragraphs: [
          'Choose whether each product tracks inventory and whether it can be ordered when out of stock (backorders). Stock itself is managed on the inventory page.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I create product variants?',
        answer:
          'Yes. Variants have their own name, SKU, price and stock, and customers pick a variant on the product page.',
      },
      {
        question: 'What happens when I delete a product?',
        answer:
          'Deleting archives the product. It disappears from your storefront, but past orders keep their product details.',
      },
      {
        question: 'Can staff edit products?',
        answer:
          'Store owners, admins and store managers can create and edit products. Staff accounts have read-only access.',
      },
    ],
    related: [
      {
        href: '/features/inventory-management',
        label: 'Inventory management',
        description: 'Stock levels, adjustments and movement history.',
      },
      {
        href: '/features/order-management',
        label: 'Order management',
        description: 'What happens after a customer checks out.',
      },
      {
        href: '/features/online-store',
        label: 'Online store',
        description: 'How products appear to your customers.',
      },
    ],
  },
  {
    hub: 'features',
    slug: 'inventory-management',
    name: 'Inventory Management',
    title: 'Inventory Management for Online Stores | Ecomesta',
    description:
      'Track stock per product and variant, record adjustments with reasons, and let orders and cancellations update inventory automatically.',
    eyebrow: 'Inventory management',
    h1: 'Always know what you have in stock',
    intro:
      'Ecomesta keeps stock levels in sync with your orders. Every change is recorded as a stock movement, so you can see why a number changed — not just that it did.',
    summary: 'Stock per product and variant, with a full movement history.',
    highlights: [
      'Stock per product or per variant',
      'Manual adjustments with notes',
      'Automatic deduction when an order is placed',
      'Stock restored when an order is cancelled',
    ],
    sections: [
      {
        heading: 'Stock that follows your orders',
        bullets: [
          'When a customer places an order, the ordered quantity is deducted from stock',
          'If you cancel an order, the stock is returned to inventory',
          'Customers cannot order more than is available unless you allow backorders for that product',
        ],
      },
      {
        heading: 'Adjustments with a paper trail',
        paragraphs: [
          'Received a new delivery or found damaged items? Record a stock adjustment with a note. Each movement — adjustments, sales and cancellation returns — is stored with its quantity and time, giving you a clear history per product or variant.',
        ],
      },
      {
        heading: 'Spot low stock early',
        paragraphs: [
          'Filter the inventory list to see items running low so you can restock before products sell out.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Is stock reserved while a customer is paying online?',
        answer:
          'Stock is deducted when the order is placed, before the customer is sent to the payment page. If an order is later cancelled, the stock is restored.',
      },
      {
        question: 'Can I track stock for each size or colour?',
        answer:
          'Yes. Products with variants keep separate stock for each variant.',
      },
    ],
    related: [
      {
        href: '/features/product-management',
        label: 'Product management',
        description: 'Set up products and variants.',
      },
      {
        href: '/features/order-management',
        label: 'Order management',
        description: 'How orders and cancellations affect stock.',
      },
      {
        href: '/solutions/retailers',
        label: 'For retailers',
        description: 'Inventory-first selling for shops.',
      },
    ],
  },
  {
    hub: 'features',
    slug: 'order-management',
    name: 'Order Management',
    title: 'Order Management for Ecommerce Stores | Ecomesta',
    description:
      'Handle every order from placement to delivery: order numbers, order, payment and fulfillment status, shipments with tracking numbers, cancellations and a clear timeline.',
    eyebrow: 'Order management',
    h1: 'Handle every order from checkout to delivery',
    intro:
      'Orders arrive in your dashboard with everything you need to fulfil them: items, prices, delivery address, shipping method and payment status. Move each order forward step by step, and your customer can follow along.',
    summary: 'Order, payment and fulfillment status with a clear timeline.',
    highlights: [
      'Readable order numbers per store',
      'Separate order, payment and fulfillment status',
      'Shipments with tracking numbers',
      'Cancellations that restore stock',
    ],
    sections: [
      {
        heading: 'Three statuses, one clear picture',
        paragraphs: [
          'Each order carries a readable order number (for example EM-100001) and three independent statuses, so you always know where it stands.',
        ],
        bullets: [
          'Order status — pending, confirmed, processing, completed or cancelled',
          'Payment status — for example pending, paid, failed or refunded',
          'Fulfillment status — unfulfilled, partially fulfilled, fulfilled or returned',
        ],
      },
      {
        heading: 'Order flow',
        flow: ['Placed', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Completed'],
        paragraphs: [
          'Status changes follow allowed transitions, which prevents accidental jumps such as completing an order that was never confirmed.',
        ],
      },
      {
        heading: 'Shipments and tracking numbers',
        paragraphs: [
          'Create a shipment for an order, add the courier tracking number and update the shipment as it moves — shipped, in transit, delivered. Marking a shipment as shipped updates the order’s fulfillment status automatically.',
        ],
      },
      {
        heading: 'Cancellations done right',
        paragraphs: [
          'Cancel an open order with an optional reason that your customer can see. Cancelled items are returned to inventory automatically.',
        ],
      },
      {
        heading: 'A timeline for every order',
        paragraphs: [
          'The order timeline shows what happened and when: order placed, confirmed, payment received or failed, shipment created, shipped, delivered or cancelled. Customers see the same progress on the order tracking page.',
        ],
      },
      {
        heading: 'Prices you can trust',
        paragraphs: [
          'Totals, discounts and delivery charges are calculated on the server when the order is placed, not taken from the customer’s browser. Each order keeps a snapshot of the product names, prices, shipping method and address at the time of purchase.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can customers track their orders?',
        answer:
          'Yes. Customers enter their order reference and the email used at checkout on your store’s order tracking page — no account required.',
      },
      {
        question: 'Are courier companies connected automatically?',
        answer:
          'Not at the moment. You book deliveries with your courier as usual and add the tracking number to the shipment in Ecomesta.',
      },
      {
        question: 'Does cancelling an order restore stock?',
        answer: 'Yes. When you cancel an order, its items are returned to inventory.',
      },
    ],
    related: [
      {
        href: '/features/order-tracking',
        label: 'Order tracking',
        description: 'What your customers see after checkout.',
      },
      {
        href: '/shipping',
        label: 'Bangladesh shipping',
        description: 'Delivery zones and charges.',
      },
      {
        href: '/features/store-customization',
        label: 'Store customization',
        description: 'Make the storefront your own.',
      },
    ],
  },
  {
    hub: 'features',
    slug: 'customer-management',
    name: 'Customer Management',
    title: 'Customer Management for Online Stores | Ecomesta',
    description:
      'Keep store-scoped customer records with contact details and multiple addresses, search them quickly, and see delivery details on every order.',
    eyebrow: 'Customer management',
    h1: 'Keep your customer details organised',
    intro:
      'Ecomesta stores customer information per store, so your customer list is yours alone. Every order also keeps the customer’s contact and delivery details exactly as they were entered at checkout.',
    summary: 'Store-scoped customer records and addresses.',
    highlights: [
      'Customer records with contact details',
      'Multiple billing and shipping addresses',
      'Bangladesh address fields',
      'Search by name, email or phone',
    ],
    sections: [
      {
        heading: 'Customer records',
        paragraphs: [
          'Add customers with their name, email, phone and notes. Each customer can have several billing and shipping addresses, including division, district and upazila.',
        ],
      },
      {
        heading: 'Contact details on every order',
        paragraphs: [
          'Checkout is guest-only, so customers do not create accounts. The name, phone, email and delivery address entered at checkout are saved on the order, giving your team what it needs to confirm and deliver.',
        ],
      },
      {
        heading: 'Private to your store',
        paragraphs: [
          'Customer data is scoped to the store it belongs to. Other merchants on the platform can never see it.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Are customers added automatically when they order?',
        answer:
          'Checkout details are stored on each order. Customer records are managed by your team from the Customers page.',
      },
      {
        question: 'Is this a full CRM?',
        answer:
          'No. Ecomesta covers customer records, addresses and order contact details. It does not include email campaigns or customer segmentation.',
      },
    ],
    related: [
      {
        href: '/features/order-management',
        label: 'Order management',
        description: 'Contact and delivery details on orders.',
      },
      {
        href: '/features/coupons',
        label: 'Coupons',
        description: 'Per-customer usage limits.',
      },
      {
        href: '/shipping/bangladesh',
        label: 'Bangladesh addresses',
        description: 'Division, district and upazila.',
      },
    ],
  },
  {
    hub: 'features',
    slug: 'coupons',
    name: 'Coupons & Discounts',
    title: 'Coupons and Discount Codes for Your Online Store | Ecomesta',
    description:
      'Create percentage or fixed-amount coupon codes with minimum order values, maximum discounts, usage limits, per-customer limits and validity dates.',
    eyebrow: 'Coupons and discounts',
    h1: 'Run promotions with coupon codes',
    intro:
      'Give customers a reason to order today. Create a coupon code, set the rules, and Ecomesta checks every condition before the discount is applied.',
    summary: 'Percentage and fixed discounts with usage rules.',
    highlights: [
      'Percentage or fixed BDT discounts',
      'Minimum order amount and maximum discount',
      'Total and per-customer usage limits',
      'Start and end dates',
    ],
    sections: [
      {
        heading: 'Two kinds of discount',
        bullets: [
          'Percentage — for example 10% off the order',
          'Fixed amount — for example ৳200 off the order',
        ],
        paragraphs: [
          'Discounts apply to the merchandise subtotal of the whole cart.',
        ],
      },
      {
        heading: 'Rules you control',
        bullets: [
          'Minimum order amount — only apply the coupon above a certain subtotal',
          'Maximum discount — cap how much a percentage coupon can take off',
          'Total usage limit — stop the coupon after a number of uses',
          'Per-customer limit — limit how many times one customer can use it',
          'Validity window — set a start and end date',
          'Active switch — pause a coupon at any time',
        ],
      },
      {
        heading: 'Checked on the server',
        paragraphs: [
          'Coupon rules are validated by Ecomesta when the customer applies the code and again when the order is placed. Customers cannot bypass limits by editing the page.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I offer free shipping with a coupon?',
        answer:
          'Coupons currently offer percentage or fixed discounts. To offer free delivery, set a free-shipping threshold on your shipping method instead.',
      },
      {
        question: 'Can a coupon apply only to certain products?',
        answer: 'Not yet. Coupons apply to the whole cart subtotal.',
      },
    ],
    related: [
      {
        href: '/shipping/zones',
        label: 'Free shipping thresholds',
        description: 'Free delivery above an order value.',
      },
      {
        href: '/features/customer-management',
        label: 'Customer management',
        description: 'Customer records and addresses.',
      },
      {
        href: '/solutions/facebook-sellers',
        label: 'For Facebook sellers',
        description: 'Promotions for social-first stores.',
      },
    ],
  },
  {
    hub: 'features',
    slug: 'store-customization',
    name: 'Store Customization',
    title: 'Customize Your Online Store Design | Ecomesta',
    description:
      'Brand your storefront with your logo, colours and fonts, and set up the announcement bar, header, hero, homepage sections and footer — with draft and preview.',
    eyebrow: 'Store customization',
    h1: 'Make the storefront look like your brand',
    intro:
      'Choose a theme, then adjust branding, layout and content from the dashboard. Work on a draft, preview it, and publish when you are happy — your live store stays untouched until then.',
    summary: 'Branding, typography, hero, header, footer and SEO.',
    highlights: [
      'Two built-in themes: Default and Minimal',
      'Draft, preview and publish',
      'Colours, fonts and logo',
      'SEO title, description and share image',
    ],
    sections: [
      {
        heading: 'Branding',
        bullets: [
          'Brand name and tagline',
          'Logo and favicon (by image URL)',
          'Brand colours for buttons, text, backgrounds and borders',
          'Corner radius for a softer or sharper look',
        ],
      },
      {
        heading: 'Typography',
        paragraphs: [
          'Pick heading and body fonts from a curated list and set the base font size for comfortable reading on phones and desktops.',
        ],
      },
      {
        heading: 'Header, announcement bar and hero',
        bullets: [
          'Announcement bar for offers or delivery notices, with an optional link',
          'Header layout (classic, centred or minimal), sticky header, search and cart visibility',
          'Navigation menu links',
          'Hero section with headline, subheadline, button and background image',
        ],
      },
      {
        heading: 'Homepage and footer',
        bullets: [
          'Featured categories and featured products on the homepage',
          'Footer tagline, menu, copyright and social links',
          'Optional payment icons in the footer',
        ],
      },
      {
        heading: 'SEO settings',
        paragraphs: [
          'Set the title, description, keywords and social share image your store uses in search results and link previews.',
        ],
      },
      {
        heading: 'Safe publishing',
        flow: ['Edit draft', 'Preview', 'Publish'],
        paragraphs: [
          'Changes are saved to a draft first. Preview the draft on your storefront, then publish — or reset to start over.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I upload images directly?',
        answer:
          'Logo, favicon and hero images are currently set by image URL. Direct uploads are not available yet.',
      },
      {
        question: 'Will editing the theme affect my live store immediately?',
        answer:
          'No. You edit a draft and can preview it. Customers see the changes only after you publish.',
      },
    ],
    related: [
      {
        href: '/features/custom-domain',
        label: 'Custom domain',
        description: 'Serve your store on your own domain.',
      },
      {
        href: '/features/online-store',
        label: 'Online store',
        description: 'Everything included in the storefront.',
      },
      {
        href: '/pricing',
        label: 'Pricing',
        description: 'How to get started today.',
      },
    ],
  },
  {
    hub: 'features',
    slug: 'custom-domain',
    name: 'Custom Domain',
    title: 'Connect a Custom Domain to Your Online Store | Ecomesta',
    description:
      'Use your own domain for your Ecomesta store: add the domain, verify ownership with a DNS TXT record, activate it and set it as your primary storefront address.',
    eyebrow: 'Custom domain',
    h1: 'Use your own domain for your online store',
    intro:
      'Every store starts on a free Ecomesta subdomain. When you are ready, connect a domain you own — such as yourbrand.com.bd — so customers find you under your own name.',
    summary: 'Verify and connect a domain you own.',
    highlights: [
      'Free platform subdomain included',
      'DNS TXT ownership verification',
      'Primary domain used as your canonical address',
      'HTTPS in production',
    ],
    sections: [
      {
        heading: 'How connecting a domain works',
        flow: [
          'Add your domain',
          'Publish the TXT record',
          'Verify',
          'Point DNS to the platform',
          'Activate',
          'Set as primary',
        ],
        paragraphs: [
          'Ecomesta shows a verification token that you add as a DNS TXT record at your domain provider. Once the record is visible, click Verify. You also point the domain to the platform with a CNAME or A record at your DNS provider, then activate it.',
        ],
      },
      {
        heading: 'Primary domain',
        paragraphs: [
          'If you connect more than one address, choose a primary domain. It becomes the canonical address search engines see for your store, which avoids duplicate listings.',
        ],
      },
      {
        heading: 'HTTPS',
        paragraphs: [
          'Production storefronts are served over HTTPS. SSL certificates for custom domains are provisioned on the platform infrastructure; they are not issued automatically from the dashboard yet, so domain activation can take a little coordination.',
        ],
      },
      {
        heading: 'Routing you can rely on',
        paragraphs: [
          'Requests to a connected domain always load the store that owns it. A domain that is not connected to any store shows a “store not found” page instead of someone else’s store.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Does Ecomesta configure my DNS automatically?',
        answer:
          'No. You add the TXT verification record and the CNAME or A record at your own DNS provider. The dashboard shows the verification record you need.',
      },
      {
        question: 'Can I keep using the free subdomain?',
        answer:
          'Yes. The platform subdomain keeps working. Your primary domain is the one used as the canonical address.',
      },
    ],
    related: [
      {
        href: '/features/store-customization',
        label: 'Store customization',
        description: 'Brand the store behind your domain.',
      },
      {
        href: '/features/online-store',
        label: 'Online store',
        description: 'What customers see on your domain.',
      },
      {
        href: '/faq',
        label: 'FAQ',
        description: 'More answers about getting started.',
      },
    ],
  },
  {
    hub: 'features',
    slug: 'order-tracking',
    name: 'Order Tracking',
    title: 'Order Tracking Page for Your Customers | Ecomesta',
    description:
      'A self-service tracking page: customers enter their order reference and checkout phone or email to see order and payment status, shipment progress and tracking number.',
    eyebrow: 'Order tracking',
    h1: 'Let customers check their own order status',
    intro:
      'Fewer “where is my order?” messages. Every Ecomesta store includes an order tracking page where customers see the latest progress of their order without creating an account.',
    summary: 'Self-service order status for your customers.',
    highlights: [
      'No customer account required',
      'Order reference plus checkout email',
      'Timeline of order progress',
      'Shipment status and tracking number',
    ],
    sections: [
      {
        heading: 'What customers see',
        bullets: [
          'Order status and payment status',
          'A timeline: placed, confirmed, payment, shipped, delivered or cancelled',
          'Shipment status and courier tracking number when you add one',
          'The cancellation reason, if you cancelled the order with a note',
          'Items, delivery address and totals',
        ],
      },
      {
        heading: 'Private by design',
        paragraphs: [
          'Customers look up an order with its private order reference and the email used at checkout. Lookups are rate-limited to discourage guessing.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Where do customers find their order reference?',
        answer:
          'It is shown on the order confirmation page after checkout, with a link to the tracking page.',
      },
    ],
    related: [
      {
        href: '/features/order-management',
        label: 'Order management',
        description: 'Update the statuses customers see.',
      },
      {
        href: '/shipping',
        label: 'Shipping',
        description: 'Delivery zones and methods.',
      },
      {
        href: '/payments/cash-on-delivery',
        label: 'Cash on Delivery',
        description: 'Pay-on-delivery orders.',
      },
    ],
  },
];
