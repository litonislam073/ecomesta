import { Injectable } from '@nestjs/common';
import {
  ALL_FAQS,
  BLOG_POSTS,
  FEATURE_PAGES,
  PAYMENT_PAGES,
  SHIPPING_PAGES,
  SOLUTION_PAGES,
  contentPath,
  type ContentPage,
  type ContentSection,
} from '@ecomesta/utils/marketing-content';
import { BILLING_CYCLES, PAYMENT_GRACE_DAYS } from '@ecomesta/utils';

/** One retrievable piece of Ecomesta knowledge. */
export interface KnowledgeChunk {
  id: string;
  title: string;
  /** Public page the visitor can open for more detail. */
  path: string;
  text: string;
}

/**
 * Facts the website pages do not state (or state per page) but the platform
 * enforces in code. Kept short and derived from the same constants the API uses.
 */
function platformFacts(): KnowledgeChunk[] {
  const cycles = BILLING_CYCLES.map((cycle) =>
    cycle.discountPercent > 0 ? `${cycle.label} (${cycle.discountPercent}% off)` : cycle.label,
  ).join(', ');
  return [
    {
      id: 'fact-trial-billing',
      title: 'Signing up, free trial, billing periods and payment due dates',
      path: '/pricing',
      text: [
        'There is no free trial. A new merchant creates an account, enters the store name and web address, chooses a plan and billing period, and pays for it in the last step of sign-up with bKash, Nagad, Rocket or Upay.',
        'The store is created right away but stays offline for customers until the Ecomesta team confirms the payment, usually within a few hours; meanwhile the merchant can already add products. If the payment cannot be confirmed, the merchant can pay again from Plan & billing.',
        `Billing periods: ${cycles}.`,
        `When a paid period ends, payment is due with a ${PAYMENT_GRACE_DAYS}-day grace period; the store keeps working during the grace period. If payment is not made by then, the store is paused until payment is completed. Products, orders and settings are kept.`,
        'A plan change or upgrade takes effect once the payment for the new plan is confirmed.',
      ].join(' '),
    },
    {
      id: 'fact-subscription-payment',
      title: 'How merchants pay for their Ecomesta plan',
      path: '/pricing',
      text: 'Merchants pay their Ecomesta subscription from Plan & billing in the merchant dashboard by sending the plan price with bKash, Nagad, Rocket or Upay (Send Money) to the Ecomesta number shown there, then entering their own number and the transaction ID. The Ecomesta team checks each payment manually, usually within a few hours, and emails the merchant when the plan is active. This is only for paying Ecomesta itself — it is not a bKash or Nagad integration for a merchant’s customers.',
    },
    {
      id: 'fact-plan-features',
      title: 'What each plan includes',
      path: '/pricing',
      text: 'Starter: online store on an Ecomesta web address, up to 25 products, 1 GB storage for images, orders, customers and inventory, Cash on Delivery checkout, the default storefront theme. Growth: everything in Starter plus up to 100 products, 3 GB storage, connecting your own domain, online payments with SSLCommerz, discount coupons, Bangladesh delivery zones and all storefront themes. Business: everything in Growth plus unlimited products, 5 GB storage, Stripe for international card payments and priority support. Live prices come from the pricing tool.',
    },
    {
      id: 'fact-store-checkout',
      title: 'How shoppers check out and track orders',
      path: '/features/online-store',
      text: 'Shoppers check out as guests without an account. They enter their name, a phone number (required) and optionally an email, then choose their district and thana/upazila and write their full address. Payment options a store can offer: Cash on Delivery, bank transfer or other offline payment, SSLCommerz (Growth and Business plans) and Stripe (Business plan). Customers track an order with the order reference and the phone number or email used at checkout.',
    },
  ];
}

