import type { LandingContent, LandingTemplateKey } from '@ecomesta/utils';
import palette from './landing-palette.json';

type PaletteEntry = {
  prefix: string;
  tokens: Record<string, string>;
  /** Tokens derived from the merchant's main colour: 0 = the colour, negative = darker, positive = lighter. */
  primary: Record<string, number>;
  accent: Record<string, number>;
};

const PALETTE = palette as Record<LandingTemplateKey, PaletteEntry>;

/** Fonts per template (CSS variables set by the root layout). */
const FONTS: Record<LandingTemplateKey, { sans: string; display: string }> = {
  single_product: { sans: 'var(--font-hind-siliguri)', display: 'var(--font-hind-siliguri)' },
  campaign: { sans: 'var(--font-hind-siliguri)', display: 'var(--font-tiro-bangla)' },
  fashion: { sans: 'var(--font-hind-siliguri)', display: 'var(--font-cormorant), var(--font-hind-siliguri)' },
  food: { sans: 'var(--font-hind-siliguri)', display: 'var(--font-baloo-da), var(--font-hind-siliguri)' },
  story: { sans: 'var(--font-noto-serif-bengali)', display: 'var(--font-anek-bangla), var(--font-noto-serif-bengali)' },
};

function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** `amount` < 0 mixes towards black, > 0 towards white. */
export function shade(hex: string, amount: number): [number, number, number] {
  const [r, g, b] = rgb(hex);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  return [r, g, b].map((c) => Math.round(c + (target - c) * t)) as [number, number, number];
}

const channels = ([r, g, b]: [number, number, number]) => `${r} ${g} ${b}`;

/** The CSS variables a landing page sets: its template's palette with the merchant's colours. */
export function landingThemeStyle(template: LandingTemplateKey, colors: LandingContent['colors']): Record<string, string> {
  const entry = PALETTE[template];
  const style: Record<string, string> = {
    '--font-sans': FONTS[template].sans,
    '--font-display': FONTS[template].display,
  };
  for (const [token, hex] of Object.entries(entry.tokens)) {
    style[`--${entry.prefix}-${token}`] = channels(rgb(hex));
  }
  const apply = (hex: string | null, derived: Record<string, number>) => {
    if (!hex) return;
    for (const [token, amount] of Object.entries(derived)) {
      style[`--${entry.prefix}-${token}`] = channels(amount === 0 ? rgb(hex) : shade(hex, amount));
    }
  };
  apply(colors.primary, entry.primary);
  apply(colors.accent, entry.accent);
  return style;
}

/** A palette colour as a CSS colour, for the few inline styles (accent-color, SVG fills). */
export function landingColor(template: LandingTemplateKey, token: string): string {
  return `rgb(var(--${PALETTE[template].prefix}-${token}))`;
}
