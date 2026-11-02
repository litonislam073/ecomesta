/** Longest store address: a single DNS label (`{slug}.ecomesta.com`). */
export const STORE_SLUG_MAX = 63;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The address suggested from a business or store name: letters and digits run
 * together, so "Amar Shop" becomes `amarshop` (merchants can still type a
 * hyphen themselves).
 */
export function suggestStoreSlug(name: string, max = STORE_SLUG_MAX): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, max);
}

/** What a merchant types into the address field, cleaned as they type. */
export function cleanStoreSlugInput(value: string, max = STORE_SLUG_MAX): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, max);
}

export function isValidStoreSlug(slug: string, max = STORE_SLUG_MAX): boolean {
  return slug.length >= 2 && slug.length <= max && SLUG_PATTERN.test(slug);
}
