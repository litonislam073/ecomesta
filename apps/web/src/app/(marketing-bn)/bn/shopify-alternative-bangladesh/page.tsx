import { SHOPIFY_COMPARISON_PATH, ShopifyComparisonView } from '@/components/marketing/shopify-comparison';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: `/bn${SHOPIFY_COMPARISON_PATH}`,
  locale: 'bn',
  title: 'বাংলাদেশে Shopify-র বিকল্প — Ecomesta বনাম Shopify (২০২৬)',
  description:
    'বাংলাদেশে বিক্রির জন্য Ecomesta আর Shopify-র তুলনা: ৳৯৯ থেকে টাকায় দাম, bKash ও Nagad, ক্যাশ অন ডেলিভারি, দেশের কুরিয়ার, আর বিক্রিতে কোনো ফি নেই।',
});

export default function BanglaShopifyAlternativePage() {
  return <ShopifyComparisonView locale="bn" />;
}
