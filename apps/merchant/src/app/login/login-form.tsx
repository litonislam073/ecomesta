'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@ecomesta/ui';
import { LoadingState } from '@/components/ui/loading-state';
import { AuthField, FormAlert, PasswordField, SecureNote } from '@/components/auth/auth-fields';
import { authErrorMessage, isValidEmail } from '@/components/auth/auth-errors';
import { useAuth } from '@/lib/auth-context';
import { safeNextPath } from '@/lib/plan-selection';

type FieldErrors = { email?: string; password?: string };

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = 'Enter your email address.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (!password) {
    errors.password = 'Enter your password.';
  }
  return errors;
}

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'), '/dashboard');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!loading && user) {
      const destination =
        user.memberships.stores.length === 0
          ? next.startsWith('/onboard')
            ? next
            : '/onboard'
          : next;
      router.replace(destination);
    }
  }, [loading, user, router, next]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) {
      return;
    }
    setError(null);
    const errors = validate(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      const firstInvalid = errors.email ? 'login-email' : 'login-password';
      event.currentTarget.querySelector<HTMLInputElement>(`#${firstInvalid}`)?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // Destination handled by effect after profile loads.
    } catch (err) {
      setError(authErrorMessage(err, 'login'));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  // While verifying an existing HttpOnly refresh session, do not flash the form
  // (that can look like "Login auto-logs you in" without credential submit).
  if (loading || user) {
    return (
      <LoadingState
        label={user ? 'Opening your workspace' : 'Checking signed-in session'}
      />
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-[var(--color-ink)]">
        Welcome back
      </h1>
      <p className="mt-2 text-[var(--color-muted)]">Sign in to manage your online store.</p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate aria-busy={submitting}>
        <AuthField
          id="login-email"
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
          value={email}
          error={fieldErrors.email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
        />
        <PasswordField
          id="login-password"
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          error={fieldErrors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }}
        />

        {error ? <FormAlert message={error.message} details={error.details} /> : null}

        <Button
          type="submit"
          className="h-11 w-full rounded-lg text-base font-semibold"
          disabled={submitting}
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="rounded-sm font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Create your store
        </Link>
      </p>

      <div className="mt-6 border-t border-[var(--color-border)] pt-5">
        <SecureNote />
      </div>
    </div>
  );
}
