const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidSlug(raw: string): boolean {
  const slug = normalizeSlug(raw);
  return slug.length >= 2 && slug.length <= 64 && SLUG_PATTERN.test(slug);
}

export const SLUG_REGEX = SLUG_PATTERN;
