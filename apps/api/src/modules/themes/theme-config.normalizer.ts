import { BadRequestException } from '@nestjs/common';
import { THEME_FONT_FAMILIES } from '@ecomesta/utils';
import {
  StoreThemeConfig,
  THEME_BORDER_RADII,
  THEME_HEADER_LAYOUTS,
  THEME_HERO_ALIGNMENTS,
  THEME_LIMITS,
  THEME_SECTION_TYPES,
  THEME_SOCIAL_NETWORKS,
  ThemeAnnouncementConfig,
  ThemeBrandingConfig,
  ThemeFooterConfig,
  ThemeHeaderConfig,
  ThemeHeroConfig,
  ThemeHomepageConfig,
  ThemeHomepageSection,
  ThemeMenuItem,
  ThemeSeoConfig,
  ThemeSocialLink,
  ThemeTypographyConfig,
  structuredCloneConfig,
} from './theme-config.types';

const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function fail(path: string, message: string): never {
  throw new BadRequestException(`configuration.${path} ${message}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null
  );
}

/** Text is stored as-is and rendered by the storefront, so markup is refused. */
function text(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== 'string') {
    fail(path, 'must be a string');
  }
  if (/[<>]/.test(value)) {
    fail(path, 'must not contain HTML markup');
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    fail(path, `must be at most ${maxLength} characters`);
  }
  return trimmed;
}

function color(value: unknown, path: string): string {
  const raw = text(value, path, 32);
  if (!COLOR_PATTERN.test(raw)) {
    fail(path, 'must be a hex color such as #fff or #1a2b3c');
  }
  return raw.toLowerCase();
}

/** Absolute http(s) URLs, or site-relative paths starting with a single `/`. */
function url(value: unknown, path: string): string {
  const raw = text(value, path, THEME_LIMITS.url);
  if (raw.startsWith('//')) {
    fail(path, 'must be an http(s) URL or a relative path starting with /');
  }
  if (raw.startsWith('/')) {
    return raw;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return fail(
      path,
      'must be an http(s) URL or a relative path starting with /',
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    fail(path, 'must use the http or https protocol');
  }
  return parsed.toString();
}

/**
 * Optional URL fields that a merchant may remove. An empty (or whitespace-only)
 * value is kept as `''` in the normalized patch, which `mergeThemeConfiguration`
 * turns into "delete this key". Stored configurations never keep `''` here.
 * Everything else still goes through the full `url()` validation.
 */
export const OPTIONAL_URL_FIELDS = {
  branding: ['logoUrl', 'faviconUrl'],
  announcement: ['href'],
  hero: ['ctaHref', 'imageUrl'],
  seo: ['ogImageUrl'],
} as const satisfies Partial<Record<keyof StoreThemeConfig, readonly string[]>>;

function optionalUrl(value: unknown, path: string): string {
  if (typeof value === 'string' && value.trim() === '') {
    return '';
  }
  return url(value, path);
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    fail(path, 'must be a boolean');
  }
  return value;
}

function num(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(path, 'must be a number');
  }
  if (value < min || value > max) {
    fail(path, `must be between ${min} and ${max}`);
  }
  return value;
}

function oneOf<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(path, `must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function array(value: unknown, path: string, maxItems: number): unknown[] {
  if (!Array.isArray(value)) {
    fail(path, 'must be an array');
  }
  if (value.length > maxItems) {
    fail(path, `must contain at most ${maxItems} items`);
  }
  return value;
}

function section(
  input: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = input[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    fail(key, 'must be an object');
  }
  return value;
}

/** Copies only `keys` that are present, so patches stay partial. */
function pick<T extends object>(
  source: Record<string, unknown>,
  target: T,
  keys: Array<[string, (value: unknown, path: string) => unknown]>,
  prefix: string,
): T {
  for (const [key, parse] of keys) {
    if (source[key] === undefined || source[key] === null) {
      continue;
    }
    (target as Record<string, unknown>)[key] = parse(
      source[key],
      `${prefix}.${key}`,
    );
  }
  return target;
}

function normalizeBranding(input: Record<string, unknown>): ThemeBrandingConfig {
  return pick<ThemeBrandingConfig>(
    input,
    {},
    [
      ['brandName', (v, p) => text(v, p, THEME_LIMITS.brandName)],
      ['tagline', (v, p) => text(v, p, THEME_LIMITS.tagline)],
      ['logoUrl', optionalUrl],
      ['faviconUrl', optionalUrl],
      ['primaryColor', color],
      ['secondaryColor', color],
      ['accentColor', color],
      ['backgroundColor', color],
      ['surfaceColor', color],
      ['textColor', color],
      ['mutedTextColor', color],
      ['borderRadius', (v, p) => oneOf(v, p, THEME_BORDER_RADII)],
    ],
    'branding',
  );
}

function normalizeTypography(
  input: Record<string, unknown>,
  options: NormalizeOptions,
): ThemeTypographyConfig {
  // Requests must name a whitelisted family exactly (TE-06). Configurations
  // already stored are only read back, never re-validated, so a value saved
  // before the whitelist was enforced cannot lock a store out of its editor.
  const font = options.stored
    ? (v: unknown, p: string) => text(v, p, THEME_LIMITS.fontName)
    : (v: unknown, p: string) => oneOf(v, p, THEME_FONT_FAMILIES);
  return pick<ThemeTypographyConfig>(
    input,
    {},
    [
      ['headingFont', font],
      ['bodyFont', font],
      [
        'baseFontSize',
        (v, p) =>
          num(
            v,
            p,
            THEME_LIMITS.baseFontSizeMin,
            THEME_LIMITS.baseFontSizeMax,
          ),
      ],
      ['headingLetterSpacing', (v, p) => num(v, p, -5, 10)],
    ],
    'typography',
  );
}

function normalizeAnnouncement(
  input: Record<string, unknown>,
): ThemeAnnouncementConfig {
  return pick<ThemeAnnouncementConfig>(
    input,
    {},
    [
      ['enabled', bool],
      ['text', (v, p) => text(v, p, THEME_LIMITS.announcementText)],
      ['href', optionalUrl],
      ['backgroundColor', color],
      ['textColor', color],
    ],
    'announcement',
  );
}

function normalizeMenuItems(value: unknown, path: string): ThemeMenuItem[] {
  return array(value, path, THEME_LIMITS.menuItems).map((entry, index) => {
    if (!isPlainObject(entry)) {
      fail(`${path}[${index}]`, 'must be an object');
    }
    return {
      label: text(entry.label, `${path}[${index}].label`, THEME_LIMITS.label),
      href: url(entry.href, `${path}[${index}].href`),
    };
  });
}

function normalizeHeader(input: Record<string, unknown>): ThemeHeaderConfig {
  return pick<ThemeHeaderConfig>(
    input,
    {},
    [
      ['layout', (v, p) => oneOf(v, p, THEME_HEADER_LAYOUTS)],
      ['sticky', bool],
      ['showSearch', bool],
      ['showCart', bool],
      ['menuItems', normalizeMenuItems],
    ],
    'header',
  );
}

function normalizeHero(input: Record<string, unknown>): ThemeHeroConfig {
  return pick<ThemeHeroConfig>(
    input,
    {},
    [
      ['enabled', bool],
      ['headline', (v, p) => text(v, p, THEME_LIMITS.title)],
      ['subheadline', (v, p) => text(v, p, THEME_LIMITS.description)],
      ['ctaLabel', (v, p) => text(v, p, THEME_LIMITS.label)],
      ['ctaHref', optionalUrl],
      ['imageUrl', optionalUrl],
      ['alignment', (v, p) => oneOf(v, p, THEME_HERO_ALIGNMENTS)],
      ['overlayOpacity', (v, p) => num(v, p, 0, 1)],
    ],
    'hero',
  );
}

function normalizeIdList(value: unknown, path: string): string[] {
  const items = array(value, path, THEME_LIMITS.featuredIds).map(
    (entry, index) => {
      const id = text(entry, `${path}[${index}]`, 36);
      if (!UUID_PATTERN.test(id)) {
        fail(`${path}[${index}]`, 'must be a UUID');
      }
      return id.toLowerCase();
    },
  );
  return Array.from(new Set(items));
}

function normalizeSections(
  value: unknown,
  path: string,
): ThemeHomepageSection[] {
  return array(value, path, THEME_LIMITS.sections).map((entry, index) => {
    if (!isPlainObject(entry)) {
      fail(`${path}[${index}]`, 'must be an object');
    }
    const parsed: ThemeHomepageSection = {
      type: oneOf(entry.type, `${path}[${index}].type`, THEME_SECTION_TYPES),
    };
    if (entry.title !== undefined && entry.title !== null) {
      parsed.title = text(
        entry.title,
        `${path}[${index}].title`,
        THEME_LIMITS.title,
      );
    }
    if (entry.enabled !== undefined && entry.enabled !== null) {
      parsed.enabled = bool(entry.enabled, `${path}[${index}].enabled`);
    }
    return parsed;
  });
}

function normalizeHomepage(input: Record<string, unknown>): ThemeHomepageConfig {
  return pick<ThemeHomepageConfig>(
    input,
    {},
    [
      ['featuredCategories', normalizeIdList],
      ['featuredProducts', normalizeIdList],
      ['sections', normalizeSections],
    ],
    'homepage',
  );
}

function normalizeSocialLinks(value: unknown, path: string): ThemeSocialLink[] {
  return array(value, path, THEME_LIMITS.socialLinks).map((entry, index) => {
    if (!isPlainObject(entry)) {
      fail(`${path}[${index}]`, 'must be an object');
    }
    const network = oneOf(
      typeof entry.network === 'string'
        ? entry.network.toLowerCase()
        : entry.network,
      `${path}[${index}].network`,
      THEME_SOCIAL_NETWORKS,
    );
    return { network, url: url(entry.url, `${path}[${index}].url`) };
  });
}

function normalizeFooter(input: Record<string, unknown>): ThemeFooterConfig {
  return pick<ThemeFooterConfig>(
    input,
    {},
    [
      ['tagline', (v, p) => text(v, p, THEME_LIMITS.tagline)],
      ['copyright', (v, p) => text(v, p, THEME_LIMITS.tagline)],
      ['showPaymentIcons', bool],
      ['menuItems', normalizeMenuItems],
      ['socialLinks', normalizeSocialLinks],
    ],
    'footer',
  );
}

function normalizeKeywords(value: unknown, path: string): string[] {
  return array(value, path, THEME_LIMITS.keywords).map((entry, index) =>
    text(entry, `${path}[${index}]`, THEME_LIMITS.keyword),
  );
}

function normalizeSeo(input: Record<string, unknown>): ThemeSeoConfig {
  return pick<ThemeSeoConfig>(
    input,
    {},
    [
      ['title', (v, p) => text(v, p, THEME_LIMITS.title)],
      ['description', (v, p) => text(v, p, THEME_LIMITS.description)],
      ['keywords', normalizeKeywords],
      ['ogImageUrl', optionalUrl],
    ],
    'seo',
  );
}

export interface NormalizeOptions {
  /**
   * The input is a configuration already stored by the API (draft, theme
   * defaults), not a request. Font names are then read back as saved.
   */
  stored?: boolean;
}

/**
 * Pure whitelist pass over a theme configuration payload.
 *
 * Unknown keys are dropped; known keys with unusable values raise 400 so a
 * merchant never silently publishes a broken storefront.
 */
export function normalizeThemeConfiguration(
  input: unknown,
  options: NormalizeOptions = {},
): StoreThemeConfig {
  if (input === undefined || input === null) {
    return {};
  }
  if (!isPlainObject(input)) {
    throw new BadRequestException('configuration must be an object');
  }

  const output: StoreThemeConfig = {};
  const branding = section(input, 'branding');
  if (branding) {
    output.branding = normalizeBranding(branding);
  }
  const typography = section(input, 'typography');
  if (typography) {
    output.typography = normalizeTypography(typography, options);
  }
  const announcement = section(input, 'announcement');
  if (announcement) {
    output.announcement = normalizeAnnouncement(announcement);
  }
  const header = section(input, 'header');
  if (header) {
    output.header = normalizeHeader(header);
  }
  const hero = section(input, 'hero');
  if (hero) {
    output.hero = normalizeHero(hero);
  }
  const homepage = section(input, 'homepage');
  if (homepage) {
    output.homepage = normalizeHomepage(homepage);
  }
  const footer = section(input, 'footer');
  if (footer) {
    output.footer = normalizeFooter(footer);
  }
  const seo = section(input, 'seo');
  if (seo) {
    output.seo = normalizeSeo(seo);
  }

  return output;
}

/**
 * Section-wise merge: scalars overwrite, arrays are replaced wholesale, and an
 * optional URL patched to `''` is removed from its section (siblings stay).
 */
export function mergeThemeConfiguration(
  base: StoreThemeConfig,
  patch: StoreThemeConfig,
): StoreThemeConfig {
  const merged: Record<string, unknown> = structuredCloneConfig({ ...base });
  for (const [key, value] of Object.entries(patch)) {
    const current = merged[key];
    const next =
      isPlainObject(current) && isPlainObject(value)
        ? { ...current, ...value }
        : isPlainObject(value)
          ? { ...value }
          : value;
    const clearable: readonly string[] =
      OPTIONAL_URL_FIELDS[key as keyof typeof OPTIONAL_URL_FIELDS] ?? [];
    if (isPlainObject(next)) {
      for (const field of clearable) {
        if (next[field] === '') {
          delete next[field];
        }
      }
    }
    merged[key] = next;
  }
  return merged as StoreThemeConfig;
}

/** Order-insensitive JSON comparison for `hasUnpublishedChanges`. */
export function themeConfigurationsEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Coerces a Prisma `Json` column into the config shape without trusting it. */
export function asStoreThemeConfig(value: unknown): StoreThemeConfig {
  if (!isPlainObject(value)) {
    return {};
  }
  return value as StoreThemeConfig;
}
