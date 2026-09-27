'use client';

import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@ecomesta/ui';
import { AuthField, FormAlert } from '@/components/auth/auth-fields';
import { authErrorMessage, isValidEmail } from '@/components/auth/auth-errors';
import { api } from '@/lib/api-client';

export const FORGOT_PASSWORD_SENT =
  'If an account exists for that email, you will receive password reset instructions.';

const LINK_CLASSES =
  'rounded-sm font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const inFlight = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    if (!email.trim()) {
      setFieldError('Enter your email address.');
      return;
    }
    if (!isValidEmail(email)) {
      setFieldError('Enter a valid email address.');
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() }, { token: null });
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err, 'recovery'));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div role="status" aria-live="polite">
        <h1 className="font-display text-3xl tracking-tight text-[var(--color-ink)]">Check your email</h1>
        <p className="mt-3 text-[var(--color-muted)]">{FORGOT_PASSWORD_SENT}</p>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          The link expires in 60 minutes. If nothing arrives, check your spam folder or try again.
        </p>
        <p className="mt-8 text-center text-sm">
          <Link href="/login" className={LINK_CLASSES}>
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-[var(--color-ink)]">Forgot your password?</h1>
      <p className="mt-2 text-[var(--color-muted)]">
        Enter your account email and we&apos;ll send you a link to reset it.
      </p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate aria-busy={submitting}>
        <AuthField
          id="forgot-email"
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
          value={email}
          error={fieldError}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldError) setFieldError(undefined);
          }}
        />

        {error ? <FormAlert message={error.message} details={error.details} /> : null}

        <Button type="submit" className="h-11 w-full rounded-lg text-base font-semibold" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send Reset Link'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
        Remembered it?{' '}
        <Link href="/login" className={LINK_CLASSES}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
