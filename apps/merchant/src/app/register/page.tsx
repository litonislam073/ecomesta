import { Suspense } from 'react';
import type { Metadata } from 'next';
import RegisterPage from './register-form';
import { AuthLayout } from '@/components/auth/auth-layout';
import { LoadingState } from '@/components/ui/loading-state';

export const metadata: Metadata = {
  title: 'Create your store · Ecomesta',
  description: 'Create an Ecomesta account and set up your online store.',
  robots: { index: false, follow: false },
};

export default function RegisterRoute() {
  return (
    <AuthLayout
      current="register"
      eyebrow="Get started"
      heading="Open your online store in two steps."
      description="Create your account first, then name your store and choose its address. You can add products and payment options from the dashboard."
      points={[
        'Step 1: create your merchant account',
        'Step 2: set up your store name and web address',
        'Prices in BDT, with Bangladesh delivery areas built in',
      ]}
    >
      <Suspense fallback={<LoadingState label="Loading registration" />}>
        <RegisterPage />
      </Suspense>
    </AuthLayout>
  );
}
