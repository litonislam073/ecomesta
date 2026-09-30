/**
 * Theme font families the storefront and the Theme editor can load safely.
 * Single source of truth: the API accepts exactly these values for
 * `typography.headingFont` / `typography.bodyFont`, and the merchant and web
 * font-stack maps are typed against this list so they cannot drift.
 */
export const THEME_FONT_FAMILIES = [
  'Inter',
  'Work Sans',
  'IBM Plex Sans',
  'Source Sans 3',
  'Georgia',
  'Fraunces',
  'System',
] as const;

export type ThemeFontFamily = (typeof THEME_FONT_FAMILIES)[number];

/** Exact, case-sensitive whitelist check (no trimming or normalizing). */
export function isThemeFontFamily(value: unknown): value is ThemeFontFamily {
  return (
    typeof value === 'string' &&
    (THEME_FONT_FAMILIES as readonly string[]).includes(value)
  );
}
