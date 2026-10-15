import type { Metadata } from 'next';
import AffiliateView from './affiliate-view';

export const metadata: Metadata = {
  title: 'Affiliate program · Ecomesta',
};

export default function AffiliatePage() {
  return <AffiliateView />;
}
