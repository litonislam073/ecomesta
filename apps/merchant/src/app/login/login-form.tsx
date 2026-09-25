'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@ecomesta/ui';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(next);
    }
  }, [loading, user, router, next]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace(next);
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

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm">
        <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
          Ecomesta
        </p>
        <h1 className="mt-2 text-xl font-semibold">Merchant sign in</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Use your Ecomesta account to manage stores and customers.
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
          Forgot password?{' '}
          <span className="text-[var(--color-ink)]">Reset coming soon.</span>
        </p>
      </div>
    </div>
  );
}
