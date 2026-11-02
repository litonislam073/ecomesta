import type { Metadata } from 'next';
import type { PublicPlan } from '@ecomesta/types';
import { MarketingHome } from '@/components/marketing/marketing-home';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { buildMetadata } from '@/lib/marketing/seo';

export const PLATFORM_HOME_METADATA: Metadata = buildMetadata({
  path: '/',
  title: 'Ecommerce Website Bangladesh: Online Store from ৳99/month | Ecomesta',
  description:
    'Create your ecommerce website in Bangladesh from ৳99 a month. Cash on Delivery, SSLCommerz online payments, courier booking and delivery zones in one place.',
});

/**
 * Ecomesta SaaS marketing homepage — independent of merchant storefront resolution.
 */
export function PlatformHome({ plans }: { plans?: PublicPlan[] | null } = {}) {
  return (
    <MarketingShell>
      <MarketingHome plans={plans} />
    </MarketingShell>
  );
}
