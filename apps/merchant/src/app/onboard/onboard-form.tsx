'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ManualPaymentAccount } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { AuthField, FormAlert } from '@/components/auth/auth-fields';
import { ManualPaymentPanel, type WalletPaymentInput } from '@/components/billing/manual-payment';
import { PlanPicker, defaultSelection } from '@/components/billing/plan-picker';
import { SetupProgress } from '@/components/onboarding/onboarding-shell';
import {
  FIELD_MESSAGES,
  SESSION_EXPIRED,
  STORE_SLUG_TOO_LONG,
  onboardingErrorMessage,
  type OnboardField,
  type OnboardFieldErrors,
} from '@/components/onboarding/onboarding-errors';
import {
  ProvisioningBar,
  ProvisioningSteps,
  type ProvisioningStep,
} from '@/components/onboarding/provisioning-steps';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  planSelectionQuery,
  readPlanSelection,
  withPlanSelection,
  type PlanSelection,
} from '@/lib/plan-selection';
import { useStoreContext } from '@/lib/store-context';
import { usePublicPlans } from '@/lib/subscription-context';
import { storefrontPreviewUrl } from '@/lib/storefront-url';

/** Current platform defaults for new stores; sent explicitly as before. */
const STORE_DEFAULTS = { currency: 'BDT', timezone: 'Asia/Dhaka', locale: 'en-BD' } as const;

/** Mirrors SLUG_REGEX / length rules in the API DTO; the API stays authoritative. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** The store slug is one DNS label: `{storeSlug}.{platform root}`. */
const STORE_SLUG_MAX = 63;
const TENANT_SLUG_MAX = 64;

/**
 * Store creation is one fast request. A short floor on the success path keeps
 * the checklist from flashing past; errors are never held back.
 */
const MIN_PROVISIONING_MS = 1500;
const SUCCESS_REDIRECT_MS = 1200;
const CREATE_FAILED_TITLE = "We couldn't create your store";

/** creating = POST /onboarding/store in flight; finalizing = profile + store list reload. */
type Phase = 'form' | 'creating' | 'finalizing' | 'completed';
/** Store details first; the payment is the last step and creates the store. */
type Step = 'details' | 'payment';

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

const FIELD_IDS: Record<OnboardField, string> = {
  businessName: 'biz-name',
  storeName: 'store-name',
  storeSlug: 'store-slug',
  tenantSlug: 'tenant-slug',
};

/** `max` truncates; omit it where an over-long value must stay visible as an error. */
function slugify(value: string, max?: number): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return max === undefined ? slug : slug.slice(0, max);
}

/** Like slugify but keeps a trailing hyphen so "my-store" can be typed. */
function sanitizeSlugInput(value: string, max?: number): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '');
  return max === undefined ? slug : slug.slice(0, max);
}

function isValidSlug(slug: string, max: number): boolean {
  return slug.length >= 2 && slug.length <= max && SLUG_PATTERN.test(slug);
}

function StatusPanel({ title, detail }: { title: string; detail?: string }) {
  return (
    <div role="status" aria-live="polite" className="py-6 text-center">
      <p className="font-display text-2xl tracking-tight text-[var(--color-ink)]">{title}</p>
      {detail ? <p className="mt-2 text-[var(--color-muted)]">{detail}</p> : null}
      <div aria-hidden="true" className="mx-auto mt-6 flex max-w-[12rem] flex-col gap-2">
        <div className="h-2 animate-pulse rounded bg-[#e4ebe8]" />
        <div className="mx-auto h-2 w-2/3 animate-pulse rounded bg-[#e4ebe8]" />
      </div>
    </div>
  );
}

function StoreMark() {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e3f1ec] text-[var(--color-accent)]"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9.5l1.5-4.5h13L20 9.5" />
        <path d="M4 9.5a2.67 2.67 0 005.33 0 2.67 2.67 0 005.34 0 2.67 2.67 0 005.33 0" />
        <path d="M5.5 12v7h13v-7" />
        <path d="M10 19v-4h4v4" />
      </svg>
    </span>
  );
}

