import { BEAUTY_TEMPLATE } from './templates/beauty.js';
import { CAMPAIGN_TEMPLATE } from './templates/campaign.js';
import { FASHION_TEMPLATE } from './templates/fashion.js';
import { FOOD_TEMPLATE } from './templates/food.js';
import { GADGET_TEMPLATE } from './templates/gadget.js';
import { HOME_TEMPLATE } from './templates/home.js';
import { KIDS_TEMPLATE } from './templates/kids.js';
import { SINGLE_PRODUCT_TEMPLATE } from './templates/single-product.js';
import { STORY_TEMPLATE } from './templates/story.js';
import { TREND_TEMPLATE } from './templates/trend.js';
import {
  LANDING_TEMPLATE_KEYS,
  type LandingContent,
  type LandingCountdown,
  type LandingFieldDef,
  type LandingItem,
  type LandingItemValue,
  type LandingSection,
  type LandingTemplateDef,
  type LandingTemplateKey,
  type LandingValue,
} from './types.js';

export const LANDING_TEMPLATES: Record<LandingTemplateKey, LandingTemplateDef> = {
  single_product: SINGLE_PRODUCT_TEMPLATE,
  campaign: CAMPAIGN_TEMPLATE,
  fashion: FASHION_TEMPLATE,
  food: FOOD_TEMPLATE,
  story: STORY_TEMPLATE,
  gadget: GADGET_TEMPLATE,
  beauty: BEAUTY_TEMPLATE,
  kids: KIDS_TEMPLATE,
  home: HOME_TEMPLATE,
  trend: TREND_TEMPLATE,
};

export const LANDING_TEMPLATE_LIST: LandingTemplateDef[] = LANDING_TEMPLATE_KEYS.map((key) => LANDING_TEMPLATES[key]);

export function isLandingTemplateKey(value: unknown): value is LandingTemplateKey {
  return typeof value === 'string' && (LANDING_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function landingTemplate(key: LandingTemplateKey): LandingTemplateDef {
  return LANDING_TEMPLATES[key];
}

/** Page addresses: lowercase letters, digits and single hyphens. */
export const LANDING_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const LANDING_SLUG_MAX = 80;

/** A slug from a title; Bangla and other non-Latin titles fall back to `page`. */
export function landingSlugFrom(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LANDING_SLUG_MAX)
    .replace(/-+$/g, '');
  return slug || 'page';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-f]{6}$/i;
const COUNTDOWN_MODES = ['evergreen', 'date', 'off'] as const;
const DEFAULT_TEXT_MAX = 2000;
const URL_MAX = 2048;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Text without control characters (newlines kept), trimmed and cut to `max`. */
function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
}

