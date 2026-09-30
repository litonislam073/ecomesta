import type { StoreThemeConfig, ThemeBorderRadius } from '@ecomesta/types';
import {
  THEME_FONT_FAMILIES,
  isThemeFontFamily,
  type ThemeFontFamily,
} from '@ecomesta/utils';

/**
 * Theme color contract, identical to the API's: `#rgb` or `#rrggbb` (either
 * case), surrounding spaces ignored; the API stores it lowercase. Colors have
 * no "remove" operation, so a saved color cannot be emptied.
 */
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const COLOR_FORMAT_MESSAGE = 'Enter a hex color such as #fff or #1a2b3c.';

/** Every merchant-editable theme color, with the label used in messages. */
export const THEME_COLOR_FIELDS: ReadonlyArray<{
  section: 'branding' | 'announcement';
  key: string;
  label: string;
}> = [
  { section: 'branding', key: 'primaryColor', label: 'Primary color' },
  { section: 'branding', key: 'secondaryColor', label: 'Secondary color' },
  { section: 'branding', key: 'accentColor', label: 'Accent color' },
  { section: 'branding', key: 'backgroundColor', label: 'Background color' },
  { section: 'branding', key: 'surfaceColor', label: 'Surface color' },
  { section: 'branding', key: 'textColor', label: 'Text color' },
  { section: 'branding', key: 'mutedTextColor', label: 'Muted text color' },
  { section: 'announcement', key: 'backgroundColor', label: 'Announcement background color' },
  { section: 'announcement', key: 'textColor', label: 'Announcement text color' },
];

/**
 * Why a color field cannot be saved, or null when it can. `value` undefined
 * means untouched; an empty value is only fine while nothing was saved.
 */
export function colorFieldError(
  value: string | undefined,
  saved: string | undefined,
): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === '') {
    return saved ? `${COLOR_FORMAT_MESSAGE} A saved color cannot be left empty.` : null;
  }
  return HEX_COLOR_PATTERN.test(trimmed) ? null : COLOR_FORMAT_MESSAGE;
}

/** Labels of the color fields in `draft` that cannot be saved. */
export function invalidThemeColors(
  draft: StoreThemeConfig,
  saved: StoreThemeConfig,
): string[] {
  const read = (config: StoreThemeConfig, section: string, key: string) =>
    (config as Record<string, Record<string, unknown> | undefined>)[section]?.[key] as
      | string
      | undefined;
  return THEME_COLOR_FIELDS.filter(({ section, key }) =>
    colorFieldError(read(draft, section, key), read(saved, section, key)),
  ).map(({ label }) => label);
}

/** A color safe to render in the editor preview, else the fallback. */
export function validColor(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && HEX_COLOR_PATTERN.test(trimmed) ? trimmed : fallback;
}
export const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Only whitelisted families reach a `font-family` declaration, so a stored
 * config can never inject arbitrary CSS into the preview or the storefront.
 */
export const SYSTEM_FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", sans-serif';

export const THEME_FONT_STACKS: Record<ThemeFontFamily, string> = {
  Inter: "'Inter', system-ui, sans-serif",
  'Work Sans': "'Work Sans', system-ui, sans-serif",
  'IBM Plex Sans': "'IBM Plex Sans', system-ui, sans-serif",
  'Source Sans 3': "'Source Sans 3', system-ui, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Fraunces: "'Fraunces', Georgia, serif",
  System: SYSTEM_FONT_STACK,
};

/** The same whitelist the API enforces (@ecomesta/utils), in display order. */
export const THEME_FONT_OPTIONS: readonly ThemeFontFamily[] = THEME_FONT_FAMILIES;

export function fontStack(name?: string): string {
  if (!name) {
    return SYSTEM_FONT_STACK;
  }
  return isThemeFontFamily(name) ? THEME_FONT_STACKS[name] : SYSTEM_FONT_STACK;
}

export const BORDER_RADIUS_VALUES: Record<ThemeBorderRadius, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '16px',
  full: '9999px',
};

export function radiusValue(radius?: ThemeBorderRadius): string {
  return radius ? BORDER_RADIUS_VALUES[radius] : BORDER_RADIUS_VALUES.md;
}

const BRANDING_COLOR_KEYS = [
  'primaryColor',
  'secondaryColor',
  'accentColor',
  'backgroundColor',
  'surfaceColor',
  'textColor',
  'mutedTextColor',
] as const;

/** CSS custom properties driving both the preview panel and the storefront. */
export function themeCssVariables(
  config: StoreThemeConfig,
): Record<string, string> {
  const branding = config.branding ?? {};
  const typography = config.typography ?? {};
  const vars: Record<string, string> = {
    '--theme-primary': validColor(branding.primaryColor, '#2563eb'),
    '--theme-secondary': validColor(branding.secondaryColor, '#1e293b'),
    '--theme-accent': validColor(
      branding.accentColor,
      validColor(branding.primaryColor, '#f59e0b'),
    ),
    '--theme-bg': validColor(branding.backgroundColor, '#ffffff'),
    '--theme-surface': validColor(branding.surfaceColor, '#f8fafc'),
    '--theme-text': validColor(branding.textColor, '#0f172a'),
    '--theme-muted': validColor(branding.mutedTextColor, '#64748b'),
    '--theme-radius': radiusValue(branding.borderRadius),
    '--theme-heading-font': fontStack(typography.headingFont),
    '--theme-body-font': fontStack(typography.bodyFont),
    '--theme-base-font-size': `${typography.baseFontSize ?? 16}px`,
  };
  if (typeof typography.headingLetterSpacing === 'number') {
    vars['--theme-heading-tracking'] = `${typography.headingLetterSpacing}px`;
  }
  return vars;
}