function ProvisioningPanel({
  phase,
  storeName,
  storeUrl,
  headingRef,
  onOpenDashboard,
}: {
  phase: Exclude<Phase, 'form'>;
  storeName: string;
  storeUrl: string | null;
  headingRef: RefObject<HTMLHeadingElement>;
  onOpenDashboard: () => void;
}) {
  const completed = phase === 'completed';
  const steps: ProvisioningStep[] = [
    { label: 'Account verified', state: 'done' },
    {
      label: 'Payment submitted',
      state: 'done',
      detail: 'Our team checks it and brings your store online.',
    },
    {
      label: 'Creating your store',
      state: phase === 'creating' ? 'current' : 'done',
      detail: 'Saving your store name, web address and Bangladesh defaults (BDT · Asia/Dhaka).',
    },
    {
      label: 'Preparing your dashboard',
      state: phase === 'creating' ? 'pending' : phase === 'finalizing' ? 'current' : 'done',
      detail: 'Adding the new store to your account.',
    },
  ];
  const status =
    phase === 'creating'
      ? 'Creating your store...'
      : phase === 'finalizing'
        ? 'Store created. Preparing your dashboard...'
        : 'Store created. Waiting for payment confirmation.';

  return (
    <div>
      <div className="flex items-center gap-3">
        <StoreMark />
        <div className="min-w-0">
          <p className="break-words font-semibold text-[var(--color-ink)]">
            {completed ? storeName : `Setting up ${storeName}`}
          </p>
          {storeUrl ? <p className="break-all text-sm text-[var(--color-muted)]">{storeUrl}</p> : null}
        </div>
      </div>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-6 font-display text-3xl tracking-tight text-[var(--color-ink)] outline-none"
      >
        {completed ? 'Your store has been created' : 'Creating your store'}
      </h1>
      <p className="mt-2 text-[var(--color-muted)]">
        {completed
          ? 'We are confirming your payment. Your store goes live for customers as soon as it is confirmed — meanwhile you can add products in your dashboard.'
          : "We're getting everything ready for your online business."}
      </p>

      <div className="mt-6">
        <ProvisioningBar steps={steps} />
        <p role="status" aria-live="polite" className="mt-2 text-sm text-[var(--color-muted)]">
          {status}
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-[var(--color-border)] px-4 py-4">
        <ProvisioningSteps label="Store setup progress" steps={steps} />
      </div>

      {completed ? (
        <>
          <Button
            type="button"
            onClick={onOpenDashboard}
            className="mt-6 h-11 w-full rounded-lg text-base font-semibold"
          >
            Go to Dashboard
          </Button>
          <p className="mt-2 text-center text-xs text-[var(--color-muted)]">Opening your dashboard...</p>
        </>
      ) : (
        <Button type="button" disabled className="mt-6 h-11 w-full rounded-lg text-base font-semibold">
          Creating Store...
        </Button>
      )}
    </div>
  );
}

function SummaryItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-3' : 'min-w-0'}>
      <dt className="text-xs text-[var(--color-muted)]">{label}</dt>
      <dd className="break-all font-medium text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

