'use client';

import { useState } from 'react';
import { Button } from '@ecomesta/ui';
import { authErrorMessage } from '@/components/auth/auth-errors';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

/** Shown until the merchant confirms their email address. */
export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ kind: 'idle' });

  if (!user || user.emailVerified !== false) return null;

  async function send() {
    setState({ kind: 'sending' });
    try {
      await api.post('/auth/email-verification/send');
      setState({ kind: 'sent' });
    } catch (err) {
      setState({ kind: 'error', message: authErrorMessage(err, 'recovery').message });
    }
  }

  return (
    <div
      role="region"
      aria-label="Email confirmation"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[#f1f8f5] px-4 py-3 text-sm"
    >
      <p className="text-[var(--color-ink)]">
        {state.kind === 'sent' ? (
          <span role="status">We sent a confirmation link to {user.email}. It is valid for 48 hours.</span>
        ) : state.kind === 'error' ? (
          <span role="alert" className="text-[var(--color-danger)]">
            {state.message}
          </span>
        ) : (
          <>
            Please confirm your email address <span className="font-semibold">{user.email}</span> so we can reach
            you about your account.
          </>
        )}
      </p>
      {state.kind !== 'sent' ? (
        <Button variant="secondary" onClick={() => void send()} disabled={state.kind === 'sending'}>
          {state.kind === 'sending' ? 'Sending...' : 'Send confirmation email'}
        </Button>
      ) : null}
    </div>
  );
}
