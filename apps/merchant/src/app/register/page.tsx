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

const AFFILIATE_PANEL = {
  eyebrow: 'Affiliate program',
  heading: 'Earn by bringing businesses to Ecomesta.',
  description: 'Create your account, apply, and share your link once approved. No store needed.',
  points: [
    '20% of each referred business’s first plan payment',
    'Your link is remembered for 30 days after a click',
    'Withdraw to bKash, Nagad, Rocket or Upay from ৳500',
  ],
};

const STORE_PANEL = {
  eyebrow: 'Get started',
  heading: 'Open your online store in two steps.',
  description:
    'Create your account first, then name your store and choose its address. You can add products and payment options from the dashboard.',
  points: [
    'Step 1: create your merchant account',
    'Step 2: set up your store name and web address',
    'Prices in BDT, with Bangladesh delivery areas built in',
  ],
};

export default function RegisterRoute({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const panel = searchParams.for === 'affiliate' ? AFFILIATE_PANEL : STORE_PANEL;
  return (
    <AuthLayout current="register" {...panel}>
      <Suspense fallback={<LoadingState label="Loading registration" />}>
        <RegisterPage />
      </Suspense>
    </AuthLayout>
  );
}