function sectionText(section: ContentSection): string {
  return [
    ...(section.paragraphs ?? []),
    ...(section.bullets ?? []).map((item) => `- ${item}`),
    ...(section.flow ?? []).map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');
}

function pageChunks(page: ContentPage): KnowledgeChunk[] {
  const path = contentPath(page);
  const chunks: KnowledgeChunk[] = [
    {
      id: `${page.hub}-${page.slug}`,
      title: page.name,
      path,
      text: [page.h1, page.intro, ...page.highlights.map((item) => `- ${item}`)].join('\n'),
    },
    ...page.sections.map((section, index) => ({
      id: `${page.hub}-${page.slug}-${index}`,
      title: `${page.name}: ${section.heading}`,
      path,
      text: sectionText(section),
    })),
  ];
  for (const [index, faq] of (page.faqs ?? []).entries()) {
    chunks.push({ id: `${page.hub}-${page.slug}-faq-${index}`, title: faq.question, path, text: faq.answer });
  }
  return chunks;
}

/** Bangla / Banglish words mapped to the English terms the content uses. */
const SYNONYMS: Record<string, string[]> = {
  pricing: ['price', 'pricing', 'plan', 'plans', 'cost', 'starter', 'growth', 'business'],
  dam: ['price', 'pricing', 'plan'],
  daam: ['price', 'pricing', 'plan'],
  koto: ['price', 'pricing'],
  taka: ['price', 'pricing', 'bdt'],
  দাম: ['price', 'pricing', 'plan'],
  মূল্য: ['price', 'pricing'],
  টাকা: ['price', 'pricing', 'bdt'],
  প্ল্যান: ['plan', 'pricing'],
  free: ['trial', 'free'],
  ফ্রি: ['trial', 'free'],
  dokan: ['store', 'online'],
  দোকান: ['store', 'online'],
  স্টোর: ['store'],
  shop: ['store'],
  ডোমেইন: ['domain'],
  প্রোডাক্ট: ['product', 'products'],
  পণ্য: ['product', 'products'],
  ডেলিভারি: ['delivery', 'shipping'],
  courier: ['courier', 'shipping', 'delivery'],
  কুরিয়ার: ['courier', 'shipping'],
  delivery: ['delivery', 'shipping'],
  পেমেন্ট: ['payment', 'payments'],
  bkash: ['bkash', 'payment', 'sslcommerz'],
  বিকাশ: ['bkash', 'payment', 'sslcommerz'],
  nagad: ['nagad', 'payment', 'sslcommerz'],
  নগদ: ['nagad', 'payment', 'sslcommerz'],
  অর্ডার: ['order', 'orders'],
  track: ['tracking', 'track', 'order'],
  ট্র্যাক: ['tracking', 'track', 'order'],
  কুপন: ['coupon', 'coupons', 'discount'],
  discount: ['coupon', 'discount'],
  ছাড়: ['coupon', 'discount'],
  design: ['theme', 'themes', 'design'],
  ডিজাইন: ['theme', 'design'],
  stock: ['inventory', 'stock'],
  স্টক: ['inventory', 'stock'],
  কাস্টমার: ['customer', 'customers'],
  ক্রেতা: ['customer', 'customers'],
  cod: ['cash', 'delivery', 'cod'],
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'to', 'of', 'and', 'or', 'in', 'on', 'for', 'with', 'my', 'i', 'can', 'do', 'does',
  'how', 'what', 'it', 'be', 'you', 'your', 'me', 'we', 'ki', 'ami', 'amar', 'kivabe', 'korte', 'parbo', 'ache', 'er',
]);

function terms(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+|[ঀ-৿]+/g) ?? [];
  const expanded: string[] = [];
  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    expanded.push(word);
    for (const synonym of SYNONYMS[word] ?? []) expanded.push(synonym);
  }
  return expanded;
}

/** Retrieval over the public website content plus the platform facts. */
@Injectable()
export class AiSupportKnowledge {
  readonly chunks: KnowledgeChunk[];
  private readonly index: { chunk: KnowledgeChunk; title: string; body: string }[];

  constructor() {
    const pages = [...FEATURE_PAGES, ...PAYMENT_PAGES, ...SHIPPING_PAGES, ...SOLUTION_PAGES];
    this.chunks = [
      ...platformFacts(),
      ...pages.flatMap(pageChunks),
      ...ALL_FAQS.map((faq, index) => ({ id: `faq-${index}`, title: faq.question, path: '/faq', text: faq.answer })),
      ...BLOG_POSTS.flatMap((post) =>
        post.sections.map((section, index) => ({
          id: `blog-${post.slug}-${index}`,
          title: `${post.title}: ${section.heading}`,
          path: `/blog/${post.slug}`,
          text: sectionText(section),
        })),
      ),
    ].filter((chunk) => chunk.text.trim().length > 0);
    this.index = this.chunks.map((chunk) => ({
      chunk,
      title: chunk.title.toLowerCase(),
      body: `${chunk.title}\n${chunk.text}`.toLowerCase(),
    }));
  }

  /** The `limit` most relevant chunks, within `maxChars` in total. */
  search(query: string, limit = 4, maxChars = 3500): KnowledgeChunk[] {
    const queryTerms = [...new Set(terms(query))];
    if (queryTerms.length === 0) return [];
    const documentFrequency = new Map<string, number>();
    for (const term of queryTerms) {
      documentFrequency.set(term, this.index.filter((entry) => entry.body.includes(term)).length);
    }
    const scored = this.index
      .map((entry) => {
        let score = 0;
        for (const term of queryTerms) {
          const df = documentFrequency.get(term) ?? 0;
          if (df === 0 || !entry.body.includes(term)) continue;
          const idf = Math.log(1 + this.index.length / df);
          score += idf * (entry.title.includes(term) ? 3 : 1);
        }
        if (entry.chunk.id.startsWith('fact-')) score *= 1.25;
        return { chunk: entry.chunk, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const picked: KnowledgeChunk[] = [];
    let used = 0;
    for (const { chunk } of scored) {
      if (picked.length >= limit) break;
      const size = chunk.title.length + chunk.text.length;
      if (used + size > maxChars && picked.length > 0) continue;
      picked.push(chunk);
      used += size;
    }
    return picked;
  }
}
