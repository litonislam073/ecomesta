import type { StoreThemeConfig, ThemeBorderRadius } from '@ecomesta/types';

export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Only whitelisted families reach a `font-family` declaration, so a stored
 * config can never inject arbitrary CSS into the preview or the storefront.
 */
export const SYSTEM_FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", sans-serif';

export const THEME_FONT_STACKS: Record<string, string> = {
  Inter: "'Inter', system-ui, sans-serif",
  'Work Sans': "'Work Sans', system-ui, sans-serif",
  'IBM Plex Sans': "'IBM Plex Sans', system-ui, sans-serif",
  'Source Sans 3': "'Source Sans 3', system-ui, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Fraunces: "'Fraunces', Georgia, serif",
  System: SYSTEM_FONT_STACK,
};

export const THEME_FONT_OPTIONS = Object.keys(THEME_FONT_STACKS);

export function fontStack(name?: string): string {
  if (!name) {
    return SYSTEM_FONT_STACK;
  }
  return THEME_FONT_STACKS[name] ?? SYSTEM_FONT_STACK;
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
    '--theme-primary': branding.primaryColor ?? '#2563eb',
    '--theme-secondary': branding.secondaryColor ?? '#1e293b',
    '--theme-accent': branding.accentColor ?? branding.primaryColor ?? '#f59e0b',
    '--theme-bg': branding.backgroundColor ?? '#ffffff',
    '--theme-surface': branding.surfaceColor ?? '#f8fafc',
    '--theme-text': branding.textColor ?? '#0f172a',
    '--theme-muted': branding.mutedTextColor ?? '#64748b',
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

function pruneSection<T extends object>(
  section: T | undefined,
  colorKeys: readonly string[],
  urlKeys: readonly string[],
): T | undefined {
  if (!section) {
    return undefined;
  }
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(section)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (colorKeys.includes(key) && !HEX_COLOR_PATTERN.test(String(value))) {
      continue;
    }
    if (urlKeys.includes(key) && isBlank(value)) {
      continue;
    }
    output[key] = value;
  }
  return output as T;
}

/**
 * The API rejects malformed colors and URLs with 400, so half-typed optional
 * values are dropped from the patch instead of failing the whole save.
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
