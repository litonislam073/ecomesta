import type { Metadata } from 'next';
import SupportView from './support-view';

export const metadata: Metadata = {
  title: 'Help & support · Ecomesta',
};

export default function SupportPage() {
  return <SupportView />;
}
