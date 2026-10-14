import type { LandingFieldDef } from './types.js';

/** Icons a landing page section can show; the storefront draws each one. */
export const LANDING_ICONS = [
  { value: 'check', label: 'Check' },
  { value: 'truck', label: 'Delivery truck' },
  { value: 'cash', label: 'Cash' },
  { value: 'refresh', label: 'Exchange' },
  { value: 'shield', label: 'Shield' },
  { value: 'award', label: 'Award' },
  { value: 'layers', label: 'Fabric layers' },
  { value: 'ruler', label: 'Ruler' },
  { value: 'wind', label: 'Breathable' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'wash', label: 'Washing' },
  { value: 'fit', label: 'Fit' },
  { value: 'flask', label: 'Lab test' },
  { value: 'bolt', label: 'Energy' },
  { value: 'cup', label: 'Cup' },
  { value: 'spark', label: 'Sparkle' },
  { value: 'drop', label: 'Drop' },
  { value: 'hand', label: 'Hand' },
  { value: 'moon', label: 'Moon' },
  { value: 'clock', label: 'Clock' },
  { value: 'gift', label: 'Gift' },
  { value: 'heart', label: 'Heart' },
  { value: 'smile', label: 'Smile' },
  { value: 'star', label: 'Star' },
  { value: 'phone', label: 'Phone' },
] as const;

export type LandingIconName = (typeof LANDING_ICONS)[number]['value'];

export const text = (key: string, label: string, max = 160, extra: Partial<LandingFieldDef> = {}): LandingFieldDef => ({
  key,
  label,
  kind: 'text',
  max,
  ...extra,
});

export const area = (key: string, label: string, max = 1200, extra: Partial<LandingFieldDef> = {}): LandingFieldDef => ({
  key,
  label,
  kind: 'textarea',
  max,
  ...extra,
});

export const image = (key: string, label: string, extra: Partial<LandingFieldDef> = {}): LandingFieldDef => ({
  key,
  label,
  kind: 'image',
  ...extra,
});

export const url = (key: string, label: string, extra: Partial<LandingFieldDef> = {}): LandingFieldDef => ({
  key,
  label,
  kind: 'url',
  ...extra,
});

export const number = (key: string, label: string, min: number, max: number, extra: Partial<LandingFieldDef> = {}): LandingFieldDef => ({
  key,
  label,
  kind: 'number',
  min,
  max,
  ...extra,
});

export const toggle = (key: string, label: string, extra: Partial<LandingFieldDef> = {}): LandingFieldDef => ({
  key,
  label,
  kind: 'toggle',
  ...extra,
});

export const icon = (key = 'icon', label = 'Icon'): LandingFieldDef => ({
  key,
  label,
  kind: 'icon',
  options: LANDING_ICONS.map((i) => ({ value: i.value, label: i.label })),
});

export const list = (
  key: string,
  label: string,
  itemLabel: string,
  max: number,
  itemFields: LandingFieldDef[],
  extra: Partial<LandingFieldDef> = {},
): LandingFieldDef => ({ key, label, kind: 'list', itemLabel, max, itemFields, ...extra });

export const products = (key: string, label: string, max: number, extra: Partial<LandingFieldDef> = {}): LandingFieldDef => ({
  key,
  label,
  kind: 'products',
  max,
  ...extra,
});

/** Common blocks. */
export const MARK_HELP = 'Wrap words in ==double equals== to highlight them.';
export const ratingField = number('rating', 'Stars', 1, 5);
export const reviewFields = (withImage = false, withProduct = false): LandingFieldDef[] => [
  text('name', 'Customer name', 80),
  text('location', 'City', 60),
  ratingField,
  area('text', 'Review', 600),
  ...(withProduct ? [text('product', 'Product bought', 80)] : []),
  ...(withImage ? [image('imageUrl', 'Customer photo')] : []),
];
export const faqField = list('items', 'Questions', 'Question', 10, [text('question', 'Question', 200), area('answer', 'Answer', 1000)]);
export const footerFields = (extra: LandingFieldDef[] = []): LandingFieldDef[] => [
  text('brand', 'Shop name', 80, { help: 'Leave empty to use your store name.' }),
  area('text', 'Address or short line', 300),
  text('phone', 'Phone', 30),
  url('facebookUrl', 'Facebook page link'),
  ...extra,
];
