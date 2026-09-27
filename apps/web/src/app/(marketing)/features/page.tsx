import { HubPageView } from '@/components/marketing/content-page';
import { FEATURE_PAGES } from '@/lib/marketing/content';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/features',
  title: 'Ecommerce Features for Bangladesh Online Stores | Ecomesta',
  description:
    'Explore Ecomesta features: online storefront, product and inventory management, orders, customers, coupons, store customization, custom domains and order tracking.',
});

export default function FeaturesPage() {
  return (
    <HubPageView
      crumbs={[
        { name: 'Home', path: '/' },
        { name: 'Features', path: '/features' },
      ]}
      eyebrow="Features"
      title="Everything you need to run an online store"
      intro="Each feature is built into the same platform, so products, stock, orders, payments and delivery stay connected. Pick a feature to see exactly how it works today."
      pages={FEATURE_PAGES}
    />
  );
}
