import Link from 'next/link';
import { Card } from '@/components/ui/card';

/**
 * Store SEO is owned by Merchant Settings. Existing theme `seo` values stay in
 * the draft untouched and are only used by the storefront as a fallback.
 */
export function SeoSection() {
  return (
    <Card
      title="SEO"
      description="Search titles, descriptions, social previews and indexing are managed in store settings."
    >
      <Link
        href="/dashboard/settings/seo"
        className="text-sm font-medium text-[var(--color-accent)] hover:underline"
      >
        Open SEO settings
      </Link>
    </Card>
  );
}
