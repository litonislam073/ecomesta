import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthSplit } from '@/components/auth/auth-layout';
import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { LoadingState } from '@/components/ui/loading-state';
import OnboardForm from './onboard-form';

export const metadata: Metadata = {
  title: 'Set up your store · Ecomesta',
  description: 'Name your Ecomesta store and choose its web address.',
  robots: { index: false, follow: false },
};

export default function OnboardRoute() {
  return (
    <OnboardingShell>
      <AuthSplit
        eyebrow="Store setup"
        heading="Your online store is one step away."
        description="Name your store and choose its web address. Products, payments and delivery options are managed from your dashboard."
        points={[
          'Pay for your plan in the last step: your store goes live as soon as we confirm the payment',
          'Your storefront: an online store at its own web address',
          'Products & orders: manage products, inventory and orders in one place',
          'Payments & delivery: Cash on Delivery, SSLCommerz and Stripe, with delivery charges by area',
        ]}
      >
        <Suspense fallback={<LoadingState label="Loading store setup" />}>
          <OnboardForm />
        </Suspense>
      </AuthSplit>
    </OnboardingShell>
  );
}
