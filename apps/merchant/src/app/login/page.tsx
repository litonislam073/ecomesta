import { Suspense } from 'react';
import type { Metadata } from 'next';
import LoginPage from './login-form';
import { AuthLayout } from '@/components/auth/auth-layout';
import { LoadingState } from '@/components/ui/loading-state';

export const metadata: Metadata = {
  title: 'Sign in · Ecomesta',
  description: 'Sign in to manage your Ecomesta online store.',
  robots: { index: false, follow: false },
};

export default function LoginRoute() {
  return (
    <AuthLayout
      current="login"
      eyebrow="Merchant sign in"
      heading="Everything your store needs, in one dashboard."
      description="Pick up where you left off — products, orders, payments and delivery for your Bangladesh store."
      points={[
        'Manage products, inventory and orders from one place',
        'Accept Cash on Delivery, SSLCommerz and Stripe payments',
        'Delivery charges by division, district and upazila',
      ]}
    >
      <Suspense fallback={<LoadingState label="Loading sign in" />}>
        <LoginPage />
      </Suspense>
    </AuthLayout>
  );
}
