'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@ecomesta/ui';
import { FormAlert, PasswordField } from '@/components/auth/auth-fields';
import { CONNECTION_ERROR, authErrorMessage } from '@/components/auth/auth-errors';
import { PasswordRules, meetsPasswordRules } from '@/components/auth/password-rules';
import { LoadingState } from '@/components/ui/loading-state';
import { api } from '@/lib/api-client';
import { linkProblem, takeEmailLinkToken, type LinkProblem } from '@/lib/email-link-token';

const LINK_CLASSES =
  'rounded-sm font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]';

const PROBLEM_COPY: Record<LinkProblem, { title: string; body: string }> = {
  invalid: {
    title: 'This reset link is not valid',
    body: 'The link may be incomplete or was replaced by a newer one. Request a new link to continue.',
  },
  expired: {
    title: 'This reset link has expired',
    body: 'Reset links are valid for 60 minutes. Request a new link to continue.',
  },
  used: {
    title: 'This reset link was already used',
    body: 'Each link works once. If you still need to change your password, request a new link.',
  },
};

type Phase =
  | { kind: 'checking' }
  | { kind: 'problem'; problem: LinkProblem }
  | { kind: 'unavailable' }
  | { kind: 'form'; token: string }
  | { kind: 'done' };

type FieldErrors = { password?: string; confirm?: string };

export default function ResetPasswordForm() {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const tokenRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (tokenRef.current === undefined) tokenRef.current = takeEmailLinkToken();
    const token = tokenRef.current;
    if (!token) {
      setPhase({ kind: 'problem', problem: 'invalid' });
      return;
    }
    let cancelled = false;
    api
      .post('/auth/reset-password/validate', { token }, { token: null })
      .then(() => !cancelled && setPhase({ kind: 'form', token }))
      .catch((err: unknown) => {
        if (cancelled) return;
        const problem = linkProblem(err);
        setPhase(problem ? { kind: 'problem', problem } : { kind: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || phase.kind !== 'form') return;
    setError(null);
    const errors: FieldErrors = {};
    if (!password) errors.password = 'Enter a new password.';
    else if (!meetsPasswordRules(password)) errors.password = 'Password does not meet the requirements below.';
    if (!confirm) errors.confirm = 'Confirm your new password.';
    else if (password && confirm !== password) errors.confirm = 'Passwords do not match.';
    setFieldErrors(errors);
    if (errors.password || errors.confirm) {
      const first = errors.password ? 'reset-password' : 'reset-confirm';
      event.currentTarget.querySelector<HTMLInputElement>(`#${first}`)?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token: phase.token, password }, { token: null });
      setPhase({ kind: 'done' });
    } catch (err) {
      const problem = linkProblem(err);
      if (problem && problem !== 'invalid') {
        setPhase({ kind: 'problem', problem });
      } else {
        setError(authErrorMessage(err, 'recovery'));
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (phase.kind === 'checking') {
    return <LoadingState label="Checking your reset link" />;
  }

  if (phase.kind === 'problem' || phase.kind === 'unavailable') {
    const copy =
      phase.kind === 'problem'
        ? PROBLEM_COPY[phase.problem]
        : { title: 'We could not check your link', body: CONNECTION_ERROR };
    return (
      <div>
        <h1 className="font-display text-3xl tracking-tight text-[var(--color-ink)]">{copy.title}</h1>
        <p className="mt-3 text-[var(--color-muted)]">{copy.body}</p>
        <Link
          href="/forgot-password"
          className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--color-accent)] text-base font-semibold text-white hover:bg-[var(--color-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Request a New Link
        </Link>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className={LINK_CLASSES}>
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  if (phase.kind === 'done') {
    return (
      <div role="status" aria-live="polite">
        <h1 className="font-display text-3xl tracking-tight text-[var(--color-ink)]">Password updated</h1>
        <p className="mt-3 text-[var(--color-muted)]">
          Your password has been changed and you have been signed out on all devices. Sign in with your new password.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--color-accent)] text-base font-semibold text-white hover:bg-[var(--color-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-[var(--color-ink)]">Set a new password</h1>
      <p className="mt-2 text-[var(--color-muted)]">Choose a strong password for your Ecomesta account.</p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate aria-busy={submitting}>
        <PasswordField
          id="reset-password"
          label="New password"
          name="password"
          autoComplete="new-password"
          required
          maxLength={128}
          value={password}
          error={fieldErrors.password}
          hint={<PasswordRules password={password} />}
          onChange={(event) => {
            setPassword(event.target.value);
            if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }}
        />
        <PasswordField
          id="reset-confirm"
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          maxLength={128}
          value={confirm}
          error={fieldErrors.confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            if (fieldErrors.confirm) setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
          }}
        />

        {error ? <FormAlert message={error.message} details={error.details} /> : null}

        <Button type="submit" className="h-11 w-full rounded-lg text-base font-semibold" disabled={submitting}>
          {submitting ? 'Saving...' : 'Reset Password'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className={LINK_CLASSES}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