/** http(s) links, or a site-relative path for pictures that ship with Ecomesta. */
function cleanLink(value: unknown, allowRelative: boolean): string {
  const raw = cleanText(value, URL_MAX);
  if (!raw) return '';
  if (allowRelative && raw.startsWith('/') && !raw.startsWith('//') && !/[\s\\]/.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function cleanIds(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const id of value) {
    if (typeof id !== 'string' || !UUID.test(id)) continue;
    const lower = id.toLowerCase();
    if (!ids.includes(lower)) ids.push(lower);
    if (ids.length >= max) break;
  }
  return ids;
}

function cleanScalar(field: LandingFieldDef, value: unknown, fallback: LandingValue | undefined): LandingItemValue {
  switch (field.kind) {
    case 'text':
    case 'textarea':
      return cleanText(value, field.max ?? DEFAULT_TEXT_MAX);
    case 'image':
      return cleanLink(value, true);
    case 'url':
      return cleanLink(value, false);
    case 'number': {
      const min = field.min ?? 0;
      const max = field.max ?? Number.MAX_SAFE_INTEGER;
      const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
      if (!Number.isFinite(n)) return typeof fallback === 'number' ? fallback : min;
      return Math.min(max, Math.max(min, Math.round(n)));
    }
    case 'toggle':
      return typeof value === 'boolean' ? value : fallback === true;
    case 'select':
    case 'icon': {
      const allowed = field.options?.map((o) => o.value) ?? [];
      if (typeof value === 'string' && allowed.includes(value)) return value;
      return typeof fallback === 'string' && allowed.includes(fallback) ? fallback : (allowed[0] ?? '');
    }
    default:
      return null;
  }
}

function cleanItem(fields: LandingFieldDef[], raw: unknown): LandingItem {
  const source = isRecord(raw) ? raw : {};
  const item: LandingItem = {};
  for (const field of fields) {
    item[field.key] = cleanScalar(field, source[field.key], undefined);
  }
  return item;
}

function cleanSettings(fields: LandingFieldDef[], raw: unknown, defaults: Record<string, LandingValue>): Record<string, LandingValue> {
  const source = isRecord(raw) ? raw : {};
  const settings: Record<string, LandingValue> = {};
  for (const field of fields) {
    const has = Object.prototype.hasOwnProperty.call(source, field.key);
    const value = has ? source[field.key] : defaults[field.key];
    if (field.kind === 'list') {
      const items = Array.isArray(value) ? value : [];
      settings[field.key] = items.slice(0, field.max ?? 20).map((item) => cleanItem(field.itemFields ?? [], item));
    } else if (field.kind === 'products') {
      settings[field.key] = cleanIds(value, field.max ?? 12);
    } else {
      settings[field.key] = cleanScalar(field, value, defaults[field.key]);
    }
  }
  return settings;
}

function cleanCountdown(raw: unknown, fallback: LandingCountdown): LandingCountdown {
  const source = isRecord(raw) ? raw : {};
  const mode = COUNTDOWN_MODES.includes(source.mode as LandingCountdown['mode']) ? (source.mode as LandingCountdown['mode']) : fallback.mode;
  const hoursRaw = typeof source.hours === 'number' ? source.hours : Number(source.hours);
  const hours = Number.isFinite(hoursRaw) ? Math.min(720, Math.max(1, Math.round(hoursRaw))) : fallback.hours;
  let endsAt: string | null = null;
  if (typeof source.endsAt === 'string' && source.endsAt.trim()) {
    const parsed = new Date(source.endsAt);
    endsAt = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return { mode, hours, endsAt };
}

/** A new page: every section with the template's demo content, no products yet. */
export function defaultLandingContent(key: LandingTemplateKey): LandingContent {
  const template = LANDING_TEMPLATES[key];
  return {
    productIds: [],
    colors: { primary: null, accent: null },
    seo: { title: null, description: null, imageUrl: null },
    countdown: { ...template.countdown },
    sections: template.sections.map((section) => ({
      id: section.type,
      type: section.type,
      enabled: true,
      settings: clone(section.defaults),
    })),
  };
}

/**
 * Validates page content against its template: unknown sections, settings and
 * keys are dropped, text is cut to length, links must be http(s) (or a
 * site-relative picture path), and every section of the template is present
 * exactly once (missing ones come back hidden; the order form is always on).
 */
export function normalizeLandingContent(key: LandingTemplateKey, raw: unknown): LandingContent {
  const template = LANDING_TEMPLATES[key];
  const source = isRecord(raw) ? raw : {};
  const colors = isRecord(source.colors) ? source.colors : {};
  const seo = isRecord(source.seo) ? source.seo : {};

  const sections: LandingSection[] = [];
  const seen = new Set<string>();
  const rawSections = Array.isArray(source.sections) ? source.sections : [];
  for (const rawSection of rawSections) {
    if (!isRecord(rawSection) || typeof rawSection.type !== 'string') continue;
    const def = template.sections.find((s) => s.type === rawSection.type);
    if (!def || seen.has(def.type)) continue;
    seen.add(def.type);
    sections.push({
      id: def.type,
      type: def.type,
      enabled: def.required ? true : rawSection.enabled !== false,
      settings: cleanSettings(def.fields, rawSection.settings, def.defaults),
    });
  }
  for (const def of template.sections) {
    if (seen.has(def.type)) continue;
    sections.push({ id: def.type, type: def.type, enabled: !!def.required, settings: clone(def.defaults) });
  }

  const color = (value: unknown) => (typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : null);
  const nullable = (value: string) => (value ? value : null);
  return {
    productIds: cleanIds(source.productIds, template.maxProducts),
    colors: { primary: color(colors.primary), accent: color(colors.accent) },
    seo: {
      title: nullable(cleanText(seo.title, 120)),
      description: nullable(cleanText(seo.description, 320)),
      imageUrl: nullable(cleanLink(seo.imageUrl, true)),
    },
    countdown: cleanCountdown(source.countdown, template.countdown),
    sections,
  };
}

/** Every product a page sells: its main products and those named in sections (combos). */
export function landingProductIds(content: LandingContent): string[] {
  const ids = [...content.productIds];
  for (const section of content.sections) {
    for (const value of Object.values(section.settings)) {
      if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        for (const id of value as string[]) if (UUID.test(id) && !ids.includes(id)) ids.push(id);
      }
    }
  }
  return ids;
}

export function landingSection(content: LandingContent, type: string): LandingSection | undefined {
  return content.sections.find((section) => section.type === type);
}

/**
 * `==marked==` and `~~underlined~~` spans in landing page text, as plain
 * pieces the storefront renders (never HTML).
 */
export function landingMarkup(textValue: string): { text: string; style: 'plain' | 'mark' | 'squiggle' }[] {
  const pieces: { text: string; style: 'plain' | 'mark' | 'squiggle' }[] = [];
  const pattern = /==(.+?)==|~~(.+?)~~/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(textValue))) {
    if (match.index > last) pieces.push({ text: textValue.slice(last, match.index), style: 'plain' });
    if (match[1] !== undefined) pieces.push({ text: match[1], style: 'mark' });
    else pieces.push({ text: match[2]!, style: 'squiggle' });
    last = match.index + match[0].length;
  }
  if (last < textValue.length) pieces.push({ text: textValue.slice(last), style: 'plain' });
  return pieces;
}
