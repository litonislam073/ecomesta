'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CONNECTION_ERROR } from '@/components/auth/auth-errors';
import { LoadingState } from '@/components/ui/loading-state';
import { ApiError, api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { linkProblem, takeEmailLinkToken, type LinkProblem } from '@/lib/email-link-token';

const PROBLEM_COPY: Record<LinkProblem, { title: string; body: string }> = {
  invalid: {
    title: 'This link is not valid',
    body: 'The link may be incomplete, replaced by a newer one, or the change was cancelled. Ask for a new link from My account.',
  },
  expired: {
    title: 'This link has expired',
    body: 'Email change links are valid for 24 hours. Ask for a new link from My account.',
  },
  used: {
    title: 'This link was already used',
    body: 'Your email address may already be changed. Sign in with your new address to check.',
  },
};

type Phase =
  | { kind: 'checking' }
  | { kind: 'done'; email: string }
  | { kind: 'problem'; title: string; body: string };

export default function ConfirmEmailChangeView() {
  const { user, reloadProfile } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  const tokenRef = useRef<string | null | undefined>(undefined);
  const signedIn = Boolean(user);
  const reloadRef = useRef(reloadProfile);
  reloadRef.current = reloadProfile;

  useEffect(() => {
    if (tokenRef.current === undefined) tokenRef.current = takeEmailLinkToken();
    const token = tokenRef.current;
    if (!token) {
      setPhase({ kind: 'problem', ...PROBLEM_COPY.invalid });
      return;
    }
    let cancelled = false;
    api
      .post<{ success: true; data: { email: string } }>('/auth/email-change/confirm', { token }, { token: null })
      .then(async (res) => {
        if (cancelled) return;
        setPhase({ kind: 'done', email: res.data.email });
        // A signed-in tab should show the new address straight away.
        await reloadRef.current().catch(() => undefined);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
          setPhase({ kind: 'problem', title: 'This address is already in use', body: err.message });
          return;
        }
        const problem = linkProblem(err);
        setPhase(
          problem
            ? { kind: 'problem', ...PROBLEM_COPY[problem] }
            : { kind: 'problem', title: 'We could not change your email', body: CONNECTION_ERROR },
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase.kind === 'checking') {
    return <LoadingState label="Confirming your new email address" />;
  }

  const done = phase.kind === 'done';
  const title = done ? 'Email address changed' : phase.title;

  return (
    <div role="status" aria-live="polite">
      <h1 className="font-display text-3xl tracking-tight text-[var(--color-ink)]">{title}</h1>
      <p className="mt-3 text-[var(--color-muted)]">
        {done ? (
          <>
            From now on, sign in with <span className="break-all font-semibold text-[var(--color-ink)]">{phase.email}</span>.
            Your password stays the same.
          </>
        ) : (
          phase.body
        )}
      </p>
      <Link
        href={signedIn ? (done ? '/dashboard' : '/dashboard/account') : '/login'}
        className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--color-accent)] text-base font-semibold text-white hover:bg-[var(--color-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        {signedIn ? (done ? 'Go to Your Dashboard' : 'Open My account') : 'Sign In'}
      </Link>
    </div>
  );
}
