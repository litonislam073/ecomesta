import type { Metadata } from 'next';
import VerifyEmailView from './verify-email-view';
import { AuthLayout } from '@/components/auth/auth-layout';

export const metadata: Metadata = {
  title: 'Confirm email · Ecomesta',
  description: 'Confirm the email address for your Ecomesta merchant account.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function VerifyEmailRoute() {
  return (
    <AuthLayout
      eyebrow="Email confirmation"
      heading="Confirm your email address."
      description="A confirmed email lets us reach you about your account, security and billing."
      points={[
        'Confirmation links are valid for 48 hours',
        'Each link works only once',
        'You can request a new link from your dashboard',
      ]}
    >
      <VerifyEmailView />
    </AuthLayout>
  );
}
