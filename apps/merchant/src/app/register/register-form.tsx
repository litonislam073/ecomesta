'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@ecomesta/ui';
import { LoadingState } from '@/components/ui/loading-state';
import { AuthField, FormAlert, PasswordField, SecureNote } from '@/components/auth/auth-fields';
import { authErrorMessage, isValidEmail } from '@/components/auth/auth-errors';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
import { PasswordRules, meetsPasswordRules } from '@/components/auth/password-rules';
import { billingCycleDefinition } from '@ecomesta/utils';
import { hasSessionHint, useAuth } from '@/lib/auth-context';
import { marketingSiteUrl } from '@/lib/marketing-site';
import { readPlanSelection, safeNextPath, withPlanSelection } from '@/lib/plan-selection';
import { usePublicPlans } from '@/lib/subscription-context';

type Field = 'firstName' | 'lastName' | 'email' | 'phone' | 'password';
type FieldErrors = Partial<Record<Field, string>>;

const FIELD_IDS: Record<Field, string> = {
  firstName: 'reg-first',
  lastName: 'reg-last',
  email: 'reg-email',
  phone: 'reg-phone',
  password: 'reg-password',
};

function validate(values: Record<Field, string>): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.firstName.trim()) errors.firstName = 'Enter your first name.';
  else if (values.firstName.trim().length > 100) errors.firstName = 'Use 100 characters or fewer.';
  if (!values.lastName.trim()) errors.lastName = 'Enter your last name.';
  else if (values.lastName.trim().length > 100) errors.lastName = 'Use 100 characters or fewer.';
  if (!values.email.trim()) errors.email = 'Enter your email address.';
  else if (!isValidEmail(values.email)) errors.email = 'Enter a valid email address.';
  if (values.phone.trim().length > 32) errors.phone = 'Use 32 characters or fewer.';
  if (!values.password) errors.password = 'Create a password.';
  else if (!meetsPasswordRules(values.password)) {
    errors.password = 'Password does not meet the requirements below.';
  }
  return errors;
}

const LEGAL_LINK_CLASSES =
  'rounded-sm font-medium text-[var(--color-accent)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]';

