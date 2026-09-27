import type { Metadata } from 'next';
import ResetPasswordForm from './reset-password-form';
import { AuthLayout } from '@/components/auth/auth-layout';

export const metadata: Metadata = {
  title: 'Reset password · Ecomesta',
  description: 'Choose a new password for your Ecomesta merchant account.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ResetPasswordRoute() {
  return (
    <AuthLayout
      eyebrow="Account recovery"
      heading="Choose a new password."
      description="Pick a password you haven't used for Ecomesta before. After you save it, you'll sign in again on every device."
      points={[
        'At least 8 characters with a letter and a number',
        'All existing sessions are signed out',
        'We email you to confirm the change',
      ]}
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}
