/**
 * The merchant store guide shown at /dashboard/guide. Written in Bangla; the
 * dashboard's own button and menu names stay in English (wrapped in **…**) so
 * merchants can find them on screen. Keep it in step with the dashboard.
 */

export interface GuideLink {
  href: string;
  label: string;
}

export interface GuideSection {
  id: string;
  group: string;
  title: string;
  summary: string;
  /** Plans that include it, when not every plan does. */
  plan?: string;
  steps?: string[];
  points?: string[];
  tips?: string[];
  links?: GuideLink[];
}

export const GUIDE_GROUPS = [
  'শুরু করুন',
  'প্রোডাক্ট ও স্টক',
  'স্টোরের ডিজাইন',
  'ডেলিভারি ও পেমেন্ট',
  'অর্ডার ও কাস্টমার',
  'মার্কেটিং',
  'স্টোরের সেটিং',
  'অ্যাকাউন্ট',
] as const;

export const GUIDE_SECTIONS: GuideSection[] = [
  /* ---------------- শুরু করুন ---------------- */
  {
    id: 'first-week',
    group: 'শুরু করুন',
    title: 'প্রথম দিনের চেকলিস্ট: স্টোর চালু করার ৮টি ধাপ',
    summary:
      'স্টোর খোলার পর এই ধাপগুলো ক্রমানুসারে শেষ করলে আপনার স্টোর কাস্টমারের কাছ থেকে অর্ডার নেওয়ার জন্য পুরোপুরি তৈরি হয়ে যাবে।',
    steps: [
      '**Settings → Store details**-এ ফোন নম্বর, সাপোর্ট ইমেইল আর ঠিকানা দিন — এগুলো স্টোরের ফুটারে দেখায়।',
      '**Theme**-এ গিয়ে **Customize** চাপুন, লোগো, ব্র্যান্ডের রং আর হোমপেজের ব্যানার ঠিক করে **Publish** করুন।',
      '**Categories**-এ প্রোডাক্টের ক্যাটাগরি বানান (যেমন শার্ট, প্যান্ট, জুতা)।',
      '**Products → Add product** দিয়ে প্রোডাক্ট যোগ করুন — ছবি, দাম আর স্টকসহ।',
      '**Shipping**-এ ঢাকার ভেতরে আর বাইরের ডেলিভারি চার্জ মিলিয়ে নিন।',
      '**Settings → Payments**-এ ক্যাশ অন ডেলিভারি চালু আছে কিনা দেখুন; চাইলে SSLCommerz যুক্ত করুন।',
      '**View store** চেপে নিজের স্টোর খুলে একটি পরীক্ষামূলক অর্ডার দিন, তারপর **Orders**-এ দেখুন।',
      'স্টোরের লিংক ফেসবুক পেজ, পোস্ট আর হোয়াটসঅ্যাপে শেয়ার করুন।',
    ],
    tips: [
      'নতুন স্টোরে চাইলে কয়েকটি নমুনা প্রোডাক্ট যোগ করে দেখে নিতে পারেন স্টোর কেমন দেখাবে; নিজের প্রোডাক্ট দিলে সেগুলো এডিট বা আর্কাইভ করে দিন।',
    ],
    links: [
      { href: '/dashboard/settings/store', label: 'Store details' },
      { href: '/dashboard/theme', label: 'Theme' },
      { href: '/dashboard/products/new', label: 'Add product' },
    ],
  },
  {
    id: 'dashboard-tour',
    group: 'শুরু করুন',
    title: 'ড্যাশবোর্ড চেনা',
    summary: 'বাঁ দিকের মেনুতে স্টোর চালানোর সব কিছু ভাগ করে সাজানো আছে।',
    points: [
      '**Overview** — **Dashboard**-এ আজকের আর এই সপ্তাহের বিক্রি, আর **Analytics**-এ বিস্তারিত হিসাব।',
      '**Catalog** — **Products**, **Categories** আর **Inventory** (স্টক)।',
      '**Sales** — **Orders** আর **Customers**।',
      '**Payments** — কাস্টমারের পেমেন্টের রেকর্ড।',
      '**Marketing** — **Coupons**, **Marketing & tracking** আর **Landing pages**।',
      '**Store** — **Theme**, **Gallery**, **Domains**, **Shipping**, **Stores** আর **Settings**।',
      '**Account** — **Plan & billing**, **Affiliate program**, **Help & support** আর এই **Store guide**।',
      'উপরের বারে স্টোর বাছাইয়ের মেনু আর **View store** বাটন আছে — **View store** নতুন ট্যাবে আপনার স্টোর খোলে।',
    ],
  },
  {
    id: 'store-info',
    group: 'শুরু করুন',
    title: 'স্টোরের নাম, তথ্য আর যোগাযোগ',
    summary: 'স্টোরের নাম, বিবরণ, ভাষা আর কাস্টমার কীভাবে যোগাযোগ করবে — সব সেটিংয়ে।',
    steps: [
      '**Settings → General**-এ **Store name**, **Description** আর **Storefront language** ঠিক করুন। দাম টাকায় (BDT) আর সময় Asia/Dhaka থাকে।',
      '**Settings → Store details**-এ **Support phone**, **Support email** আর **Business address** দিন। যেগুলো দেবেন, সেগুলো স্টোরের ফুটারে দেখাবে।',
      'লোগো আর ফেভিকন বদলাতে **Edit branding in Theme** চাপুন।',
    ],
    links: [
      { href: '/dashboard/settings/general', label: 'General' },
      { href: '/dashboard/settings/store', label: 'Store details' },
    ],
  },

  /* ---------------- প্রোডাক্ট ও স্টক ---------------- */
  {
    id: 'categories',
    group: 'প্রোডাক্ট ও স্টক',
    title: 'ক্যাটাগরি বানানো',
    summary: 'ক্যাটাগরি দিয়ে প্রোডাক্ট গুছিয়ে রাখুন, যাতে কাস্টমার সহজে খুঁজে পান।',
    steps: [
      '**Categories → Add category** চাপুন।',
      '**Name** দিন। ক্যাটাগরির ভেতরে ক্যাটাগরি চাইলে **Parent category** বেছে নিন (যেমন Fashion → Men → T-Shirts)।',
      'সেভ করুন। অ্যাকটিভ ক্যাটাগরিগুলো স্টোরে দেখায়।',
    ],
    tips: [
      'হোমপেজের ক্যাটাগরি কার্ডে ছবি দিতে **Theme → Customize → Shop by category → Category images** ব্যবহার করুন।',
      'কোনো ক্যাটাগরিতে প্রোডাক্ট বা সাব-ক্যাটাগরি থাকলে সেটি ডিলিট করা যায় না — আগে সেগুলো সরান।',
    ],
    links: [{ href: '/dashboard/categories', label: 'Categories' }],
  },
  {
    id: 'add-product',
    group: 'প্রোডাক্ট ও স্টক',
    title: 'প্রোডাক্ট যোগ করা',
    summary: 'একটি প্রোডাক্টে নাম, বিবরণ, ছবি, দাম, ক্যাটাগরি আর স্টক থাকে।',
    steps: [
      '**Products → Add product** চাপুন।',
      '**Name** আর **Short description** লিখুন। বড় বিবরণের জন্য এডিটরের টুলবার দিয়ে বোল্ড, তালিকা আর শিরোনাম দিতে পারেন।',
      '**Product image**-এ কম্পিউটার বা ফোন থেকে ছবি আপলোড করুন (JPEG, PNG বা WebP, প্রতিটি সর্বোচ্চ 1.5 MB), অথবা **Choose from gallery** দিয়ে আগে আপলোড করা ছবি বাছুন।',
      '**Pricing**-এ **Base price** দিন। ছাড় দেখাতে **Compare-at price**-এ আগের (বেশি) দাম দিন। **Cost price** শুধু আপনার হিসাবের জন্য, কাস্টমার দেখেন না।',
      '**Categories**-এ এক বা একাধিক ক্যাটাগরি বাছুন।',
      '**Inventory**-এ **Track inventory** চালু রেখে স্টকের পরিমাণ দিন। স্টক শেষ হলেও অর্ডার নিতে চাইলে **Allow backorder** চালু করুন।',
      'কুরিয়ারের জন্য **Weight** দিন।',
      '**Status** বেছে নিন: **Draft** (এখনো লুকানো), **Active** (স্টোরে দেখায় আর কেনা যায়) বা **Archived** (স্টোর থেকে সরানো)। তারপর সেভ করুন।',
    ],
    tips: [
      'প্রোডাক্ট ডিলিট করলে সেটি আর্কাইভ হয় — স্টোর থেকে সরে যায়, কিন্তু আগের অর্ডারে তথ্য থেকে যায়।',
      'Starter প্যাকেজে ২৫টি আর Growth-এ ১০০টি পর্যন্ত প্রোডাক্ট রাখা যায়; Business-এ যত খুশি রাখা যায়।',
    ],
    links: [
      { href: '/dashboard/products/new', label: 'Add product' },
      { href: '/dashboard/products', label: 'Products' },
    ],
  },
  {
    id: 'variants',
    group: 'প্রোডাক্ট ও স্টক',
    title: 'সাইজ, রং আর প্যাকেট (ভ্যারিয়েন্ট)',
    summary: 'একটি প্রোডাক্টের কয়েকটি অপশন থাকলে প্রতিটি অপশন একটি ভ্যারিয়েন্ট।',
    steps: [
      'প্রোডাক্ট সেভ করার পর প্রোডাক্টটি খুলুন, ভ্যারিয়েন্ট অংশে নতুন ভ্যারিয়েন্ট যোগ করুন।',
      'প্রতিটি ভ্যারিয়েন্টের নাম (যেমন M, L, লাল, ৫০০ গ্রাম), SKU, দাম আর স্টক দিন।',
      'কাস্টমার প্রোডাক্ট পেজে ভ্যারিয়েন্ট বেছে কার্টে যোগ করেন; প্রতিটির স্টক আলাদা কমে।',
    ],
    tips: ['ল্যান্ডিং পেজের অফার কার্ড (যেমন ১ পিস / ২ পিস কম্বো) এই ভ্যারিয়েন্ট থেকেই তৈরি হয়।'],
    links: [{ href: '/dashboard/products', label: 'Products' }],
  },
  {
    id: 'inventory',
    group: 'প্রোডাক্ট ও স্টক',
    title: 'স্টক সামলানো',
    summary: 'অর্ডার হলে স্টক নিজে থেকে কমে, অর্ডার বাতিল হলে ফেরত আসে। নতুন মাল এলে আপনি সমন্বয় করেন।',
    steps: [
      '**Inventory**-এ সব প্রোডাক্টের **Available** (বিক্রির জন্য পাওয়া যায়) আর **Reserved** স্টক দেখুন। **Low stock** বা **Out of stock** দিয়ে ফিল্টার করুন।',
      'নতুন মাল এলে বা নষ্ট জিনিস বাদ দিতে **Adjust** চাপুন, পরিমাণ আর **Note** লিখে **Adjust stock** করুন।',
      'কোনো প্রোডাক্টের স্টক কেন বদলেছে দেখতে সেটি খুলে **Movement history** দেখুন।',
    ],
    tips: ['দোকানে সরাসরি বিক্রি হলে সেটিও সমন্বয় হিসেবে লিখে রাখুন, যাতে অনলাইনের স্টক ঠিক থাকে।'],
    links: [{ href: '/dashboard/inventory', label: 'Inventory' }],
  },
  {
    id: 'gallery',
    group: 'প্রোডাক্ট ও স্টক',
    title: 'ছবির গ্যালারি',
    summary: 'প্রোডাক্ট, ক্যাটাগরি, লোগো বা ব্যানারের জন্য আপলোড করা সব ছবি এক জায়গায় থাকে।',
    steps: [
      '**Gallery**-তে **Upload images to the gallery** দিয়ে একসাথে কয়েকটি ছবি আপলোড করুন।',
      'যেকোনো ছবি বাছার জায়গায় **Choose from gallery** চেপে এখান থেকে ছবি নিন।',
      'ছবির লিংক লাগলে **Copy URL** চাপুন।',
    ],
    tips: ['জায়গা প্যাকেজ অনুযায়ী: Starter 1 GB, Growth 3 GB, Business 5 GB। পেজের **Recommended image sizes** অংশে কোন ছবি কত বড় হওয়া উচিত দেখুন।'],
    links: [{ href: '/dashboard/gallery', label: 'Gallery' }],
  },

  /* ---------------- স্টোরের ডিজাইন ---------------- */
  {
    id: 'themes',
    group: 'স্টোরের ডিজাইন',
    title: 'থিম বাছাই',
    summary: 'থিম আপনার স্টোরের পুরো চেহারা ঠিক করে। যেকোনো সময় বদলানো যায়।',
    steps: [
      '**Theme**-এ উপরে আপনার **Active theme** আর নিচে অন্য থিমগুলো দেখুন।',
      'অন্য থিম চাইলে **Activate** চাপুন — সাথে সাথে স্টোরে বসে যায়, আর আগেরটায় ফেরা যায়।',
      'লক করা থিম কেনা বা আপগ্রেডের আগে এডিটরে প্রিভিউ করে দেখতে পারেন।',
    ],
    points: [
      '**Default** — সব প্যাকেজে।',
      '**Minimal** — Growth আর Business প্যাকেজে।',
      '**ShopEase** আর **Kenakata** (প্রিমিয়াম) — Business-এ আছে; অন্য প্যাকেজে একবার কিনে নেওয়া যায় (দাম Theme পেজে দেখায়, bKash, Nagad, Rocket বা Upay দিয়ে পেমেন্ট)।',
    ],
    links: [{ href: '/dashboard/theme', label: 'Theme' }],
  },
  {
    id: 'theme-editor',
    group: 'স্টোরের ডিজাইন',
    title: 'থিম কাস্টমাইজ করা (লাইভ এডিটর)',
    summary:
      'এডিটরে বাঁ পাশে সেটিং আর ডান পাশে আপনার আসল স্টোর দেখায় — যা বদলাবেন সাথে সাথে দেখতে পাবেন। পাবলিশ না করা পর্যন্ত কাস্টমার কিছু দেখেন না।',
    steps: [
      '**Theme → Customize** চাপুন।',
      'প্রিভিউতে যেকোনো অংশে ক্লিক করলে তার সেটিং খোলে। উপরে থেকে ডেস্কটপ, ট্যাবলেট আর মোবাইলে বদলে দেখুন।',
      '**Announcement bar** — উপরের ছোট বার্তা, যেমন অফার বা ডেলিভারির খবর (**Announcement text**, **Announcement link**)।',
      '**Header** — **Header layout**, লোগো, মেনু (**Header menu**), সার্চ আর কার্ট।',
      '**Hero** — হোমপেজের বড় ব্যানার: **Headline**, লেখা, **Button label** আর **Button link**, আর **Background image**।',
      '**Shop by category** — কোন ক্যাটাগরি দেখাবে আর **Category images**।',
      'ফিচার্ড প্রোডাক্ট, ব্যানার আর লেখার সেকশন যোগ করুন, লুকান বা উপরে-নিচে সাজান।',
      'ব্র্যান্ডিং: **Brand name**, **Logo**, **Favicon**, বোতাম আর লেখার রং (**Color presets** থেকেও বাছা যায়), **Heading font** ও **Body font**, **Base font size**, **Border radius**।',
      '**Footer** — **Footer tagline**, **Footer menu**, সোশ্যাল লিংক আর **Copyright**।',
      'সব ঠিক হলে প্রিভিউ দেখে **Publish** করুন। বাতিল করতে চাইলে পরিবর্তন discard করুন।',
    ],
    tips: [
      'ক্যাটাগরির ছবি ক্যাটাগরির সাথেই সেভ হয়, তাই সাথে সাথে সব থিমে দেখায় — বাকি সব পরিবর্তন পাবলিশের পরে দেখায়।',
      'স্টোর গুগলে কেমন দেখাবে তা **Settings → SEO**-তে ঠিক করুন।',
    ],
    links: [
      { href: '/dashboard/theme/editor', label: 'Theme editor' },
      { href: '/dashboard/theme', label: 'Theme' },
    ],
  },

  /* ---------------- ডেলিভারি ও পেমেন্ট ---------------- */
  {
    id: 'shipping',
    group: 'ডেলিভারি ও পেমেন্ট',
    title: 'ডেলিভারি চার্জ আর ডেলিভারি জোন',
    summary:
      'কাস্টমার চেকআউটে বিভাগ, জেলা আর উপজেলা বাছলেই সেই এলাকার ডেলিভারি চার্জ দেখায়। নতুন স্টোরে ঢাকার ভেতর আর বাইরের চার্জ আগে থেকেই দেওয়া থাকে — নিজের মতো বদলে নিন।',
    steps: [
      '**Shipping**-এ **Add zone** দিয়ে জোন বানান, যেমন "Dhaka City" আর "Outside Dhaka"।',
      'জোনে **Add location** দিয়ে বিভাগ, জেলা বা উপজেলা যোগ করুন। একটি এলাকা দুটি জোনে পড়লে **Priority** বেশি যেটার, সেটি কাজ করে।',
      '**Add method** দিয়ে ডেলিভারি পদ্ধতি বানান: **Name**, **Charge**, **Estimated delivery** (যেমন "১–২ দিন")।',
      'বড় অর্ডারে ফ্রি ডেলিভারি দিতে **Free shipping threshold**-এ টাকার সীমা দিন (যেমন ২০০০)।',
      'এই পদ্ধতিতে ক্যাশ অন ডেলিভারি চলবে কিনা ঠিক করতে **COD allowed** চালু বা বন্ধ রাখুন।',
    ],
    tips: [
      'কোনো জোনে না পড়া এলাকার জন্য জোন ছাড়া (store-wide) পদ্ধতি বিকল্প হিসেবে কাজ করে।',
      'অন্তত একটি পদ্ধতি চালু না থাকলে কাস্টমার চেকআউট করতে পারেন না।',
      'আলাদা ডেলিভারি জোন Growth আর Business প্যাকেজে; Starter-এ সারা দেশের জন্য একই পদ্ধতি।',
    ],
    links: [{ href: '/dashboard/shipping', label: 'Shipping' }],
  },
  {
    id: 'couriers',
    group: 'ডেলিভারি ও পেমেন্ট',
    title: 'কুরিয়ার যুক্ত করা আর পার্সেল বুকিং',
    summary:
      'Steadfast, Pathao, RedX, Paperfly আর eCourier যুক্ত করলে অর্ডার থেকেই পার্সেল বুক হয় — কাস্টমারের নাম, ফোন, ঠিকানা আর ক্যাশ অন ডেলিভারির টাকা নিজে থেকে চলে যায়। সব প্যাকেজে আছে।',
    steps: [
      '**Settings → Couriers** খুলুন। আপনার কুরিয়ার বেছে কুরিয়ার অ্যাকাউন্টের API তথ্য দিন।',
      '**Pickup location**-এ **Pickup contact name**, **Pickup phone** আর **Pickup address** দিন। **Default parcel weight (kg)** ঠিক করুন।',
      'অর্ডার খুলে **Courier** অংশে কুরিয়ার বাছুন, ওজন আর **Note for the courier (optional)** দিয়ে **Create shipment** চাপুন।',
      'বুকিংয়ের পর ট্র্যাকিং কোড দেখায়; ডেলিভারির খবর জানতে **Sync status** চাপুন।',
    ],
    tips: [
      'RedX আর eCourier বুকিংয়ের সময় তাদের নিজস্ব ডেলিভারি এলাকা চায় — তালিকা থেকে বাছুন।',
      'Delivery Tiger, CarryBee বা Karatoa-র মতো অন্য কুরিয়ারে আগের মতো বুক করুন, তারপর অর্ডারের শিপমেন্টে কুরিয়ার বেছে ট্র্যাকিং নম্বর দিন।',
      'কুরিয়ার ক্যাশ শুধু পূর্ণ টাকায় তোলে, তাই ক্যাশ অন ডেলিভারির টাকা পয়সা ছাড়া হয়।',
    ],
    links: [
      { href: '/dashboard/settings/couriers', label: 'Couriers' },
      { href: '/dashboard/orders', label: 'Orders' },
    ],
  },
  {
    id: 'payments',
    group: 'ডেলিভারি ও পেমেন্ট',
    title: 'কাস্টমারের পেমেন্টের উপায়',
    summary: 'কাস্টমার কীভাবে টাকা দেবেন — ক্যাশ অন ডেলিভারি, ব্যাংক ট্রান্সফার বা অনলাইন।',
    steps: [
      '**Settings → Payments** খুলুন।',
      '**Cash on delivery** চালু রাখুন — বাংলাদেশে বেশিরভাগ কাস্টমার এটাই পছন্দ করেন।',
      'ব্যাংকে টাকা নিতে **Bank transfer** চালু করে **Bank details shown to customers** আর **Instructions for customers** লিখুন।',
      'অনলাইনে bKash, Nagad আর কার্ডে টাকা নিতে SSLCommerz-এর store ID আর store password দিন, sandbox বা **Live** মোড বেছে সংযোগ পরীক্ষা করে চালু করুন।',
      'বিদেশি কার্ডের জন্য Stripe-এর key দিন (শুধু Business প্যাকেজে)।',
    ],
    tips: [
      'অনলাইন পেমেন্ট (SSLCommerz) Growth আর Business প্যাকেজে আছে।',
      'অনলাইন পেমেন্ট প্রোভাইডার নিশ্চিত করলে তবেই অর্ডার "Paid" হয়। রিফান্ড প্রোভাইডারের নিজের প্যানেল থেকে দিতে হয়।',
      'কোন ডেলিভারি পদ্ধতিতে ক্যাশ অন ডেলিভারি চলবে তা **Shipping**-এ ঠিক হয়।',
    ],
    plan: 'অনলাইন পেমেন্ট: Growth ও Business',
    links: [{ href: '/dashboard/settings/payments', label: 'Payment settings' }],
  },

  /* ---------------- অর্ডার ও কাস্টমার ---------------- */
  {
    id: 'orders',
    group: 'অর্ডার ও কাস্টমার',
    title: 'অর্ডার সামলানো আর ইনভয়েস',
    summary:
      'প্রতিটি অর্ডারের তিনটি অবস্থা আলাদা: অর্ডারের অবস্থা, পেমেন্টের অবস্থা আর ফুলফিলমেন্ট (পাঠানো হয়েছে কিনা)।',
    steps: [
      '**Orders**-এ নতুন অর্ডার দেখুন। অবস্থা, পেমেন্ট, ফুলফিলমেন্ট বা তারিখ দিয়ে ফিল্টার করুন।',
      'অর্ডার খুলে আইটেম, কাস্টমারের ফোন, ঠিকানা আর ডেলিভারি পদ্ধতি দেখুন।',
      'কাস্টমারকে ফোন করে অর্ডার নিশ্চিত করুন, তারপর **Change status…** থেকে অর্ডার এগিয়ে নিন (যেমন Confirmed → Processing)।',
      'পার্সেল পাঠাতে **Courier** অংশ থেকে **Create shipment** চাপুন, বা নিজে শিপমেন্ট বানিয়ে ট্র্যাকিং নম্বর দিন।',
      'ক্যাশ অন ডেলিভারির টাকা হাতে পেলে **Change payment…** থেকে পেমেন্ট "Paid" করুন।',
      'পার্সেলের সাথে দিতে বা কাস্টমারকে পাঠাতে অর্ডারের উপরের **Invoice** বাটন চাপুন, তারপর **Print / Save as PDF** — ইনভয়েসে স্টোরের লোগো, কাস্টমারের ঠিকানা, প্রোডাক্ট, ডেলিভারি চার্জ আর মোট টাকা থাকে।',
      'নিজের জন্য কিছু লিখে রাখতে **Internal note** ব্যবহার করুন — কাস্টমার এটা দেখেন না।',
      'অর্ডার বাতিল করতে **Cancel order** চাপুন; চাইলে **Customer-facing reason (optional)** লিখুন। বাতিল আইটেমের স্টক নিজে থেকে ফেরত আসে।',
    ],
    tips: [
      'কাস্টমার স্টোরের অর্ডার ট্র্যাকিং পেজে অর্ডার নম্বর আর ফোন বা ইমেইল দিয়ে অর্ডারের অবস্থা দেখতে পান — তাই ট্র্যাকিং নম্বর দিলে "আমার অর্ডার কোথায়" প্রশ্ন কমে।',
      'নতুন অর্ডার এলে মেনুতে লাল ব্যাজে সংখ্যা দেখায়।',
      'ইনভয়েসে **PAID**, **DUE** বা **CANCELLED** ছাপ থাকে। ক্যাশ অন ডেলিভারিতে "Amount due" দেখায় — কুরিয়ার কত টাকা তুলবে তা পরিষ্কার থাকে। ইনভয়েসে ঠিকানা আর ফোন যায় **Settings → Store details** থেকে, তাই সেগুলো পূরণ রাখুন।',
    ],
    links: [{ href: '/dashboard/orders', label: 'Orders' }],
  },
  {
    id: 'customers',
    group: 'অর্ডার ও কাস্টমার',
    title: 'কাস্টমার',
    summary: 'কাস্টমার অ্যাকাউন্ট ছাড়াই অর্ডার দেন। তাঁদের নাম, ফোন আর ঠিকানা প্রতিটি অর্ডারে সেভ থাকে।',
    steps: [
      '**Customers**-এ নাম, ইমেইল বা ফোন দিয়ে কাস্টমার খুঁজুন।',
      'নিজে কাস্টমার যোগ করতে **First name**, **Last name**, **Email**, **Phone** আর **Notes** দিন।',
    ],
    tips: ['যে কাস্টমারের কোনো অর্ডার নেই, শুধু তাঁকেই ডিলিট করা যায়।'],
    links: [{ href: '/dashboard/customers', label: 'Customers' }],
  },
  {
    id: 'payment-records',
    group: 'অর্ডার ও কাস্টমার',
    title: 'পেমেন্টের তালিকা',
    summary: 'কাস্টমারের সব পেমেন্ট — কোন অর্ডারের, কত টাকা, কোন উপায়ে, আর কী অবস্থা।',
    steps: ['**Payments**-এ অর্ডার নম্বর দিয়ে সার্চ করে পেমেন্ট খুঁজুন।'],
    links: [{ href: '/dashboard/payments', label: 'Payments' }],
  },
  {
    id: 'analytics',
    group: 'অর্ডার ও কাস্টমার',
    title: 'বিক্রি আর ভিজিটরের হিসাব',
    summary: 'কত বিক্রি হলো, কোন প্রোডাক্ট বেশি চলছে আর ভিজিটর কোথা থেকে আসছে।',
    points: [
      '**Dashboard**-এ আজকের আর এই সপ্তাহের বিক্রি।',
      '**Analytics**-এ সময় ধরে বিক্রি, অর্ডার আর সবচেয়ে বেশি বিক্রি হওয়া প্রোডাক্ট।',
      'Growth আর Business-এ ভিজিটর, কনভার্সন রেট, ভিজিটর কোথা থেকে আসছে (Facebook, Google…), কেনাকাটার ধাপ, যেকোনো তারিখের হিসাব আর CSV ডাউনলোড।',
      'Starter-এ শেষ ৩০ দিনের বিক্রির হিসাব দেখায়।',
      'ভিজিটর কুকি ছাড়াই গোনা হয়, কিছু সেট করতে হয় না।',
    ],
    links: [{ href: '/dashboard/analytics', label: 'Analytics' }],
  },

  /* ---------------- মার্কেটিং ---------------- */
  {
    id: 'coupons',
    group: 'মার্কেটিং',
    title: 'কুপন আর ছাড়',
    summary: 'কুপন কোড দিয়ে অফার চালান। প্রতিটি নিয়ম সার্ভারে যাচাই হয়, তাই কেউ সীমা পার হতে পারেন না।',
    plan: 'Growth ও Business',
    steps: [
      '**Coupons → New coupon** চাপুন।',
      'কোড লিখুন (যেমন EID20) আর ছাড়ের ধরন বাছুন: শতাংশ (যেমন ১০%) বা নির্দিষ্ট টাকা (যেমন ৳২০০)।',
      'চাইলে সর্বনিম্ন অর্ডার, সর্বোচ্চ ছাড়, মোট ব্যবহারের সীমা আর কাস্টমারপ্রতি সীমা দিন।',
      'শুরু আর শেষের তারিখ দিয়ে সেভ করুন। যেকোনো সময় কুপন বন্ধ করা যায়।',
    ],
    tips: ['কুপন পুরো কার্টের দামের ওপর চলে। ফ্রি ডেলিভারি দিতে ডেলিভারি পদ্ধতির **Free shipping threshold** ব্যবহার করুন।'],
    links: [{ href: '/dashboard/coupons/new', label: 'New coupon' }],
  },
  {
    id: 'tracking',
    group: 'মার্কেটিং',
    title: 'Facebook Pixel আর Google Analytics',
    summary:
      'শুধু আইডি পেস্ট করলেই স্টোরে ট্যাগ বসে যায়, আর কেনাকাটার ইভেন্ট (প্রোডাক্ট দেখা, কার্টে যোগ, চেকআউট, কেনা) নিজে থেকে যায়।',
    plan: 'Growth ও Business',
    steps: [
      '**Marketing & tracking** খুলুন।',
      '**Facebook (Meta) Pixel**-এ Meta Events Manager থেকে **Pixel ID** (শুধু সংখ্যা) দিন।',
      '**Google Tag Manager**-এ **Container ID** (GTM-XXXXXXX) বা **Google Analytics 4**-এ **Measurement ID** (G-XXXXXXXXXX) দিন।',
      'গুগল সার্চে স্টোর যাচাই করতে **Google Search Console**-এ **Verification tag** দিন।',
      'প্রতিটি কার্ডে **Where do I find it?** চেপে আইডি কোথায় পাবেন দেখুন।',
    ],
    links: [{ href: '/dashboard/tracking', label: 'Marketing & tracking' }],
  },
  {
    id: 'landing-pages',
    group: 'মার্কেটিং',
    title: 'ল্যান্ডিং পেজ (ফেসবুক বিজ্ঞাপনের জন্য)',
    summary:
      'এক পেজের অফার, যার নিজস্ব অর্ডার ফর্ম আছে — কাস্টমার পেজেই অর্ডার দেন, আর অর্ডার **Orders**-এ আসে।',
    plan: 'Growth (৫টি) ও Business (যত খুশি)',
    steps: [
      '**Landing pages → New landing page** চাপুন।',
      '১০টি ডিজাইনের একটি বাছুন (একক প্রোডাক্ট, উৎসবের সেল, ফ্যাশন, খাবার ও স্বাস্থ্য, গ্যাজেট, বিউটি, শিশু, হোম ও কিচেন ইত্যাদি) আর **Page name** দিন।',
      'এডিটরে **Page settings → Products**-এ আপনার প্রোডাক্ট বাছুন। দাম আর স্টক ক্যাটালগ থেকেই আসে।',
      '**Sections**-এ প্রতিটি অংশের লেখা আর ছবি বদলান; অংশ লুকান বা সাজান। **Colours**-এ দুটি মূল রং বদলান।',
      '**Offer timer**-এ টাইমার দিন — প্রতিটি ভিজিটরের জন্য কয়েক ঘণ্টা, বা নির্দিষ্ট তারিখ পর্যন্ত।',
      '**Search & sharing**-এ শিরোনাম, বিবরণ আর **Share image** দিন — গুগলে আর লিংক শেয়ারে এগুলো দেখায়।',
      'পাবলিশ করে **View live ↗** চাপুন, তারপর /lp/… লিংকটি বিজ্ঞাপনে দিন।',
    ],
    tips: [
      'প্রতিটি অর্ডার মনে রাখে কোন ল্যান্ডিং পেজ থেকে এসেছে, তাই কোন পেজ বেশি বিক্রি করছে বোঝা যায়।',
      '**Unpublish** করলে পেজ আর লিংক বন্ধ হয়, কিন্তু আগের অর্ডার থেকে যায়।',
    ],
    links: [{ href: '/dashboard/landing-pages', label: 'Landing pages' }],
  },

  /* ---------------- স্টোরের সেটিং ---------------- */
  {
    id: 'domains',
    group: 'স্টোরের সেটিং',
    title: 'নিজের ডোমেইন যুক্ত করা',
    summary: 'প্রতিটি স্টোর একটি ফ্রি Ecomesta ঠিকানা পায়। চাইলে নিজের ডোমেইন (যেমন yourbrand.com) যুক্ত করুন।',
    plan: 'Growth ও Business',
    steps: [
      '**Domains**-এ **Add custom domain** চাপুন, ডোমেইন লিখুন (যেমন shop.example.com)।',
      '**DNS verification**-এ দেখানো TXT রেকর্ডটি আপনার ডোমেইন প্রোভাইডারের DNS-এ যোগ করুন, তারপর যাচাই করুন।',
      'ডোমেইন প্রোভাইডারে CNAME বা A রেকর্ড দিয়ে ডোমেইনটি Ecomesta-য় দেখিয়ে দিন, তারপর চালু করুন।',
      'একাধিক ঠিকানা থাকলে একটিকে **Primary** বানান — গুগল সেটিকেই আসল ঠিকানা ধরে।',
    ],
    tips: ['DNS বদলাতে কিছু সময় লাগতে পারে। কোথাও আটকে গেলে **Help & support**-এ জানান।'],
    links: [{ href: '/dashboard/domains', label: 'Domains' }],
  },
  {
    id: 'seo',
    group: 'স্টোরের সেটিং',
    title: 'গুগল আর শেয়ারে স্টোর কেমন দেখাবে (SEO)',
    summary: 'সার্চ রেজাল্ট আর ফেসবুক/হোয়াটসঅ্যাপে লিংক শেয়ার করলে যা দেখায়।',
    steps: [
      '**Settings → SEO** খুলুন।',
      '**Page title**, **Meta description** আর **Keywords** দিন। **Search result preview**-এ গুগলে কেমন দেখাবে দেখুন।',
      'শেয়ারের জন্য **Share title**, **Share description** আর **Share image URL** দিন।',
      'গুগলে স্টোর দেখাতে **Allow search engines to index this store** চালু রাখুন।',
    ],
    links: [{ href: '/dashboard/settings/seo', label: 'SEO' }],
  },
  {
    id: 'checkout-settings',
    group: 'স্টোরের সেটিং',
    title: 'চেকআউট, অর্ডার আর নোটিফিকেশন',
    summary: 'চেকআউটে কাস্টমার কী দেবেন, অর্ডারের পর কী করতে পারবেন আর কাকে ইমেইল যাবে।',
    points: [
      '**Settings → Checkout** — ডেলিভারির নির্দেশনার জন্য **Allow order notes** চালু করুন। গেস্ট চেকআউট, ফোন নম্বর আর ঠিকানা সবসময় চালু থাকে।',
      '**Settings → Orders** — **Let customers cancel their own orders** চালু করলে কাস্টমার শর্তসাপেক্ষে নিজেই অর্ডার বাতিল করতে পারেন।',
      '**Settings → Notifications** — আপনার আর কাস্টমারের কোন ইমেইল যায় দেখুন।',
    ],
    links: [
      { href: '/dashboard/settings/checkout', label: 'Checkout' },
      { href: '/dashboard/settings/orders', label: 'Orders settings' },
      { href: '/dashboard/settings/notifications', label: 'Notifications' },
    ],
  },
  {
    id: 'stores',
    group: 'স্টোরের সেটিং',
    title: 'একাধিক স্টোর',
    summary: 'একটি অ্যাকাউন্টে একাধিক স্টোর থাকলে উপরের মেনু থেকে স্টোর বদলান।',
    steps: ['**Stores**-এ সব স্টোর দেখুন আর **Select** চেপে কোনটি নিয়ে কাজ করবেন বাছুন। প্রতিটি স্টোরের প্রোডাক্ট, অর্ডার আর সেটিং আলাদা।'],
    links: [{ href: '/dashboard/stores', label: 'Stores' }],
  },
  {
    id: 'danger-zone',
    group: 'স্টোরের সেটিং',
    title: 'স্টোর বন্ধ বা ডিলিট করা',
    summary: 'সাবধানে ব্যবহার করুন — এগুলো বড় পরিবর্তন।',
    points: [
      '**Settings → Danger zone → Disable storefront** — স্টোর কাস্টমারদের জন্য সাময়িক বন্ধ রাখে; আবার চালু করা যায়।',
      '**Delete store** — স্টোর স্থায়ীভাবে মুছে দেয়, ফেরত আনা যায় না।',
    ],
    links: [{ href: '/dashboard/settings/danger-zone', label: 'Danger zone' }],
  },

  /* ---------------- অ্যাকাউন্ট ---------------- */
  {
    id: 'billing',
    group: 'অ্যাকাউন্ট',
    title: 'প্যাকেজ, ফ্রি ট্রায়াল, পেমেন্ট আর ইনভয়েস',
    summary: 'আপনার Ecomesta প্যাকেজ, কবে মেয়াদ শেষ, আর কীভাবে টাকা দেবেন।',
    steps: [
      '**Plan & billing**-এ আপনার প্যাকেজ, অবস্থা আর মেয়াদ শেষের তারিখ দেখুন। ফ্রি ট্রায়ালে থাকলে ট্রায়াল কবে শেষ হবে সেটাও দেখায়।',
      'প্যাকেজ আর মেয়াদ বাছুন (মাসিক, ৬ মাসে ১০% ছাড়, বছরে ২৫% ছাড়), তারপর **Continue to payment →** চাপুন।',
      'দেখানো নম্বরে bKash, Nagad, Rocket বা Upay দিয়ে টাকা পাঠান, তারপর যে নম্বর থেকে পাঠিয়েছেন আর ট্রানজেকশন আইডি দিন।',
      'Ecomesta টিম পেমেন্ট নিশ্চিত করলে (সাধারণত কয়েক ঘণ্টার মধ্যে) প্যাকেজ চালু হয় আর ইমেইল আসে।',
      'নিশ্চিত হওয়া পেমেন্টের ইনভয়েস পেতে **Payment history**-তে সেই পেমেন্টের পাশে **Invoice** চাপুন, তারপর **Print / Save as PDF**।',
    ],
    tips: [
      'ট্রায়ালের মধ্যে টাকা দিলে পেইড মেয়াদ শুরু হয় ট্রায়াল শেষের দিন থেকে — কোনো দিন নষ্ট হয় না।',
      'মেয়াদ শেষ হলে ৭ দিন বাড়তি সময় পান, স্টোর চালু থাকে। এর মধ্যে টাকা না দিলে স্টোর সাময়িক বন্ধ থাকে; প্রোডাক্ট, অর্ডার আর সেটিং সব থেকে যায়, টাকা দিলেই আবার চালু হয়।',
      'শুধু অ্যাকাউন্টের মালিক বা অ্যাডমিন প্যাকেজের টাকা দিতে পারেন।',
    ],
    links: [{ href: '/dashboard/billing', label: 'Plan & billing' }],
  },
  {
    id: 'affiliate',
    group: 'অ্যাকাউন্ট',
    title: 'অ্যাফিলিয়েট প্রোগ্রাম',
    summary: 'অন্য ব্যবসাকে Ecomesta-য় আনুন আর তাদের প্রথম প্যাকেজ পেমেন্টের ২০% পান।',
    steps: [
      '**Affiliate program**-এ আবেদন করুন। অনুমোদনের পর আপনার নিজস্ব লিংক দেখাবে।',
      'লিংক শেয়ার করুন। কেউ ৩০ দিনের মধ্যে সেই লিংক দিয়ে সাইন-আপ করে প্রথম প্যাকেজের টাকা দিলে আপনি ২০% পান।',
      '৭ দিন অপেক্ষার পর ৳৫০০ থেকে bKash, Nagad, Rocket বা Upay-তে টাকা তুলুন।',
    ],
    links: [{ href: '/dashboard/affiliate', label: 'Affiliate program' }],
  },
  {
    id: 'help',
    group: 'অ্যাকাউন্ট',
    title: 'সাহায্য দরকার?',
    summary: 'কোথাও আটকে গেলে Ecomesta টিম সাহায্য করবে।',
    points: [
      '**Help & support**-এ বিষয় বেছে মেসেজ পাঠান — আপনার স্টোরের তথ্যসহ অনুরোধ আমাদের কাছে আসে।',
      'ফোন: 09697-493407 (হোয়াটসঅ্যাপেও)।',
      'ওয়েবসাইটের চ্যাট বাটনে ছোট প্রশ্নের সাথে সাথে উত্তর পাবেন।',
    ],
    links: [{ href: '/dashboard/support', label: 'Help & support' }],
  },
];