export default function RegisterPage() {
  const { register, loginWithGoogle, user, loading } = useAuth();
  // Read after mount: the server cannot see this browser's storage, and the
  // first render must match it. Null until then.
  const [expectSession, setExpectSession] = useState<boolean | null>(null);
  useEffect(() => setExpectSession(hasSessionHint()), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const selection = readPlanSelection(searchParams);
  const next = safeNextPath(searchParams.get('next'), withPlanSelection('/onboard', selection));
  const { plans } = usePublicPlans();
  const selectedPlan = selection ? plans?.find((plan) => plan.slug === selection.plan) : undefined;

  const [values, setValues] = useState<Record<Field, string>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!loading && user && !created) {
      const hasStore = user.memberships.stores.length > 0;
      router.replace(
        hasStore ? (selection ? withPlanSelection('/dashboard/billing', selection) : '/dashboard') : next,
      );
    }
  }, [loading, user, router, next, created, selection]);

  function update(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function onGoogleCredential(credential: string) {
    if (inFlight.current) {
      return;
    }
    setError(null);
    inFlight.current = true;
    setSubmitting(true);
    try {
      const { created: isNew } = await loginWithGoogle(credential);
      if (isNew) {
        setCreated(true);
        router.replace(next);
        return;
      }
      // Existing account: the signed-in effect routes to the dashboard or store setup.
    } catch (err) {
      setError(authErrorMessage(err, 'google'));
    }
    inFlight.current = false;
    setSubmitting(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) {
      return;
    }
    setError(null);
    const errors = validate(values);
    setFieldErrors(errors);
    const firstInvalid = (Object.keys(FIELD_IDS) as Field[]).find((field) => errors[field]);
    if (firstInvalid) {
      event.currentTarget
        .querySelector<HTMLInputElement>(`#${FIELD_IDS[firstInvalid]}`)
        ?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      await register({
        email: values.email.trim(),
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone.trim() || undefined,
      });
      setCreated(true);
      router.replace(next);
    } catch (err) {
      setError(authErrorMessage(err, 'register'));
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div role="status" aria-live="polite" className="py-6 text-center">
        <p className="font-display text-2xl tracking-tight text-[var(--color-ink)]">Account created</p>
        <p className="mt-2 text-[var(--color-muted)]">Taking you to store setup…</p>
      </div>
    );
  }

  if (user || expectSession === null || (loading && expectSession)) {
    return (
      <LoadingState
        label={
          user ? 'Opening your workspace' : expectSession === null ? 'Loading registration' : 'Checking signed-in session'
        }
      />
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold text-[var(--color-accent)]">
        Step 1 of 2 · Create your account
      </p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-[var(--color-ink)]">
        Create your store
      </h1>
      <p className="mt-2 text-[var(--color-muted)]">
        Start building your online business with Ecomesta.
      </p>
      {selection ? (
        <p className="mt-4 rounded-lg bg-[#f1f8f5] px-3 py-2 text-sm text-[var(--color-ink)]">
          <span className="font-semibold">
            {selectedPlan ? `${selectedPlan.name} plan` : 'Your selected plan'} ·{' '}
            {billingCycleDefinition(selection.cycle).label}
          </span>{' '}
          — you pay for it in the last step of store setup.
        </p>
      ) : null}

      <GoogleSignIn mode="signup" disabled={submitting} onCredential={onGoogleCredential} />

      <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate aria-busy={submitting}>
        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField
            id="reg-first"
            label="First name"
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={100}
            value={values.firstName}
            error={fieldErrors.firstName}
            onChange={(e) => update('firstName', e.target.value)}
          />
          <AuthField
            id="reg-last"
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            required
            maxLength={100}
            value={values.lastName}
            error={fieldErrors.lastName}
            onChange={(e) => update('lastName', e.target.value)}
          />
        </div>
        <AuthField
          id="reg-email"
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
          value={values.email}
          error={fieldErrors.email}
          onChange={(e) => update('email', e.target.value)}
        />
        <AuthField
          id="reg-phone"
          label="Phone (optional)"
          type="tel"
          name="phone"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+8801XXXXXXXXX"
          maxLength={32}
          value={values.phone}
          error={fieldErrors.phone}
          onChange={(e) => update('phone', e.target.value)}
        />
        <PasswordField
          id="reg-password"
          label="Password"
          name="password"
          autoComplete="new-password"
          required
          maxLength={128}
          value={values.password}
          error={fieldErrors.password}
          hint={<PasswordRules password={values.password} />}
          onChange={(e) => update('password', e.target.value)}
        />

        {error ? <FormAlert message={error.message} details={error.details} /> : null}

        <Button
          type="submit"
          className="h-11 w-full rounded-lg text-base font-semibold"
          disabled={submitting}
        >
          {submitting ? 'Creating account...' : 'Create Account'}
        </Button>
        <p className="text-center text-sm text-[var(--color-muted)]">
          Next, you&apos;ll name your store and choose its web address.
        </p>
        <p className="text-center text-xs leading-relaxed text-[var(--color-muted)]">
          By creating an account, you agree to our{' '}
          <a href={`${marketingSiteUrl()}/terms`} className={LEGAL_LINK_CLASSES}>
            Terms &amp; Conditions
          </a>{' '}
          and{' '}
          <a href={`${marketingSiteUrl()}/privacy-policy`} className={LEGAL_LINK_CLASSES}>
            Privacy Policy
          </a>
          .
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
        Already have an account?{' '}
        <Link
          href={selection ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="rounded-sm font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Sign in
        </Link>
      </p>

      <div className="mt-6 border-t border-[var(--color-border)] pt-5">
        <SecureNote />
      </div>
    </div>
  );
}
