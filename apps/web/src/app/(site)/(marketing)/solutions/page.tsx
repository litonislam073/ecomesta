import { HubPageView } from '@/components/marketing/content-page';
import { SOLUTION_PAGES } from '@/lib/marketing/content';
import { buildMetadata } from '@/lib/marketing/seo';

export const metadata = buildMetadata({
  path: '/solutions',
  title: 'Ecommerce Solutions for Bangladesh Businesses | Ecomesta',
  description:
    'See how Ecomesta fits small businesses, Facebook sellers, established online businesses and retailers who want to sell online in Bangladesh.',
});

export default function SolutionsPage() {
  return (
    <HubPageView
      crumbs={[
        { name: 'Home', path: '/' },
        { name: 'Solutions', path: '/solutions' },
      ]}
      eyebrow="Solutions"
      title="An online store for the way you sell"
      intro="Whether you are opening your first online shop or organising a busy one, the same platform adapts. Choose the situation closest to yours."
      pages={SOLUTION_PAGES}
    />
  );
}
