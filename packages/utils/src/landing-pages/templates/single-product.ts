import { area, faqField, footerFields, icon, image, list, reviewFields, text, url } from '../fields.js';
import type { LandingTemplateDef } from '../types.js';

const IMG = '/landing-demo/single';

export const SINGLE_PRODUCT_TEMPLATE: LandingTemplateDef = {
  key: 'single_product',
  name: 'Single product',
  tagline: 'One product, one clear offer',
  description: 'Clean white page with a bold order button. Best for one hero product from a Facebook ad: gadgets, cosmetics, clothing.',
  productMode: 'single',
  maxProducts: 1,
  previewImage: '/landing-previews/single_product.jpg',
  colors: { primary: '#0E5A48', accent: '#C2410C', primaryLabel: 'Main colour', accentLabel: 'Order buttons' },
  countdown: { mode: 'evergreen', hours: 6, endsAt: null },
  demoProducts: [
    {
      name: 'প্রিমিয়াম কটন পাঞ্জাবি',
      price: 1490,
      compareAtPrice: 2200,
      imageUrl: `${IMG}/hero.jpg`,
      variants: [
        { name: 'M', price: 1490, compareAtPrice: 2200 },
        { name: 'L', price: 1490, compareAtPrice: 2200 },
        { name: 'XL', price: 1490, compareAtPrice: 2200 },
        { name: 'XXL', price: 1590, compareAtPrice: 2300 },
      ],
    },
  ],
  sections: [
    {
      type: 'hero',
      label: 'Hero',
      description: 'Product photo, headline, price and the first order button.',
      fields: [
        text('badge', 'Badge', 60),
        text('title', 'Headline', 160),
        area('subtitle', 'Short description', 400),
        text('buttonLabel', 'Button text', 40),
        image('imageUrl', 'Photo', { help: 'Leave empty to use the product photo.' }),
        list('points', 'Check points', 'Point', 5, [text('text', 'Text', 120)]),
      ],
      defaults: {
        badge: 'সীমিত সময়ের অফার',
        title: 'প্রিমিয়াম কটন পাঞ্জাবি, সারাদিন আরাম আর স্টাইল',
        subtitle: '১০০% খাঁটি কটন, নরম ফেব্রিক আর নিখুঁত ফিটিং। জুম্মা, অফিস বা অনুষ্ঠান, সব জায়গায় মানানসই।',
        buttonLabel: 'অর্ডার করুন',
        imageUrl: `${IMG}/hero.jpg`,
        points: [
          { text: 'ক্যাশ অন ডেলিভারি, পণ্য হাতে পেয়ে টাকা দিন' },
          { text: 'সারা বাংলাদেশে হোম ডেলিভারি' },
          { text: 'সাইজ না মিললে এক্সচেঞ্জের সুযোগ' },
        ],
      },
    },
    {
      type: 'countdown',
      label: 'Countdown',
      description: 'Dark band with the offer timer. Set the timer under Page settings.',
      fields: [text('title', 'Text', 80), text('buttonLabel', 'Button text', 40)],
      defaults: { title: 'অফার শেষ হতে বাকি', buttonLabel: 'অর্ডার করুন' },
    },
    {
      type: 'benefits',
      label: 'Benefits',
      description: '3 to 6 reasons to buy, with icons.',
      fields: [
        text('title', 'Heading', 120),
        list('items', 'Benefits', 'Benefit', 6, [icon(), text('title', 'Title', 80), area('text', 'Text', 240)]),
        text('buttonLabel', 'Button text', 40),
      ],
      defaults: {
        title: 'কেন এই পাঞ্জাবিটি আপনার পছন্দ হবে',
        buttonLabel: 'অর্ডার করুন',
        items: [
          { icon: 'layers', title: '১০০% কটন ফেব্রিক', text: 'নরম, হালকা আর ঘাম শোষণকারী কাপড়।' },
          { icon: 'ruler', title: 'নিখুঁত ফিটিং', text: 'M থেকে XXL পর্যন্ত, সব সাইজে আরামদায়ক ফিট।' },
          { icon: 'award', title: 'টেকসই সেলাই', text: 'বারবার ধোয়ার পরেও রং আর শেপ ঠিক থাকে।' },
          { icon: 'wind', title: 'গরমে আরাম', text: 'বাতাস চলাচল করে, তাই সারাদিন পরলেও অস্বস্তি নেই।' },
          { icon: 'truck', title: 'সারা দেশে ডেলিভারি', text: 'ঢাকায় ১-২ দিন, ঢাকার বাইরে ২-৪ দিনে পৌঁছে যাবে।' },
          { icon: 'refresh', title: 'সহজ এক্সচেঞ্জ', text: 'সাইজ বা ডিফেক্ট সমস্যা হলে এক্সচেঞ্জ করে দেওয়া হবে।' },
        ],
      },
    },
    {
      type: 'gallery',
      label: 'Gallery',
      description: 'Real photos of the product.',
      fields: [text('title', 'Heading', 120), list('images', 'Photos', 'Photo', 8, [image('imageUrl', 'Photo'), text('alt', 'Description', 120)])],
      defaults: {
        title: 'পণ্যের আসল ছবি',
        images: [
          { imageUrl: `${IMG}/gallery-1.jpg`, alt: 'পাঞ্জাবির সামনের দিক' },
          { imageUrl: `${IMG}/gallery-2.jpg`, alt: 'কাপড়ের টেক্সচার' },
          { imageUrl: `${IMG}/gallery-3.jpg`, alt: 'কলার ও বোতামের ক্লোজআপ' },
          { imageUrl: `${IMG}/gallery-4.jpg`, alt: 'মডেল পরা অবস্থায়' },
          { imageUrl: `${IMG}/gallery-5.jpg`, alt: 'বিভিন্ন রং' },
          { imageUrl: `${IMG}/gallery-6.jpg`, alt: 'ভাঁজ করা অবস্থায় প্যাকেজিং' },
        ],
      },
    },
    {
      type: 'video',
      label: 'Video',
      description: 'A YouTube video; it loads only after the shopper taps play.',
      fields: [text('title', 'Heading', 120), url('videoUrl', 'YouTube link'), image('posterUrl', 'Cover photo')],
      defaults: { title: 'ভিডিওতে দেখুন', videoUrl: '', posterUrl: `${IMG}/video.jpg` },
    },
    {
      type: 'reviews',
      label: 'Reviews',
      description: 'Customer reviews and optional screenshots. Replace the demo reviews with real ones.',
      fields: [
        text('title', 'Heading', 120),
        text('subtitle', 'Line under the heading', 160),
        list('items', 'Reviews', 'Review', 8, reviewFields()),
        list('screenshots', 'Review screenshots', 'Screenshot', 4, [image('imageUrl', 'Screenshot')]),
      ],
      defaults: {
        title: 'আমাদের ক্রেতারা কী বলছেন',
        subtitle: '',
        items: [
          { name: 'তানভীর আহমেদ', location: 'চট্টগ্রাম', rating: 5, text: 'কাপড়টা অনেক নরম, ছবির মতোই পেয়েছি। জুম্মায় পরে সবাই জিজ্ঞেস করছিল কোথা থেকে নিয়েছি।' },
          { name: 'রাফিয়া ইসলাম', location: 'ঢাকা', rating: 5, text: 'ভাইয়ের জন্য অর্ডার করেছিলাম। দুই দিনে হাতে পেয়েছি, ফিটিং একদম ঠিক ছিল।' },
          { name: 'মাহফুজ হাসান', location: 'সিলেট', rating: 4, text: 'দামের তুলনায় মান ভালো। প্রথমে এক সাইজ বড় নিয়েছিলাম, এক্সচেঞ্জ করে দিয়েছে কোনো ঝামেলা ছাড়াই।' },
          { name: 'সাবরিনা আক্তার', location: 'রাজশাহী', rating: 5, text: 'ক্যাশ অন ডেলিভারি ছিল বলে ভরসা করে নিয়েছি। প্যাকেজিং ভালো, কাপড়ও দারুণ।' },
        ],
        screenshots: [{ imageUrl: '/landing-demo/shared/chat-1.png' }, { imageUrl: '/landing-demo/shared/chat-2.png' }],
      },
    },
    {
      type: 'faq',
      label: 'FAQ',
      description: 'Questions shoppers ask before ordering.',
      fields: [text('title', 'Heading', 120), faqField],
      defaults: {
        title: 'সাধারণ প্রশ্ন ও উত্তর',
        items: [
          { question: 'ডেলিভারি পেতে কতদিন লাগবে?', answer: 'ঢাকার ভিতরে ১-২ দিন, ঢাকার বাইরে ২-৪ কর্মদিবসের মধ্যে পণ্য পৌঁছে যায়।' },
          { question: 'ক্যাশ অন ডেলিভারি আছে কি?', answer: 'হ্যাঁ। পণ্য হাতে পেয়ে, দেখে নিয়ে ডেলিভারি ম্যানকে টাকা দিতে পারবেন। আগে কোনো টাকা দিতে হবে না।' },
          { question: 'সাইজ না মিললে কী করব?', answer: 'পণ্য পাওয়ার ৩ দিনের মধ্যে আমাদের জানান। অব্যবহৃত অবস্থায় সাইজ এক্সচেঞ্জ করে দেওয়া হবে।' },
          { question: 'অর্ডার করার পর কীভাবে কনফার্ম হবে?', answer: 'অর্ডার করার কিছুক্ষণের মধ্যে আমাদের প্রতিনিধি আপনাকে ফোন করে অর্ডার কনফার্ম করবেন। তাই সঠিক মোবাইল নম্বর দিন।' },
        ],
      },
    },
    {
      type: 'guarantee',
      label: 'Trust badges',
      description: 'Four short promises.',
      fields: [
        text('title', 'Heading', 120),
        list('items', 'Badges', 'Badge', 4, [icon(), text('title', 'Title', 60), text('text', 'Text', 100)]),
        text('buttonLabel', 'Button text', 40),
      ],
      defaults: {
        title: 'নিশ্চিন্তে অর্ডার করুন',
        buttonLabel: 'অর্ডার করুন',
        items: [
          { icon: 'cash', title: 'ক্যাশ অন ডেলিভারি', text: 'হাতে পেয়ে টাকা দিন' },
          { icon: 'truck', title: 'দ্রুত ডেলিভারি', text: 'সারা দেশে হোম ডেলিভারি' },
          { icon: 'refresh', title: 'সহজ এক্সচেঞ্জ', text: '৩ দিনের মধ্যে' },
          { icon: 'shield', title: 'মান নিশ্চিত', text: 'ডেলিভারির আগে চেক করা' },
        ],
      },
    },
    {
      type: 'order',
      label: 'Order form',
      description: 'Shoppers order here. Delivery charges and payment options come from your store settings.',
      required: true,
      fields: [
        text('title', 'Heading', 120),
        text('subtitle', 'Line under the heading', 200),
        text('buttonLabel', 'Button text', 40),
        area('successText', 'Thank-you message', 300),
      ],
      defaults: {
        title: 'অর্ডার করতে নিচের ফর্মটি পূরণ করুন',
        subtitle: 'ক্যাশ অন ডেলিভারি। পণ্য হাতে পেয়ে টাকা দিন।',
        buttonLabel: 'অর্ডার কনফার্ম করুন',
        successText: 'আপনার অর্ডার পেয়েছি। আমরা শীঘ্রই ফোন করে অর্ডার কনফার্ম করব।',
      },
    },
    {
      type: 'footer',
      label: 'Footer',
      description: 'Shop name and contact links.',
      fields: footerFields(),
      defaults: { brand: '', text: '', phone: '', facebookUrl: '' },
    },
  ],
};

