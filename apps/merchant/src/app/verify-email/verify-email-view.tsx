'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CONNECTION_ERROR } from '@/components/auth/auth-errors';
import { LoadingState } from '@/components/ui/loading-state';
import { api } from '@/lib/api-client';
import { linkProblem, takeEmailLinkToken, type LinkProblem } from '@/lib/email-link-token';

const PROBLEM_COPY: Record<LinkProblem, { title: string; body: string }> = {
  invalid: {
    title: 'This confirmation link is not valid',
    body: 'The link may be incomplete or was replaced by a newer one. Request a new link from your dashboard.',
  },
  expired: {
    title: 'This confirmation link has expired',
    body: 'Confirmation links are valid for 48 hours. Request a new link from your dashboard.',
  },
  used: {
    title: 'This link was already used',
    body: 'Your email address may already be confirmed. Sign in to check.',
  },
};

type Phase = { kind: 'checking' } | { kind: 'done' } | { kind: 'problem'; title: string; body: string };

export default function VerifyEmailView() {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  const tokenRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (tokenRef.current === undefined) tokenRef.current = takeEmailLinkToken();
    const token = tokenRef.current;
    if (!token) {
      setPhase({ kind: 'problem', ...PROBLEM_COPY.invalid });
      return;
    }
    let cancelled = false;
    api
      .post('/auth/email-verification/confirm', { token }, { token: null })
      .then(() => !cancelled && setPhase({ kind: 'done' }))
      .catch((err: unknown) => {
        if (cancelled) return;
        const problem = linkProblem(err);
        setPhase(
          problem
            ? { kind: 'problem', ...PROBLEM_COPY[problem] }
            : { kind: 'problem', title: 'We could not confirm your email', body: CONNECTION_ERROR },
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase.kind === 'checking') {
    return <LoadingState label="Confirming your email address" />;
  }

  const title = phase.kind === 'done' ? 'Email address confirmed' : phase.title;
  const body = phase.kind === 'done' ? 'Thanks — your email address is confirmed.' : phase.body;

  return (
    <div role="status" aria-live="polite">
      <h1 className="font-display text-3xl tracking-tight text-[var(--color-ink)]">{title}</h1>
      <p className="mt-3 text-[var(--color-muted)]">{body}</p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--color-accent)] text-base font-semibold text-white hover:bg-[var(--color-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        Go to Your Dashboard
      </Link>
    </div>
  );
}
