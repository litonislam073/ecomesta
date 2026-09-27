import type { Metadata } from 'next';
import ForgotPasswordForm from './forgot-password-form';
import { AuthLayout } from '@/components/auth/auth-layout';

export const metadata: Metadata = {
  title: 'Forgot password · Ecomesta',
  description: 'Reset the password for your Ecomesta merchant account.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordRoute() {
  return (
    <AuthLayout
      eyebrow="Account recovery"
      heading="Get back into your store."
      description="Enter the email address you use for Ecomesta and we'll send you a secure link to choose a new password."
      points={[
        'Reset links expire after 60 minutes',
        'Each link works only once',
        'You will be signed out on all devices after resetting',
      ]}
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
