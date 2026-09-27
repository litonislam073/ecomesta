import type { Metadata } from 'next';
import { MarketingHome } from '@/components/marketing/marketing-home';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { buildMetadata } from '@/lib/marketing/seo';

export const PLATFORM_HOME_METADATA: Metadata = buildMetadata({
  path: '/',
  title: 'Ecomesta — Build and Manage Your Online Store in Bangladesh',
  description:
    'Create an online store for your Bangladesh business. Manage products, inventory, orders, Cash on Delivery and SSLCommerz payments, and delivery zones in one place.',
});

/**
 * Ecomesta SaaS marketing homepage — independent of merchant storefront resolution.
 */
export function PlatformHome() {
  return (
    <MarketingShell>
      <MarketingHome />
    </MarketingShell>
  );
}
