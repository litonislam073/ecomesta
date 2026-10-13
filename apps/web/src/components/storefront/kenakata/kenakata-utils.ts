import type { PublicProductCard } from '@ecomesta/types';

/** Kenakata's colours come from the theme (merchants can change them); these are the design defaults. */
export const KK = {
  ink: 'var(--theme-secondary, #14211c)',
  sale: '#b4361e',
  sun: 'var(--theme-accent, #f4b63f)',
} as const;

/** Percent off for a simple product on sale; null when it is not discounted. */
export function kenakataDiscount(product: PublicProductCard): number | null {
  if (product.hasVariants || !product.compareAtPrice) return null;
  const price = Number(product.price);
  const was = Number(product.compareAtPrice);
  if (!(was > price && price >= 0)) return null;
  return Math.round(((was - price) / was) * 100);
}