export function parseIdList(raw: string): string[] {
  const ids = raw
    .split(/[\s,]+/)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => UUID_PATTERN.test(value));
  return Array.from(new Set(ids));
}

export function formatIdList(ids?: string[]): string {
  return (ids ?? []).join(', ');
}

function isBlank(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length === 0;
}

/**
 * `optionalUrlKeys` are URL fields the merchant may remove. A blank value is
 * sent as `''`, which the API treats as "remove this URL" (other values keep
 * full server-side URL validation).
 */
function pruneSection<T extends object>(
  section: T | undefined,
  colorKeys: readonly string[],
  optionalUrlKeys: readonly string[],
): T | undefined {
  if (!section) {
    return undefined;
  }
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(section)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (colorKeys.includes(key)) {
      // Colors are validated before saving (see invalidThemeColors), never
      // silently dropped here. Blank = unset; anything else is sent trimmed,
      // so a value that slipped through is rejected by the API, not ignored.
      const trimmed = String(value).trim();
      if (trimmed !== '') output[key] = trimmed;
      continue;
    }
    if (optionalUrlKeys.includes(key) && isBlank(value)) {
      output[key] = '';
      continue;
    }
    output[key] = value;
  }
  return output as T;
}

/**
 * Shapes the editor draft for the API. Colors are trimmed (never dropped for
 * being invalid: the page blocks saving instead). Cleared optional URLs are
 * sent as `''` so the saved value is removed rather than kept.
 */
export function sanitizeThemeConfig(
  config: StoreThemeConfig,
): StoreThemeConfig {
  const sanitized: StoreThemeConfig = {
    branding: pruneSection(config.branding, BRANDING_COLOR_KEYS, [
      'logoUrl',
      'faviconUrl',
    ]),
    typography: pruneSection(config.typography, [], []),
    announcement: pruneSection(
      config.announcement,
      ['backgroundColor', 'textColor'],
      ['href'],
    ),
    header: pruneSection(config.header, [], []),
    hero: pruneSection(config.hero, [], ['ctaHref', 'imageUrl']),
    homepage: pruneSection(config.homepage, [], []),
    footer: pruneSection(config.footer, [], []),
    seo: pruneSection(config.seo, [], ['ogImageUrl']),
  };

  if (sanitized.header?.menuItems) {
    sanitized.header.menuItems = sanitized.header.menuItems.filter(
      (item) => item.label.trim() !== '' && item.href.trim() !== '',
    );
  }
  if (sanitized.footer?.menuItems) {
    sanitized.footer.menuItems = sanitized.footer.menuItems.filter(
      (item) => item.label.trim() !== '' && item.href.trim() !== '',
    );
  }
  if (sanitized.footer?.socialLinks) {
    sanitized.footer.socialLinks = sanitized.footer.socialLinks.filter(
      (link) => link.url.trim() !== '',
    );
  }
  if (sanitized.seo?.keywords) {
    sanitized.seo.keywords = sanitized.seo.keywords.filter(
      (keyword) => keyword.trim() !== '',
    );
  }

  return sanitized;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

/**
 * The fields of `next` that differ from `saved` (the last configuration loaded
 * from the server). Saving only these means a save never re-sends, and so
 * overwrites, values that another tab or teammate changed in the meantime.
 * Lists (menus, sections, featured ids, social links) are sent whole.
 */
export function changedThemeConfig(
  next: StoreThemeConfig,
  saved: StoreThemeConfig,
): StoreThemeConfig {
  const patch: Record<string, Record<string, unknown>> = {};
  for (const [section, fields] of Object.entries(next)) {
    if (!fields || typeof fields !== 'object') {
      continue;
    }
    const before =
      (saved as Record<string, Record<string, unknown> | undefined>)[section] ?? {};
    for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
      if (stableStringify(value) !== stableStringify(before[key])) {
        (patch[section] ??= {})[key] = value;
      }
    }
  }
  return patch as StoreThemeConfig;
}

/** Optional URL fields: blank in the editor means "not set" (see TE-02). */
const OPTIONAL_URL_KEYS: Record<string, readonly string[]> = {
  branding: ['logoUrl', 'faviconUrl'],
  announcement: ['href'],
  hero: ['ctaHref', 'imageUrl'],
  seo: ['ogImageUrl'],
};

/**
 * The editor's view of a configuration for change detection: unset values,
 * blank optional URLs and empty sections are all "absent", so loading,
 * defaults and key order never count as edits.
 */
function comparableConfig(config: StoreThemeConfig): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [section, fields] of Object.entries(config)) {
    if (!fields || typeof fields !== 'object') continue;
    const blankable = [
      ...(OPTIONAL_URL_KEYS[section] ?? []),
      ...THEME_COLOR_FIELDS.filter((field) => field.section === section).map((field) => field.key),
    ];
    const kept: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      if (blankable.includes(key) && isBlank(value)) continue;
      kept[key] = value;
    }
    if (Object.keys(kept).length > 0) out[section] = kept;
  }
  return out;
}

/**
 * True when the editor holds edits that differ from the last server-saved
 * draft. Deep, order-insensitive for object keys; changing a value back to
 * what was saved makes the editor clean again.
 */
export function isThemeDraftDirty(
  draft: StoreThemeConfig,
  saved: StoreThemeConfig,
): boolean {
  return stableStringify(comparableConfig(draft)) !== stableStringify(comparableConfig(saved));
}

export function parseKeywords(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}
