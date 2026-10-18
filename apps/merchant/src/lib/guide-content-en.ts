/**
 * English version of the merchant store guide (see guide-content.ts for the
 * Bangla one). Keep both in step: same section ids, same order.
 */

import type { GuideSection } from './guide-content';

export const GUIDE_GROUPS_EN = [
  'Get started',
  'Products & stock',
  'Store design',
  'Delivery & payments',
  'Orders & customers',
  'Marketing',
  'Store settings',
  'Account',
] as const;

export const GUIDE_SECTIONS_EN: GuideSection[] = [
  /* ---------------- Get started ---------------- */
  {
    id: 'first-week',
    group: 'Get started',
    title: 'Day-one checklist: 8 steps to launch your store',
    summary: 'Finish these steps in order and your store is ready to take orders from customers.',
    steps: [
      'In **Settings → Store details**, add your phone number, support email and address. They show in your store footer.',
      'Go to **Theme**, press **Customize**, set your logo, brand colours and homepage banner, then **Publish**.',
      'Create your product categories in **Categories** (e.g. Shirts, Pants, Shoes).',
      'Add products with **Products → Add product**: images, prices and stock.',
      'In **Shipping**, check the delivery charges for inside and outside Dhaka.',
      'In **Settings → Payments**, make sure cash on delivery is on; connect SSLCommerz if you want online payments.',
      'Press **View store**, place a test order on your store, then find it in **Orders**.',
      'Share your store link on your Facebook page, posts and WhatsApp.',
    ],
    tips: [
      'A new store can have a few sample products so you can see how it looks. Once you add your own, edit or archive the samples.',
    ],
    links: [
      { href: '/dashboard/settings/store', label: 'Store details' },
      { href: '/dashboard/theme', label: 'Theme' },
      { href: '/dashboard/products/new', label: 'Add product' },
    ],
  },
  {
    id: 'dashboard-tour',
    group: 'Get started',
    title: 'Getting around the dashboard',
    summary: 'The menu on the left groups everything you need to run your store.',
    points: [
      '**Overview**: **Dashboard** shows today’s and this week’s sales; **Analytics** has the detailed numbers.',
      '**Catalog**: **Products**, **Categories** and **Inventory** (stock).',
      '**Sales**: **Orders** and **Customers**.',
      '**Payments**: records of customer payments.',
      '**Marketing**: **Coupons**, **Marketing & tracking** and **Landing pages**.',
      '**Store**: **Theme**, **Gallery**, **Domains**, **Shipping**, **Stores** and **Settings**.',
      '**Account**: **Plan & billing**, **Affiliate program**, **Help & support** and this **Store guide**.',
      'The top bar has the store selector and the **View store** button, which opens your store in a new tab.',
    ],
  },
  {
    id: 'store-info',
    group: 'Get started',
    title: 'Store name, details and contact',
    summary: 'Your store name, description, language and how customers reach you all live in Settings.',
    steps: [
      'In **Settings → General**, set **Store name**, **Description** and **Storefront language**. Prices are in BDT and the time zone is Asia/Dhaka.',
      'In **Settings → Store details**, add **Support phone**, **Support email** and **Business address**. Whatever you fill in shows in your store footer.',
      'To change your logo and favicon, press **Edit branding in Theme**.',
    ],
    links: [
      { href: '/dashboard/settings/general', label: 'General' },
      { href: '/dashboard/settings/store', label: 'Store details' },
    ],
  },

  /* ---------------- Products & stock ---------------- */
  {
    id: 'categories',
    group: 'Products & stock',
    title: 'Creating categories',
    summary: 'Categories keep products organised so customers find them easily.',
    steps: [
      'Press **Categories → Add category**.',
      'Enter a **Name**. For a category inside another, choose a **Parent category** (e.g. Fashion → Men → T-Shirts).',
      'Save. Active categories show on your store.',
    ],
    tips: [
      'To put images on the homepage category cards, use **Theme → Customize → Shop by category → Category images**.',
      'A category that still has products or sub-categories can’t be deleted. Move them first.',
    ],
    links: [{ href: '/dashboard/categories', label: 'Categories' }],
  },
  {
    id: 'add-product',
    group: 'Products & stock',
    title: 'Adding a product',
    summary: 'A product has a name, description, images, price, categories and stock.',
    steps: [
      'Press **Products → Add product**.',
      'Write the **Name** and **Short description**. For the long description, use the editor toolbar for bold text, lists and headings.',
      'Under **Product image**, upload from your computer or phone (JPEG, PNG or WebP, up to 1.5 MB each), or press **Choose from gallery** to reuse an uploaded image.',
      'Under **Pricing**, enter the **Base price**. To show a discount, put the old (higher) price in **Compare-at price**. **Cost price** is only for your own records; customers never see it.',
      'Choose one or more **Categories**.',
      'Under **Inventory**, keep **Track inventory** on and enter the stock. To keep taking orders when it runs out, turn on **Allow backorder**.',
      'Enter the **Weight** for couriers.',
      'Pick a **Status**: **Draft** (hidden for now), **Active** (on your store and for sale) or **Archived** (removed from the store). Then save.',
    ],
    tips: [
      'Deleting a product archives it: it leaves your store, but past orders keep its details.',
      'Starter holds up to 25 products and Growth up to 100; Business has no limit.',
    ],
    links: [
      { href: '/dashboard/products/new', label: 'Add product' },
      { href: '/dashboard/products', label: 'Products' },
    ],
  },
  {
    id: 'variants',
    group: 'Products & stock',
    title: 'Sizes, colours and packs (variants)',
    summary: 'When a product comes in several options, each option is a variant.',
    steps: [
      'After saving the product, open it and add variants in the variants section.',
      'Give each variant a name (e.g. M, L, Red, 500 g), SKU, price and stock.',
      'Customers pick a variant on the product page before adding to cart; each one’s stock goes down separately.',
    ],
    tips: ['Landing-page offer cards (e.g. 1 piece / 2-piece combo) are built from these variants.'],
    links: [{ href: '/dashboard/products', label: 'Products' }],
  },
  {
    id: 'inventory',
    group: 'Products & stock',
    title: 'Managing stock',
    summary: 'Stock goes down by itself when an order comes in and comes back when an order is cancelled. You adjust it when new goods arrive.',
    steps: [
      'In **Inventory**, see the **Available** (for sale) and **Reserved** stock of every product. Filter by **Low stock** or **Out of stock**.',
      'When new goods arrive, or to write off damaged items, press **Adjust**, enter the amount and a **Note**, then **Adjust stock**.',
      'To see why a product’s stock changed, open it and check **Movement history**.',
    ],
    tips: ['Record in-shop sales as adjustments too, so your online stock stays right.'],
    links: [{ href: '/dashboard/inventory', label: 'Inventory' }],
  },
  {
    id: 'gallery',
    group: 'Products & stock',
    title: 'Image gallery',
    summary: 'Every image you upload for products, categories, logo or banners is kept in one place.',
    steps: [
      'In **Gallery**, use **Upload images to the gallery** to upload several images at once.',
      'Wherever you pick an image, press **Choose from gallery** to use one from here.',
      'Need an image’s link? Press **Copy URL**.',
    ],
    tips: ['Space depends on your plan: Starter 1 GB, Growth 3 GB, Business 5 GB. See **Recommended image sizes** on the page for how big each image should be.'],
    links: [{ href: '/dashboard/gallery', label: 'Gallery' }],
  },

  /* ---------------- Store design ---------------- */
  {
    id: 'themes',
    group: 'Store design',
    title: 'Choosing a theme',
    summary: 'The theme sets the whole look of your store. You can change it any time.',
    steps: [
      'In **Theme**, your **Active theme** is at the top and the other themes are below.',
      'To switch, press **Activate**. It goes live straight away, and you can switch back.',
      'You can preview a locked theme in the editor before buying it or upgrading.',
    ],
    points: [
      '**Default**: on every plan.',
      '**Minimal**: on Growth and Business.',
      '**ShopEase** and **Kenakata** (premium): included in Business; on other plans buy them once (price shown on the Theme page, paid with bKash, Nagad, Rocket or Upay).',
    ],
    links: [{ href: '/dashboard/theme', label: 'Theme' }],
  },
  {
    id: 'theme-editor',
    group: 'Store design',
    title: 'Customizing your theme (live editor)',
    summary:
      'The editor shows settings on the left and your real store on the right, so you see every change at once. Customers see nothing until you publish.',
    steps: [
      'Press **Theme → Customize**.',
      'Click any part of the preview to open its settings. Switch between desktop, tablet and mobile at the top.',
      '**Announcement bar**: a short message at the top, such as an offer or delivery news (**Announcement text**, **Announcement link**).',
      '**Header**: **Header layout**, logo, menu (**Header menu**), search and cart.',
      '**Hero**: the big homepage banner with **Headline**, text, **Button label**, **Button link** and **Background image**.',
      '**Shop by category**: which categories show, and their **Category images**.',
      'Add, hide or reorder sections such as featured products, banners and text.',
      'Branding: **Brand name**, **Logo**, **Favicon**, button and text colours (or pick from **Color presets**), **Heading font** and **Body font**, **Base font size**, **Border radius**.',
      '**Footer**: **Footer tagline**, **Footer menu**, social links and **Copyright**.',
      'When it looks right, check the preview and press **Publish**. To start over, discard your changes.',
    ],
    tips: [
      'Category images are saved with the category, so they show in every theme at once. Every other change shows after you publish.',
      'Set how your store looks on Google in **Settings → SEO**.',
    ],
    links: [
      { href: '/dashboard/theme/editor', label: 'Theme editor' },
      { href: '/dashboard/theme', label: 'Theme' },
    ],
  },

  /* ---------------- Delivery & payments ---------------- */
  {
    id: 'shipping',
    group: 'Delivery & payments',
    title: 'Delivery charges and delivery zones',
    summary:
      'At checkout, the customer picks a division, district and upazila, and the charge for that area appears. New stores start with inside-Dhaka and outside-Dhaka charges; change them to suit you.',
    steps: [
      'In **Shipping**, use **Add zone** to create zones such as "Dhaka City" and "Outside Dhaka".',
      'Add divisions, districts or upazilas to a zone with **Add location**. If an area falls in two zones, the one with the higher **Priority** wins.',
      'Create delivery methods with **Add method**: **Name**, **Charge** and **Estimated delivery** (e.g. "1–2 days").',
      'For free delivery on big orders, set an amount in **Free shipping threshold** (e.g. 2000).',
      'Turn **COD allowed** on or off to decide whether cash on delivery works with this method.',
    ],
    tips: [
      'Methods without a zone (store-wide) cover any area that isn’t in a zone.',
      'Customers can’t check out unless at least one method is active.',
      'Separate delivery zones are on Growth and Business; Starter uses the same methods for the whole country.',
    ],
    links: [{ href: '/dashboard/shipping', label: 'Shipping' }],
  },
  {
    id: 'couriers',
    group: 'Delivery & payments',
    title: 'Connecting couriers and booking parcels',
    summary:
      'Connect Steadfast, Pathao, RedX, Paperfly or eCourier and book parcels straight from an order. The customer’s name, phone, address and cash-on-delivery amount are sent for you. Included on every plan.',
    steps: [
      'Open **Settings → Couriers**, choose your courier and enter the API details from your courier account.',
      'Under **Pickup location**, fill in **Pickup contact name**, **Pickup phone** and **Pickup address**, and set **Default parcel weight (kg)**.',
      'Open an order, pick the courier in the **Courier** box, add the weight and an optional **Note for the courier (optional)**, then press **Create shipment**.',
      'The tracking code appears after booking; press **Sync status** for delivery updates.',
    ],
    tips: [
      'RedX and eCourier ask for their own delivery area when booking. Pick it from the list.',
      'For other couriers such as Delivery Tiger, CarryBee or Karatoa, book as usual, then add a shipment on the order with the courier and tracking number.',
      'Couriers only collect whole taka, so cash-on-delivery amounts are rounded.',
    ],
    links: [
      { href: '/dashboard/settings/couriers', label: 'Couriers' },
      { href: '/dashboard/orders', label: 'Orders' },
    ],
  },
  {
    id: 'payments',
    group: 'Delivery & payments',
    title: 'How customers pay',
    summary: 'How customers pay you: cash on delivery, bank transfer or online.',
    plan: 'Online payments: Growth & Business',
    steps: [
      'Open **Settings → Payments**.',
      'Keep **Cash on delivery** on. Most customers in Bangladesh prefer it.',
      'To take bank payments, turn on **Bank transfer** and fill in **Bank details shown to customers** and **Instructions for customers**.',
      'To take bKash, Nagad and cards online, enter your SSLCommerz store ID and store password, choose sandbox or **Live** mode, test the connection and turn it on.',
      'For international cards, add your Stripe keys (Business plan only).',
    ],
    tips: [
      'Online payments (SSLCommerz) are on Growth and Business.',
      'An order becomes "Paid" only when the online payment provider confirms it. Refunds are made from the provider’s own panel.',
      'Which delivery methods allow cash on delivery is set in **Shipping**.',
    ],
    links: [{ href: '/dashboard/settings/payments', label: 'Payment settings' }],
  },

  /* ---------------- Orders & customers ---------------- */
  {
    id: 'orders',
    group: 'Orders & customers',
    title: 'Handling orders and invoices',
    summary:
      'Every order has three separate states: the order status, the payment status and fulfillment (whether it has been sent).',
    steps: [
      'See new orders in **Orders**. Filter by status, payment, fulfillment or date.',
      'Open an order to see the items, customer phone, address and delivery method.',
      'Call the customer to confirm, then move the order along with **Change status…** (e.g. Confirmed → Processing).',
      'To send the parcel, press **Create shipment** in the **Courier** box, or add a shipment yourself with the tracking number.',
      'When you receive the cash-on-delivery money, mark the payment "Paid" with **Change payment…**.',
      'To send with the parcel or to the customer, press **Invoice** at the top of the order, then **Print / Save as PDF**. The invoice has your store logo, the customer’s address, products, delivery charge and total.',
      'Use **Internal note** for notes to yourself. Customers don’t see them.',
      'To cancel, press **Cancel order** and optionally fill in **Customer-facing reason (optional)**. Stock for cancelled items comes back by itself.',
    ],
    tips: [
      'Customers can check their order on your store’s order tracking page with the order number and phone or email, so adding tracking numbers cuts down "where is my order?" questions.',
      'New orders show as a red count badge in the menu.',
      'Invoices carry a **PAID**, **DUE** or **CANCELLED** stamp. For cash on delivery they show "Amount due", so it’s clear how much the courier collects. The address and phone on invoices come from **Settings → Store details**, so keep them filled in.',
    ],
    links: [{ href: '/dashboard/orders', label: 'Orders' }],
  },
  {
    id: 'customers',
    group: 'Orders & customers',
    title: 'Customers',
    summary: 'Customers order without an account. Their name, phone and address are saved with each order.',
    steps: [
      'Search customers by name, email or phone in **Customers**.',
      'To add one yourself, fill in **First name**, **Last name**, **Email**, **Phone** and **Notes**.',
    ],
    tips: ['Only customers with no orders can be deleted.'],
    links: [{ href: '/dashboard/customers', label: 'Customers' }],
  },
  {
    id: 'payment-records',
    group: 'Orders & customers',
    title: 'Payment records',
    summary: 'Every customer payment: which order, how much, which method and its status.',
    steps: ['Search by order number in **Payments** to find a payment.'],
    links: [{ href: '/dashboard/payments', label: 'Payments' }],
  },
  {
    id: 'analytics',
    group: 'Orders & customers',
    title: 'Sales and visitor reports',
    summary: 'How much you sold, which products sell best and where visitors come from.',
    points: [
      '**Dashboard** shows today’s and this week’s sales.',
      '**Analytics** shows sales and orders over time and your best-selling products.',
      'Growth and Business add visitors, conversion rate, traffic sources (Facebook, Google…), the shopping funnel, any date range and CSV download.',
      'Starter shows sales for the last 30 days.',
      'Visitors are counted without cookies; there’s nothing to set up.',
    ],
    links: [{ href: '/dashboard/analytics', label: 'Analytics' }],
  },

  /* ---------------- Marketing ---------------- */
  {
    id: 'coupons',
    group: 'Marketing',
    title: 'Coupons and discounts',
    summary: 'Run offers with coupon codes. Every rule is checked on the server, so nobody can go past a limit.',
    plan: 'Growth & Business',
    steps: [
      'Press **Coupons → New coupon**.',
      'Enter a code (e.g. EID20) and choose the discount type: a percentage (e.g. 10%) or a fixed amount (e.g. ৳200).',
      'Optionally set a minimum order, maximum discount, total usage limit and per-customer limit.',
      'Set start and end dates and save. You can switch a coupon off at any time.',
    ],
    tips: ['Coupons apply to the cart subtotal. For free delivery, use the delivery method’s **Free shipping threshold**.'],
    links: [{ href: '/dashboard/coupons/new', label: 'New coupon' }],
  },
  {
    id: 'tracking',
    group: 'Marketing',
    title: 'Facebook Pixel and Google Analytics',
    summary:
      'Paste an ID and the tag goes on your store, with shopping events (view product, add to cart, checkout, purchase) sent for you.',
    plan: 'Growth & Business',
    steps: [
      'Open **Marketing & tracking**.',
      'Under **Facebook (Meta) Pixel**, enter the **Pixel ID** (numbers only) from Meta Events Manager.',
      'Under **Google Tag Manager**, enter the **Container ID** (GTM-XXXXXXX), or under **Google Analytics 4**, the **Measurement ID** (G-XXXXXXXXXX).',
      'To verify your store with Google Search, enter the **Verification tag** under **Google Search Console**.',
      'Press **Where do I find it?** on each card to see where to get the ID.',
    ],
    links: [{ href: '/dashboard/tracking', label: 'Marketing & tracking' }],
  },
  {
    id: 'landing-pages',
    group: 'Marketing',
    title: 'Landing pages (for Facebook ads)',
    summary:
      'A one-page offer with its own order form. Customers order right on the page and the orders arrive in **Orders**.',
    plan: 'Growth (5) & Business (unlimited)',
    steps: [
      'Press **Landing pages → New landing page**.',
      'Pick one of 10 designs (single product, festival sale, fashion, food & health, gadgets, beauty, kids, home & kitchen and more) and enter a **Page name**.',
      'In the editor, choose your products under **Page settings → Products**. Prices and stock come from your catalog.',
      'Under **Sections**, change each part’s text and images, and hide or reorder parts. Change the two main colours under **Colours**.',
      'Add a timer under **Offer timer**: a few hours per visitor, or until a fixed date.',
      'Under **Search & sharing**, set the title, description and **Share image** shown on Google and when the link is shared.',
      'Publish, press **View live ↗**, then use the /lp/… link in your ads.',
    ],
    tips: [
      'Every order remembers which landing page it came from, so you can see which page sells best.',
      '**Unpublish** takes the page and link offline, but past orders stay.',
    ],
    links: [{ href: '/dashboard/landing-pages', label: 'Landing pages' }],
  },

  /* ---------------- Store settings ---------------- */
  {
    id: 'domains',
    group: 'Store settings',
    title: 'Connecting your own domain',
    summary: 'Every store gets a free Ecomesta address. You can also connect your own domain (e.g. yourbrand.com).',
    plan: 'Growth & Business',
    steps: [
      'In **Domains**, press **Add custom domain** and enter the domain (e.g. shop.example.com).',
      'Add the TXT record shown under **DNS verification** at your domain provider’s DNS, then verify.',
      'Point the domain at Ecomesta with a CNAME or A record at your domain provider, then turn it on.',
      'With more than one address, make one **Primary**. Google treats it as your main address.',
    ],
    tips: ['DNS changes can take a while. If you get stuck, tell us in **Help & support**.'],
    links: [{ href: '/dashboard/domains', label: 'Domains' }],
  },
  {
    id: 'seo',
    group: 'Store settings',
    title: 'How your store looks on Google and when shared (SEO)',
    summary: 'What shows in search results and when your link is shared on Facebook or WhatsApp.',
    steps: [
      'Open **Settings → SEO**.',
      'Fill in **Page title**, **Meta description** and **Keywords**. The **Search result preview** shows how it looks on Google.',
      'For sharing, fill in **Share title**, **Share description** and **Share image URL**.',
      'Keep **Allow search engines to index this store** on so your store shows on Google.',
    ],
    links: [{ href: '/dashboard/settings/seo', label: 'SEO' }],
  },
  {
    id: 'checkout-settings',
    group: 'Store settings',
    title: 'Checkout, orders and notifications',
    summary: 'What customers give at checkout, what they can do after ordering, and who gets emails.',
    points: [
      '**Settings → Checkout**: turn on **Allow order notes** for delivery instructions. Guest checkout, phone number and address are always on.',
      '**Settings → Orders**: with **Let customers cancel their own orders** on, customers can cancel their own order under certain conditions.',
      '**Settings → Notifications**: see which emails go to you and to customers.',
    ],
    links: [
      { href: '/dashboard/settings/checkout', label: 'Checkout' },
      { href: '/dashboard/settings/orders', label: 'Orders settings' },
      { href: '/dashboard/settings/notifications', label: 'Notifications' },
    ],
  },
  {
    id: 'stores',
    group: 'Store settings',
    title: 'More than one store',
    summary: 'If your account has several stores, switch between them from the top menu.',
    steps: ['See all your stores in **Stores** and press **Select** to choose the one to work on. Each store has its own products, orders and settings.'],
    links: [{ href: '/dashboard/stores', label: 'Stores' }],
  },
  {
    id: 'danger-zone',
    group: 'Store settings',
    title: 'Disabling or deleting a store',
    summary: 'Use with care. These are big changes.',
    points: [
      '**Settings → Danger zone → Disable storefront**: closes your store to customers for now; you can turn it back on.',
      '**Delete store**: removes the store for good. It can’t be undone.',
    ],
    links: [{ href: '/dashboard/settings/danger-zone', label: 'Danger zone' }],
  },

  /* ---------------- Account ---------------- */
  {
    id: 'billing',
    group: 'Account',
    title: 'Plan, free trial, payment and invoices',
    summary: 'Your Ecomesta plan, when it ends, and how to pay.',
    steps: [
      'In **Plan & billing**, see your plan, its status and end date. On a free trial, it also shows when the trial ends.',
      'Choose a plan and period (monthly, 6 months with 10% off, yearly with 25% off), then press **Continue to payment →**.',
      'Send the money to the number shown with bKash, Nagad, Rocket or Upay, then enter the number you sent from and the transaction ID.',
      'Once the Ecomesta team confirms the payment (usually within a few hours), your plan is active and you get an email.',
      'For an invoice of a confirmed payment, press **Invoice** next to it in **Payment history**, then **Print / Save as PDF**.',
    ],
    tips: [
      'Pay during the trial and the paid period starts on the day the trial ends. You don’t lose any days.',
      'When your plan ends you get 7 extra days with the store still open. If you don’t pay by then, the store is paused; products, orders and settings are all kept, and it reopens as soon as you pay.',
      'Only the account owner or an admin can pay for the plan.',
    ],
    links: [{ href: '/dashboard/billing', label: 'Plan & billing' }],
  },
  {
    id: 'affiliate',
    group: 'Account',
    title: 'Affiliate program',
    summary: 'Bring other businesses to Ecomesta and earn 20% of their first plan payment.',
    steps: [
      'Apply in **Affiliate program**. Once approved, your own link appears.',
      'Share the link. If someone signs up through it within 30 days and pays for their first plan, you earn 20%.',
      'After a 7-day hold, withdraw from ৳500 to bKash, Nagad, Rocket or Upay.',
    ],
    links: [{ href: '/dashboard/affiliate', label: 'Affiliate program' }],
  },
  {
    id: 'help',
    group: 'Account',
    title: 'Need help?',
    summary: 'If you get stuck anywhere, the Ecomesta team will help.',
    points: [
      'In **Help & support**, pick a topic and send a message. Your request reaches us with your store details.',
      'Phone: 09697-493407 (also on WhatsApp).',
      'The chat button on our website answers quick questions instantly.',
    ],
    links: [{ href: '/dashboard/support', label: 'Help & support' }],
  },
];
