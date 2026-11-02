/** Theme defaults that must not override the merchant's real store name. */
const PLACEHOLDER_BRANDS = new Set(['your store', 'my store', 'store name', 'brand name']);

/** Public storefront display name: store settings name, unless a real theme override is set. */
export function storeDisplayName(
  store: { name: string },
  brandName?: string | null,
): string {
  const override = brandName?.trim();
  if (!override || PLACEHOLDER_BRANDS.has(override.toLowerCase())) {
    return store.name;
  }
  return override;
}
