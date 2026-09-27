import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoadingState } from '@/components/ui/loading-state';
import BillingView from './billing-view';

export const metadata: Metadata = {
  title: 'Plan & billing · Ecomesta',
};

export default function BillingPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading your subscription" />}>
      <BillingView />
    </Suspense>
  );
}
