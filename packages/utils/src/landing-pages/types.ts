/**
 * Landing pages: one-page campaign sites a merchant builds from a template,
 * with an order form that places real orders for products from the store's
 * catalog. Content is plain JSON validated by `normalizeLandingContent`.
 */

export const LANDING_TEMPLATE_KEYS = ['single_product', 'campaign', 'fashion', 'food', 'story'] as const;
export type LandingTemplateKey = (typeof LANDING_TEMPLATE_KEYS)[number];

export type LandingPageStatus = 'DRAFT' | 'PUBLISHED';

/** One value inside a list item (a review, a FAQ, a step…). */
export type LandingItemValue = string | number | boolean | null;
export type LandingItem = Record<string, LandingItemValue>;
/** A section setting: text, number, toggle, a list of items, or product IDs. */
export type LandingValue = string | number | boolean | null | LandingItem[] | string[];

export interface LandingSection {
  /** Stable within the page; the section type (each type appears once). */
  id: string;
  type: string;
  enabled: boolean;
  settings: Record<string, LandingValue>;
}

export interface LandingCountdown {
  /** `evergreen`: restarts for each visitor; `date`: ends at `endsAt` for everyone; `off`: no timer. */
  mode: 'evergreen' | 'date' | 'off';
  hours: number;
  endsAt: string | null;
}

export interface LandingContent {
  /** Products sold on the page, in display order (single-product templates use the first). */
  productIds: string[];
  /** Template colour overrides (hex); null keeps the template's own. */
  colors: { primary: string | null; accent: string | null };
  seo: { title: string | null; description: string | null; imageUrl: string | null };
  countdown: LandingCountdown;
  sections: LandingSection[];
}

export type LandingFieldKind =
  | 'text'
  | 'textarea'
  | 'image'
  | 'url'
  | 'number'
  | 'toggle'
  | 'select'
  | 'icon'
  | 'list'
  | 'products';

export interface LandingFieldDef {
  key: string;
  label: string;
  kind: LandingFieldKind;
  help?: string;
  /** Text: maximum length. Number: maximum value. List / products: maximum items. */
  max?: number;
  /** Number: minimum value. */
  min?: number;
  options?: { value: string; label: string }[];
  /** List: the fields of each item. */
  itemFields?: LandingFieldDef[];
  /** List: how an item is named in the editor ("Review", "Question"). */
  itemLabel?: string;
  placeholder?: string;
}

export interface LandingSectionDef {
  type: string;
  label: string;
  description: string;
  /** The order form cannot be hidden or removed. */
  required?: boolean;
  fields: LandingFieldDef[];
  defaults: Record<string, LandingValue>;
}

/** Demo product shown in the editor until the merchant picks real products. */
export interface LandingDemoProduct {
  name: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string;
  variants: { name: string; price: number; compareAtPrice: number | null }[];
  note?: string;
}

export interface LandingTemplateDef {
  key: LandingTemplateKey;
  name: string;
  tagline: string;
  description: string;
  /** `single`: one product (its variants are the choices); `multi`: shoppers add several products. */
  productMode: 'single' | 'multi';
  maxProducts: number;
  previewImage: string;
  colors: { primary: string; accent: string; primaryLabel: string; accentLabel: string };
  /** Default countdown for new pages. */
  countdown: LandingCountdown;
  sections: LandingSectionDef[];
  demoProducts: LandingDemoProduct[];
}

export interface LandingPageSummary {
  id: string;
  storeId: string;
  title: string;
  slug: string;
  template: LandingTemplateKey;
  status: LandingPageStatus;
  /** Unsaved-to-live changes: the draft differs from what shoppers see. */
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  orderCount: number;
}

export interface LandingPageDetail extends LandingPageSummary {
  content: LandingContent;
}

export interface LandingPagesUsage {
  allowed: boolean;
  /** Pages the plan allows; null is unlimited. */
  max: number | null;
  used: number;
}
