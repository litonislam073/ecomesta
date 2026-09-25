const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function isValidSlug(raw: string): boolean {
  const slug = normalizeSlug(raw);
  return slug.length >= 2 && slug.length <= 64 && SLUG_PATTERN.test(slug);
}

export function slugifyFromName(name: string): string {
  return normalizeSlug(name);
}

export function isNonNegativeMoney(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim());
}

export function humanApiError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    const message = (error as { message: string }).message;
    if (message.includes('child categories')) {
      return 'This category cannot be deleted because it still has child categories.';
    }
    if (message.includes('products are assigned') || message.includes('products assigned')) {
      return 'This category cannot be deleted because products are still assigned to it.';
    }
    if (message.includes('circular') || message.includes('own parent')) {
      return 'That parent would create a circular category relationship.';
    }
    if (message.includes('cannot become negative')) {
      return 'This adjustment would make stock negative. Enable backorders or enter a smaller change.';
    }
    if (message.includes('non-zero inventory')) {
      return 'Set variant inventory to zero before deleting it.';
    }
    if (message.includes('Insufficient') || message.includes('do not have access')) {
      return 'You do not have permission to perform this action.';
    }
    return message;
  }
  return fallback;
}
