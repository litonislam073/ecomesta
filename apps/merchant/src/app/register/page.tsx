import { Suspense } from 'react';
import type { Metadata } from 'next';
import RegisterPage from './register-form';
import { AuthLayout } from '@/components/auth/auth-layout';
import { LoadingState } from '@/components/ui/loading-state';

export const metadata: Metadata = {
  title: 'Create your store · Ecomesta',
  description: 'Create an Ecomesta account and set up your online store.',
  alternates: { canonical: 'https://merchant.ecomesta.com/register' },
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
  heading: 'Open your online store in three steps.',
  description:
    'Create your account, set up your store, then choose a plan (or start a free trial). You can add products and payment options from the dashboard.',
  points: [
    'Step 1: create your merchant account',
    'Step 2: set up your store name and web address',
    'Step 3: choose a plan or start a free trial',
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
