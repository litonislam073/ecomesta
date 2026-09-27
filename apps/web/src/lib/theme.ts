import type {
  PublicStoreTheme,
  StoreThemeConfig,
  ThemeBorderRadius,
} from '@ecomesta/types';
import { publicGet } from '@/lib/public-api';

export const EMPTY_PUBLIC_THEME: PublicStoreTheme = {
  theme: null,
  publishedAt: null,
  configuration: {},
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Whitelisted families only. A stored font name never reaches a CSS
 * declaration verbatim, so a hostile config cannot inject style rules.
 */
const FONT_STACKS: Record<string, string> = {
  Inter: "'Inter', system-ui, sans-serif",
  'Work Sans': "'Work Sans', system-ui, sans-serif",
  'IBM Plex Sans': "'IBM Plex Sans', system-ui, sans-serif",
  'Source Sans 3': "'Source Sans 3', 'Segoe UI', sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Fraunces: "'Fraunces', Georgia, serif",
  System: 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

const BORDER_RADIUS_VALUES: Record<ThemeBorderRadius, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '16px',
  full: '9999px',
};

export function fontStack(name: string | undefined, fallback: string): string {
  if (!name) {
    return fallback;
  }
  return FONT_STACKS[name] ?? fallback;
}

export function radiusValue(radius: ThemeBorderRadius | undefined): string | null {
  return radius ? BORDER_RADIUS_VALUES[radius] : null;
}

function color(value: string | undefined): string | null {
  return value && HEX_COLOR_PATTERN.test(value) ? value.toLowerCase() : null;
}

function expandHex(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

/** Darkens a validated hex color for hover states. */
export function shade(hex: string, amount: number): string {
  const full = expandHex(hex);
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(full.slice(offset, offset + 2), 16);
    const next = Math.round(value * (1 - amount));
    return Math.max(0, Math.min(255, next))
      .toString(16)
      .padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

/**
 * Maps a published configuration onto the CSS custom properties the storefront
 * already renders with, so unset values keep the packaged defaults.
 */
export function themeCssVariables(
  config: StoreThemeConfig,
): Record<string, string> {
  const branding = config.branding ?? {};
  const typography = config.typography ?? {};
  const vars: Record<string, string> = {};

  const primary = color(branding.primaryColor);
  if (primary) {
    vars['--color-accent'] = primary;
    vars['--color-accent-hover'] = shade(primary, 0.15);
  }
  const secondary = color(branding.secondaryColor);
  if (secondary) {
    vars['--theme-secondary'] = secondary;
  }
  const accent = color(branding.accentColor);
  if (accent) {
    vars['--theme-accent'] = accent;
  }
  const background = color(branding.backgroundColor);
  if (background) {
    vars['--color-bg'] = background;
  }
  const surface = color(branding.surfaceColor);
  if (surface) {
    vars['--color-surface'] = surface;
  }
  const text = color(branding.textColor);
  if (text) {
    vars['--color-ink'] = text;
  }
  const muted = color(branding.mutedTextColor);
  if (muted) {
    vars['--color-muted'] = muted;
  }
  const radius = radiusValue(branding.borderRadius);
  if (radius) {
    vars['--theme-radius'] = radius;
  }
  if (typography.headingFont) {
    vars['--font-display'] = fontStack(
      typography.headingFont,
      "'Fraunces', Georgia, serif",
    );
  }
  if (typography.bodyFont) {
    vars['--font-sans'] = fontStack(
      typography.bodyFont,
      "'Source Sans 3', 'Segoe UI', sans-serif",
    );
  }
  if (typeof typography.baseFontSize === 'number') {
    vars['--theme-base-font-size'] = `${typography.baseFontSize}px`;
  }
  if (typeof typography.headingLetterSpacing === 'number') {
    vars['--theme-heading-tracking'] = `${typography.headingLetterSpacing}px`;
  }

  return vars;
}

/** Theming must never break a storefront, so failures fall back to defaults. */
export async function fetchPublicTheme(
  storeSlug: string,
): Promise<PublicStoreTheme> {
  try {
    const result = await publicGet<{ success: true; data: PublicStoreTheme }>(
      `/public/stores/${encodeURIComponent(storeSlug)}/theme`,
    );
    return result.data;
  } catch {
    return EMPTY_PUBLIC_THEME;
  }
}

export function withStoreParam(href: string, storeSlug: string): string {
  if (/^https?:\/\//i.test(href)) {
    return href;
  }
  const url = new URL(href.startsWith('/') ? href : `/${href}`, 'http://local');
  url.searchParams.set('store', storeSlug);
  return `${url.pathname}${url.search}`;
}
