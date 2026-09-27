'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@ecomesta/ui';
import { AccessDenied } from '@/components/admin/access-denied';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export default function LoginForm() {
  const { login, user, loading, isSuperAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && isSuperAdmin) {
      router.replace(next);
    }
  }, [loading, user, isSuperAdmin, router, next]);

  // A valid non-admin session must never fall through to the console.
  if (!loading && user && !isSuperAdmin) {
    return <AccessDenied email={user.email} />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to reach the API. Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || (user && isSuperAdmin)) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center p-8">
        <LoadingState
          label={user ? 'Opening admin console' : 'Checking signed-in session'}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/ecomesta-logo.png" alt="Ecomesta" width={504} height={96} className="h-9 w-auto" />
        <h1 className="mt-2 text-xl font-semibold">Super Admin sign in</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Platform administration for tenants, stores, plans and audit history.
        </p>

        <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
          <label className="block space-y-1.5" htmlFor="login-email">
            <span className="text-sm font-medium">Email</span>
            <Input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block space-y-1.5" htmlFor="login-password">
            <span className="text-sm font-medium">Password</span>
            <Input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-[var(--color-muted)]">
          Merchant accounts belong on the merchant dashboard.
        </p>
      </div>
    </div>
  );
}
