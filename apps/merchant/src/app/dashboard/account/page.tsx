'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Button } from '@ecomesta/ui';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status < 500 && err.message) return err.message;
  return fallback;
}

/** The signed-in person's own account: who they are and the email they sign in with. */
export default function AccountPage() {
  const { user, reloadProfile } = useAuth();
  const { pushToast } = useToast();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (!user) return null;
  const pending = user.pendingEmail ?? null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';

  async function requestChange(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (email === user?.email) {
      setError('This is already your email address.');
      return;
    }
    if (!password) {
      setError('Enter your current password.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/email-change', { email, currentPassword: password });
      setSentTo(email);
      setNewEmail('');
      setPassword('');
      await reloadProfile();
    } catch (err) {
      setError(errorMessage(err, 'We could not start the change. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function cancelChange() {
    setBusy(true);
    try {
      await api.post('/auth/email-change/cancel');
      setSentTo(null);
      await reloadProfile();
      pushToast('Email change cancelled.', 'success');
    } catch (err) {
      pushToast(errorMessage(err, 'We could not cancel the change. Please try again.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">My account</h1>
        <p className="mt-2 text-[var(--color-muted)]">Your own sign-in details. They are separate from your store settings.</p>
      </div>

      <Card title="Account details">
        <dl className="divide-y divide-[var(--color-border)] text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3">
            <dt className="w-40 text-[var(--color-muted)]">Name</dt>
            <dd className="font-medium">{name}</dd>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
            <dt className="w-40 text-[var(--color-muted)]">Sign-in email</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium">
              <span className="break-all">{user.email}</span>
              {user.emailVerified === false ? <Badge tone="warning">Not confirmed</Badge> : <Badge tone="success">Confirmed</Badge>}
            </dd>
          </div>
        </dl>
      </Card>

      {pending ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f3d38a] bg-[#fff8e6] px-4 py-3 text-sm"
        >
          <p>
            We sent a link to <span className="break-all font-semibold">{pending}</span>
            {sentTo === pending ? ' just now' : ''}. Open it within 24 hours to start signing in with that address.
            Until then you keep using <span className="break-all font-semibold">{user.email}</span>.
          </p>
          <Button variant="secondary" onClick={() => void cancelChange()} disabled={busy}>
            Cancel change
          </Button>
        </div>
      ) : null}

      <Card
        title="Change email address"
        description="Typed it wrong, or moving to a new address? We send a confirmation link to the new address, so the change only happens once you open it."
      >
        <form onSubmit={(e) => void requestChange(e)} className="space-y-4 px-4 py-4" noValidate>
          <label className="block space-y-1 text-sm">
            <span>New email address</span>
            <Input
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <div className="space-y-1 text-sm">
            <label className="block space-y-1">
              <span>Current password</span>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                aria-describedby="current-password-hint"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <p id="current-password-hint" className="text-xs text-[var(--color-muted)]">
              Signed up with Google and never set a password?{' '}
              <Link href="/forgot-password" className="font-semibold text-[var(--color-accent)] hover:underline">
                Set one first
              </Link>
              .
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy}>
            {busy ? 'Sending…' : pending ? 'Send link to a different address' : 'Send confirmation link'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
