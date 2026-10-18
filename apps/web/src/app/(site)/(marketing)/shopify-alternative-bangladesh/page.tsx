import { SHOPIFY_COMPARISON_PATH, ShopifyComparisonView } from '@/components/marketing/shopify-comparison';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: SHOPIFY_COMPARISON_PATH,
  title: 'Shopify Alternative in Bangladesh — Ecomesta vs Shopify (2026)',
  description:
    'Compare Ecomesta and Shopify for selling in Bangladesh: taka pricing from ৳99, bKash and Nagad, Cash on Delivery, local couriers and no fee on your sales.',
});

export default function ShopifyAlternativePage() {
  return <ShopifyComparisonView />;
}
