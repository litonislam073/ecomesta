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
          'Sign up with your store name and store address, choose a plan and billing period, and pay for it with bKash, Nagad, Rocket or Upay in the last step. Your store is created right away in Bangladeshi Taka with the Asia/Dhaka time zone, so you can start adding products while the Ecomesta team confirms your payment — usually within a few hours. The store goes live for customers once the payment is confirmed.',
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
      'Product and category images uploaded from your computer',
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
          'Give a category a picture from the theme editor (Theme → Customize → Shop by category → Category images) and it appears on the category cards of your homepage.',
        ],
      },
      {
        heading: 'Product images and the gallery',
        paragraphs: [
          'Upload product photos (JPEG, PNG or WebP, up to 1.5 MB each) straight from your computer or phone. Every image you upload — for products, categories, your logo or banners — is kept in your store’s Gallery, so you can reuse it anywhere with “Choose from gallery”. Storage depends on your plan: 1 GB on Starter, 3 GB on Growth and 5 GB on Business.',
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
        heading: 'Book courier parcels from the order',
        paragraphs: [
          'Connect Steadfast, Pathao, RedX, Paperfly and eCourier once in Settings → Couriers with the API details from your courier account. Then book a parcel straight from an order: the customer’s name, phone, address, the items and the cash-on-delivery amount are sent for you, and the courier’s consignment or tracking ID is saved on the shipment. Refresh the delivery status from the order at any time.',
          'Courier booking is available on every plan. RedX and eCourier ask for their own delivery area (eCourier: package, city, thana, post code and area), picked from the courier’s list when booking. Delivery Tiger, CarryBee and Karatoa Courier are not connected for direct booking yet — book with the courier as usual, then pick it on the order’s shipment and add the tracking number. Customers see the courier and tracking number on the order tracking page.',
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
        question: 'Are courier companies connected?',
        answer:
          'Steadfast, Pathao, RedX, Paperfly and eCourier are connected: add the API details from your courier account in Settings → Couriers, then book parcels and refresh their delivery status from each order. Delivery Tiger, CarryBee and Karatoa Courier are not connected for direct booking yet — book with them as usual, then choose the courier on the order’s shipment and add the tracking number.',
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
    slug: 'marketing-tracking',
    name: 'Marketing & Tracking',
    title: 'Facebook Pixel & Google Analytics for Your Store | Ecomesta',
    description:
      'Connect Facebook Pixel, Google Tag Manager, Google Analytics 4 and Search Console to your Ecomesta store by pasting an ID — shopping events are sent for you.',
    eyebrow: 'Marketing & tracking',
    h1: 'Measure your ads and visitors without touching code',
    intro:
      'Paste your Pixel ID, Container ID or Measurement ID in Marketing → Marketing & tracking and Ecomesta installs the tags on your storefront. The shopping events your ads need are sent automatically.',
    summary: 'Facebook Pixel, Google Tag Manager, GA4 and Search Console.',
    highlights: [
      'Facebook (Meta) Pixel',
      'Google Tag Manager',
      'Google Analytics 4',
      'Google Search Console verification',
      'Included on Growth and Business',
    ],
    sections: [
      {
        heading: 'Four integrations, one page',
        bullets: [
          'Facebook Pixel — paste the Pixel ID (numbers only) from Meta Events Manager',
          'Google Tag Manager — paste the Container ID (GTM-XXXXXXX)',
          'Google Analytics 4 — paste the Measurement ID (G-XXXXXXXXXX)',
          'Google Search Console — paste the verification tag or code to verify your store',
        ],
        paragraphs: [
          'Each card shows whether it is connected, with a short guide and a link to the vendor’s page. Remove an integration at any time.',
        ],
      },
      {
        heading: 'Shopping events sent for you',
        flow: ['Page view', 'View product', 'Add to cart', 'Begin checkout', 'Purchase'],
        paragraphs: [
          'Ecomesta sends these standard events to Facebook Pixel (PageView, ViewContent, AddToCart, InitiateCheckout, Purchase) and Google Analytics (page_view, view_item, add_to_cart, begin_checkout, purchase), with product and order values in BDT. A purchase is reported once per order.',
        ],
      },
      {
        heading: 'Which plans include it',
        paragraphs: [
          'Marketing & tracking is included on the Growth and Business plans. On Starter the page shows what is available and how to upgrade from Plan & billing.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I add Facebook Pixel to my Ecomesta store?',
        answer:
          'Yes, on the Growth and Business plans. Open Marketing → Marketing & tracking, paste your Pixel ID and save. Page views, product views, add to cart, checkout and purchases are tracked automatically.',
      },
      {
        question: 'Can I connect Google Analytics, Tag Manager or Search Console?',
        answer:
          'Yes, on Growth and Business. Paste your GA4 Measurement ID, Tag Manager Container ID or Search Console verification tag on the Marketing & tracking page.',
      },
      {
        question: 'Do I need to edit code?',
        answer: 'No. You only paste the IDs; Ecomesta adds the tags to every storefront page.',
      },
    ],
    related: [
      {
        href: '/features/coupons',
        label: 'Coupons',
        description: 'Run discounts for your campaigns.',
      },
      {
        href: '/features/store-customization',
        label: 'Store customization',
        description: 'Themes and the live editor.',
      },
      {
        href: '/pricing',
        label: 'Pricing',
        description: 'Growth and Business plans.',
      },
    ],
  },
  {
    hub: 'features',
    slug: 'store-customization',
    name: 'Store Customization',
    title: 'Themes and Live Theme Editor for Your Online Store | Ecomesta',
    description:
      'Pick Default, Minimal or the premium ShopEase theme and customize it in a live editor: logo, colours, fonts, homepage sections you can reorder, and SEO.',
    eyebrow: 'Themes & store design',
    h1: 'Make the storefront look like your brand',
    intro:
      'Choose a theme from the theme library, then customize it in a live editor that shows your real store as you type. Work on a draft and publish when you are happy — your live store stays untouched until then.',
    summary: 'Theme library, live theme editor, homepage sections and SEO.',
    highlights: [
      'Theme library: Default, Minimal and premium ShopEase',
      'Live editor with desktop, tablet and mobile preview',
      'Add, hide and reorder homepage sections',
      'Upload images or choose them from your gallery',
      'Draft, preview and publish',
    ],
    sections: [
      {
        heading: 'Theme library',
        paragraphs: [
          'Open Theme in the dashboard to see your active theme with its Customize button, and the other themes with an Activate button. Activating a theme puts it on your store right away, and you can switch back any time.',
        ],
        bullets: [
          'Default — free on every plan',
          'Minimal — a quieter, clean layout, included on Growth and Business',
          'ShopEase — a premium theme with a bold hero, category cards and a deal of the day; included on Business, and available on other plans as a one-time purchase (price shown in the dashboard, paid with bKash, Nagad, Rocket or Upay and confirmed by the Ecomesta team)',
          'Locked themes can be previewed in the editor before you upgrade or buy',
        ],
      },
      {
        heading: 'A live theme editor',
        paragraphs: [
          'The editor shows your real storefront next to the settings. Click any section in the preview to open its settings, switch between desktop, tablet and mobile, and move between the home page, all products, cart and order tracking pages.',
        ],
      },
      {
        heading: 'Homepage sections',
        bullets: [
          'Announcement bar for offers or delivery notices, with an optional link',
          'Header layout (classic, centred or minimal), sticky header, search, cart and navigation menu',
          'Hero with headline, text, button and background image; in ShopEase also a discount badge (automatic, custom text or hidden)',
          'Categories row with your chosen categories and their images',
          'Featured products, newest automatically or hand-picked',
          'Deal of the day in ShopEase: heading, text, button, countdown and the product on offer',
          'Rich text and image banner sections you can add more than once',
          'Show, hide and reorder sections; footer tagline, menu, social links and payment icons',
        ],
      },
      {
        heading: 'Branding and typography',
        bullets: [
          'Brand name, tagline, logo and favicon — uploaded or chosen from your gallery',
          'Brand colours for buttons, text, backgrounds and borders',
          'Heading and body fonts from a curated list, and the base font size',
          'Corner radius for a softer or sharper look',
        ],
      },
      {
        heading: 'SEO settings',
        paragraphs: [
          'Set the title, description, keywords and social share image your store uses in search results and in link previews on Facebook and WhatsApp.',
        ],
      },
      {
        heading: 'Safe publishing',
        flow: ['Edit draft', 'Preview', 'Publish'],
        paragraphs: [
          'Changes are saved to a draft first. Preview the draft on your storefront, then publish — or reset to start over. Category images are the exception: they belong to the category, so they are saved at once and shown in every theme.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I upload images directly?',
        answer:
          'Yes. Upload your logo, favicon, hero and banner images, product photos and category images from your computer or phone (JPEG, PNG or WebP, up to 1.5 MB). Every upload is kept in your store’s Gallery so you can reuse it, and you can still paste an image URL if you prefer.',
      },
      {
        question: 'Will editing the theme affect my live store immediately?',
        answer:
          'No. You edit a draft and can preview it. Customers see the changes only after you publish. Category images are saved straight to the category and show at once.',
      },
      {
        question: 'Which themes are included in my plan?',
        answer:
          'Starter includes the Default theme. Growth adds Minimal. Business includes every theme, including the premium ShopEase theme. On Starter or Growth you can buy a premium theme once from the Theme page.',
      },
      {
        question: 'How do I add images to my categories?',
        answer:
          'Open Theme, click Customize, choose the Shop by category section and use Category images: pick a category, upload an image or choose one from your gallery, and save. The picture appears on the homepage category cards.',
      },
    ],
    related: [
      {
        href: '/features/marketing-tracking',
        label: 'Marketing & tracking',
        description: 'Connect Facebook Pixel and Google Analytics.',
      },
      {
        href: '/features/custom-domain',
        label: 'Custom domain',
        description: 'Serve your store on your own domain.',
      },
      {
        href: '/pricing',
        label: 'Pricing',
        description: 'Which themes each plan includes.',
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
