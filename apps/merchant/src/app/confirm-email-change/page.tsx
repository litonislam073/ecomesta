import type { Metadata } from 'next';
import ConfirmEmailChangeView from './confirm-email-change-view';
import { AuthLayout } from '@/components/auth/auth-layout';

export const metadata: Metadata = {
  title: 'Confirm new email · Ecomesta',
  description: 'Confirm the new email address for your Ecomesta merchant account.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ConfirmEmailChangeRoute() {
  return (
    <AuthLayout
      eyebrow="Email confirmation"
      heading="Confirm your new email address."
      description="Once confirmed, you sign in to Ecomesta with this address."
      points={[
        'Links are valid for 24 hours',
        'Each link works only once',
        'You can ask for a new link from My account',
      ]}
    >
      <ConfirmEmailChangeView />
    </AuthLayout>
  );
}