export default function OnboardForm({
  minDisplayMs = MIN_PROVISIONING_MS,
  redirectDelayMs = SUCCESS_REDIRECT_MS,
}: {
  minDisplayMs?: number;
  redirectDelayMs?: number;
} = {}) {
  const { user, loading, accessToken, reloadProfile, logout } = useAuth();
  const { refreshStores } = useStoreContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get('plan');
  const intervalParam = searchParams.get('interval');
  const requested = useMemo(
    () => readPlanSelection({ get: (name) => (name === 'plan' ? planParam : intervalParam) }),
    [planParam, intervalParam],
  );
  const { plans } = usePublicPlans();
  const [planChoice, setPlanChoice] = useState<PlanSelection | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeSlugInput, setStoreSlugInput] = useState<string | null>(null);
  const [tenantSlugInput, setTenantSlugInput] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<OnboardFieldErrors>({});
  const [pendingFocus, setPendingFocus] = useState<OnboardField | 'alert' | null>(null);
  const [error, setError] = useState<{ title?: string; message: string } | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [step, setStep] = useState<Step>('details');
  const [accounts, setAccounts] = useState<ManualPaymentAccount[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [provisioned, setProvisioned] = useState<{ name: string; url: string | null }>({
    name: '',
    url: null,
  });
  const [signingOut, setSigningOut] = useState(false);
  const inFlight = useRef(false);
  const hardRedirect = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const hasStore = Boolean(user && user.memberships.stores.length > 0);
  // While provisioning, this component owns navigation; the new membership
  // must not trigger the "already has a store" redirect mid-flow.
  const provisioning = phase !== 'form';

  useEffect(() => {
    if (!provisioning && !loading && !user && !signingOut) {
      router.replace(requested ? `/register?${planSelectionQuery(requested)}` : '/register?next=/onboard');
    }
  }, [provisioning, loading, user, router, signingOut, requested]);

  useEffect(() => {
    if (!provisioning && !loading && hasStore) {
      router.replace(requested ? withPlanSelection('/dashboard/billing', requested) : '/dashboard');
    }
  }, [provisioning, loading, hasStore, router, requested]);

  useEffect(() => {
    if (plans && !planChoice) setPlanChoice(defaultSelection(plans, requested));
  }, [plans, planChoice, requested]);

  useEffect(() => {
    if (phase !== 'form' || !pendingFocus) return;
    if (pendingFocus === 'alert') {
      alertRef.current?.focus();
      setPendingFocus(null);
      return;
    }
    const input = document.getElementById(FIELD_IDS[pendingFocus]);
    const details = input?.closest('details');
    if (details && !details.open) {
      details.open = true;
      setAdvancedOpen(true);
    }
    input?.focus();
    setPendingFocus(null);
  }, [phase, pendingFocus]);

  useEffect(() => {
    if (phase === 'creating' || phase === 'completed') headingRef.current?.focus();
  }, [phase]);

  const openDashboard = useCallback(() => {
    if (hardRedirect.current) {
      // The store exists; a full load re-reads the session and memberships.
      window.location.assign('/dashboard');
    } else {
      router.replace('/dashboard');
    }
  }, [router]);

  useEffect(() => {
    if (phase !== 'completed') return;
    const timer = window.setTimeout(openDashboard, redirectDelayMs);
    return () => window.clearTimeout(timer);
  }, [phase, redirectDelayMs, openDashboard]);

  const suggested = useMemo(
    () => slugify(businessName || storeName, STORE_SLUG_MAX).replace(/-+$/, ''),
    [businessName, storeName],
  );
  const storeSlug = storeSlugInput ?? suggested;
  const tenantSlug = tenantSlugInput ?? storeSlug;
  const tenantSlugEdited = tenantSlugInput !== null;
  const finalStoreSlug = slugify(storeSlug);
  const previewUrl = storefrontPreviewUrl(finalStoreSlug || 'your-store');

  function clearFieldError(field: OnboardField) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): OnboardFieldErrors {
    const errors: OnboardFieldErrors = {};
    const business = businessName.trim();
    const store = storeName.trim();
    if (business.length < 2 || business.length > 120) errors.businessName = FIELD_MESSAGES.businessName;
    if (store && (store.length < 2 || store.length > 120)) errors.storeName = FIELD_MESSAGES.storeName;
    const nextStoreSlug = slugify(storeSlug);
    if (nextStoreSlug.length > STORE_SLUG_MAX && SLUG_PATTERN.test(nextStoreSlug)) {
      errors.storeSlug = STORE_SLUG_TOO_LONG;
    } else if (!isValidSlug(nextStoreSlug, STORE_SLUG_MAX)) {
      errors.storeSlug = FIELD_MESSAGES.storeSlug;
    }
    if (tenantSlugEdited && !isValidSlug(slugify(tenantSlug, TENANT_SLUG_MAX), TENANT_SLUG_MAX)) {
      errors.tenantSlug = FIELD_MESSAGES.tenantSlug;
    }
    return errors;
  }

  /** Highlights fields and queues focus for the first one (applied once the form is on screen). */
  function showFieldErrors(errors: OnboardFieldErrors) {
    setFieldErrors(errors);
    const firstInvalid = (Object.keys(FIELD_IDS) as OnboardField[]).find((field) => errors[field]);
    setPendingFocus(firstInvalid ?? null);
    return Boolean(firstInvalid);
  }

  async function loadAccounts() {
    if (accounts || !accessToken) return;
    setAccountsError(null);
    try {
      const result = await api.get<{ success: true; data: ManualPaymentAccount[] }>('/billing/payment-accounts', {
        token: accessToken,
      });
      setAccounts(result.data);
    } catch {
      setAccountsError('We could not load the payment details. Please refresh the page and try again.');
    }
  }

  /** Step 1 → 2: the details are checked here; the API checks them again with the payment. */
  function onContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (showFieldErrors(validate())) return;
    if (!accessToken) {
      setError({ message: SESSION_EXPIRED });
      return;
    }
    if (!planChoice) {
      setError({ message: 'Choose a plan to continue.' });
      return;
    }
    setStep('payment');
    void loadAccounts();
    window.scrollTo?.({ top: 0 });
  }

  /** Step 2: the payment creates the store (offline until the payment is confirmed). */
  async function createStore(payment: WalletPaymentInput): Promise<void> {
    if (inFlight.current || !planChoice) return;
    if (!accessToken) throw new Error(SESSION_EXPIRED);

    const nextBusinessName = businessName.trim();
    const nextStoreName = storeName.trim() || nextBusinessName;
    const nextStoreSlug = slugify(storeSlug);
    inFlight.current = true;
    setProvisioned({ name: nextStoreName, url: previewUrl });
    setPhase('creating');
    const startedAt = Date.now();
    try {
      await api.post(
        '/onboarding/store',
        {
          businessName: nextBusinessName,
          storeName: nextStoreName,
          tenantSlug: slugify(tenantSlug, TENANT_SLUG_MAX) || nextStoreSlug,
          storeSlug: nextStoreSlug,
          ...STORE_DEFAULTS,
          planSlug: planChoice.plan,
          billingCycle: planChoice.cycle,
          ...payment,
        },
        { token: accessToken },
      );
    } catch (err) {
      inFlight.current = false;
      setPhase('form');
      const mapped = onboardingErrorMessage(err, { tenantSlugEdited });
      // Payment problems are shown on the payment step, which keeps what was typed.
      if (mapped.payment) throw new Error(mapped.message);
      setError({ title: CREATE_FAILED_TITLE, message: mapped.message });
      setStep('details');
      if (!showFieldErrors(mapped.fieldErrors)) setPendingFocus('alert');
      return;
    }

    // inFlight stays set: this session has created its store and must not create another.
    setPhase('finalizing');
    try {
      await reloadProfile();
      await refreshStores();
    } catch {
      hardRedirect.current = true;
    }
    const remaining = minDisplayMs - (Date.now() - startedAt);
    if (remaining > 0) await wait(remaining);
    setPhase('completed');
  }

  function onSignOut() {
    setSigningOut(true);
    void logout().then(() => router.replace('/login'));
  }

  const summaryName = storeName.trim() || businessName.trim();
  const chosenPlan = planChoice ? plans?.find((plan) => plan.slug === planChoice.plan) ?? null : null;
  const paymentView =
    step === 'payment' && planChoice && chosenPlan ? (
      <div>
        <SetupProgress current="payment" />
        <p className="mt-6 text-sm font-semibold text-[var(--color-accent)]">Step 3 of 3 · Payment</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-[var(--color-ink)]">Pay for your plan</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Your store <span className="font-medium text-[var(--color-ink)]">{summaryName}</span> is created as soon as
          you submit your payment. It goes live for customers once our team confirms the payment.
        </p>
        <div className="mt-6">
          {accounts ? (
            <ManualPaymentPanel
              plan={chosenPlan}
              cycle={planChoice.cycle}
              accounts={accounts}
              token={accessToken}
              trialEndsAt={null}
              onPay={createStore}
              heading="Last step: pay for your plan"
              intro="Send the payment with bKash, Nagad, Rocket or Upay, then tell us your number and the transaction ID."
              submitLabel={(amount) => `I've paid ${amount} — create my store`}
              footer={
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="w-full rounded-sm text-center text-sm font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  ← Back to store details
                </button>
              }
            />
          ) : accountsError ? (
            <FormAlert title="Payment details unavailable" message={accountsError} />
          ) : (
            <StatusPanel title="Loading payment details…" />
          )}
        </div>
      </div>
    ) : null;

  if (signingOut) {
    return <StatusPanel title="Signing out…" />;
  }
  if (!provisioning && (loading || !user)) {
    return <StatusPanel title="Checking your account..." />;
  }
  if (!provisioning && hasStore) {
    return <StatusPanel title="You already have a store" detail="Opening your dashboard…" />;
  }
  if (provisioning || paymentView) {
    // The payment step keeps its place in the tree while the store is created,
    // so a refused payment comes back with what was typed and the error.
    return (
      <>
        {provisioning ? (
          <ProvisioningPanel
            phase={phase as Exclude<Phase, 'form'>}
            storeName={provisioned.name}
            storeUrl={provisioned.url}
            headingRef={headingRef}
            onOpenDashboard={openDashboard}
          />
        ) : null}
        {/* Only while the request runs; after success the payment step is done. */}
        {paymentView && (!provisioning || phase === 'creating') ? (
          <div hidden={provisioning}>{paymentView}</div>
        ) : null}
      </>
    );
  }
  if (!user) {
    return <StatusPanel title="Checking your account..." />;
  }



  return (
    <div>
      <SetupProgress current="store" />
      <p className="mt-6 text-sm font-semibold text-[var(--color-accent)]">Step 2 of 3 · Store details</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-[var(--color-ink)]">
        Let&apos;s set up your store
      </h1>
      <p className="mt-2 text-[var(--color-muted)]">
        Add a few details about your business to get your Ecomesta store ready.
      </p>

      <form className="mt-6 space-y-5" onSubmit={onContinue} noValidate>
        <AuthField
          id={FIELD_IDS.businessName}
          label="Business name"
          name="businessName"
          autoComplete="organization"
          required
          maxLength={120}
          value={businessName}
          error={fieldErrors.businessName}
          hint="Your company or brand name."
          onChange={(e) => {
            setBusinessName(e.target.value);
            clearFieldError('businessName');
          }}
        />
        <AuthField
          id={FIELD_IDS.storeName}
          label="Store name"
          name="storeName"
          autoComplete="off"
          maxLength={120}
          placeholder={businessName.trim() || undefined}
          value={storeName}
          error={fieldErrors.storeName}
          hint="This is the name customers will see on your storefront. Leave blank to use your business name."
          onChange={(e) => {
            setStoreName(e.target.value);
            clearFieldError('storeName');
          }}
        />
        <AuthField
          id={FIELD_IDS.storeSlug}
          label="Store URL"
          name="storeSlug"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="your-store"
          value={storeSlug}
          error={fieldErrors.storeSlug}
          hint={
            <>
              Lowercase letters, numbers and hyphens.
              {previewUrl ? (
                <span className="mt-1 block break-all">
                  Your store address: <span className="font-medium text-[var(--color-ink)]">{previewUrl}</span>
                </span>
              ) : null}
            </>
          }
          onChange={(e) => {
            setStoreSlugInput(sanitizeSlugInput(e.target.value));
            clearFieldError('storeSlug');
          }}
          onBlur={() => {
            if (storeSlugInput !== null) setStoreSlugInput(slugify(storeSlugInput));
          }}
        />

        <details
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
          className="group rounded-lg border border-[var(--color-border)] px-4 py-3"
        >
          <summary className="cursor-pointer select-none rounded-sm text-sm font-semibold text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
            Advanced settings <span className="font-normal text-[var(--color-muted)]">(optional)</span>
          </summary>
          <div className="mt-3">
            <AuthField
              id={FIELD_IDS.tenantSlug}
              label="Account ID"
              name="tenantSlug"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={64}
              value={tenantSlug}
              error={fieldErrors.tenantSlug}
              hint="Identifies your business account inside Ecomesta. Customers never see it. It matches your store URL unless you change it."
              onChange={(e) => {
                setTenantSlugInput(sanitizeSlugInput(e.target.value, TENANT_SLUG_MAX));
                clearFieldError('tenantSlug');
              }}
              onBlur={() => {
                if (tenantSlugInput !== null) setTenantSlugInput(slugify(tenantSlugInput, TENANT_SLUG_MAX));
              }}
            />
          </div>
        </details>

        {plans && plans.length > 0 && planChoice ? (
          <section aria-labelledby="plan-heading" className="space-y-3">
            <div>
              <h2 id="plan-heading" className="font-semibold text-[var(--color-ink)]">
                Your plan
              </h2>
              <p className="text-sm text-[var(--color-muted)]">
                You pay for it in the next step. Your store goes live as soon as we confirm the payment.
              </p>
            </div>
            <PlanPicker plans={plans} value={planChoice} onChange={setPlanChoice} idPrefix="onboard" />
          </section>
        ) : null}

        <section aria-labelledby="setup-summary" className="rounded-lg bg-[#f4f7f5] px-4 py-3 text-sm">
          <h2 id="setup-summary" className="font-semibold text-[var(--color-ink)]">
            Summary
          </h2>
          <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-2">
            <SummaryItem wide label="Store name" value={summaryName || 'Not set yet'} />
            <SummaryItem
              wide
              label="Store URL"
              value={finalStoreSlug ? (previewUrl ?? finalStoreSlug) : 'Not set yet'}
            />
            <SummaryItem label="Country" value="Bangladesh" />
            <SummaryItem label="Currency" value="BDT" />
            <SummaryItem label="Timezone" value="Asia/Dhaka" />
          </dl>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Country, currency and timezone are the current platform defaults for new stores.
          </p>
        </section>

        {error ? (
          <div ref={alertRef} tabIndex={-1} className="rounded-lg focus:outline-none">
            <FormAlert title={error.title} message={error.message} />
          </div>
        ) : null}

        <Button type="submit" className="h-11 w-full rounded-lg text-base font-semibold">
          Continue to payment
        </Button>
      </form>

      <p className="mt-6 border-t border-[var(--color-border)] pt-5 text-center text-sm text-[var(--color-muted)]">
        Signed in as <span className="break-all font-medium text-[var(--color-ink)]">{user.email}</span>
        {' · '}
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-sm font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Sign out
        </button>
      </p>
    </div>
  );
}
