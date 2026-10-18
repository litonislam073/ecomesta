import type { Metadata } from 'next';
import GuideView from './guide-view';

export const metadata: Metadata = {
  title: 'Store guide · Ecomesta',
};

export default function GuidePage() {
  return <GuideView />;
}
