'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { PaymentProviderConfigSafe } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api-client';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';
import { useSettingsDraft, useStoreSettings } from '@/lib/store-settings';
import { useSubscription } from '@/lib/subscription-context';

type Mode = 'test' | 'live';

function Pill({ tone, children }: { tone: 'green' | 'gray' | 'amber' | 'blue'; children: ReactNode }) {
  const tones = {
    green: 'bg-[#e3f4ec] text-[#13684a]',
    gray: 'bg-[#eef1f4] text-[#4b5563]',
    amber: 'bg-[#fff1d6] text-[#8a5a00]',
    blue: 'bg-[#e8f0fb] text-[#1d4f91]',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** On/off switch with a visible label. */
function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-[#f6f8f7] px-4 py-3">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm font-semibold text-[var(--color-ink)]">
          {label}
        </p>
        {hint ? <p className="mt-0.5 text-xs text-[var(--color-muted)]">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-[var(--color-accent)]' : 'bg-[#cfd8d4]'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
}

/** Test / Live choice as two buttons. */
function ModeSwitch({ value, onChange, testLabel }: { value: Mode; onChange: (mode: Mode) => void; testLabel: string }) {
  const id = useId();
  return (
    <fieldset>
      <legend id={id} className="text-sm font-medium text-[var(--color-ink)]">
        Mode
      </legend>
      <div className="mt-1.5 inline-flex rounded-lg border border-[var(--color-border)] bg-[#f6f8f7] p-1">
        {(['test', 'live'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={value === mode}
            onClick={() => onChange(mode)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
              value === mode ? 'bg-white text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            {mode === 'test' ? testLabel : 'Live'}
          </button>
        ))}
      </div>
      {value === 'live' ? (
        <p className="mt-2 text-xs font-medium text-[#8a5a00]">Live mode charges real money. Use your live keys.</p>
      ) : (
        <p className="mt-2 text-xs text-[var(--color-muted)]">No real money moves in {testLabel.toLowerCase()} mode.</p>
      )}
    </fieldset>
  );
}

/** A secret field: write-only, says when a value is already stored. */
function SecretField({
  label,
  value,
  onChange,
  saved,
  placeholder,
  type = 'password',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  saved: boolean;
  placeholder: string;
  type?: 'password' | 'text';
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="flex items-center gap-2 font-medium text-[var(--color-ink)]">
        {label}
        {saved ? <Pill tone="green">🔒 Saved</Pill> : null}
      </span>
      <Input
        type={type}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={saved ? '•••••••• (leave blank to keep)' : placeholder}
      />
    </label>
  );
}

function ProviderCard({
  mark,
  markColor,
  name,
  tagline,
  row,
  testLabel,
  locked,
  children,
}: {
  mark: string;
  markColor: string;
  name: string;
  tagline: string;
  row: PaymentProviderConfigSafe | undefined;
  testLabel: string;
  /** Upgrade notice when the plan does not include this provider. */
  locked: ReactNode | null;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_1px_2px_rgba(16,40,32,0.04)]"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm"
            style={{ backgroundColor: markColor }}
          >
            {mark}
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg font-semibold text-[var(--color-ink)]">
              {name}
            </h2>
            <p className="text-sm text-[var(--color-muted)]">{tagline}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label={`${name} status`}>
          {row?.enabled ? <Pill tone="green">● Active</Pill> : <Pill tone="gray">Off</Pill>}
          {row?.mode === 'live' ? <Pill tone="amber">Live</Pill> : <Pill tone="blue">{testLabel}</Pill>}
          {row?.hasSecrets ? <Pill tone="green">🔒 Keys saved</Pill> : <Pill tone="gray">Keys not set</Pill>}
        </div>
      </header>
      <div className="space-y-5 px-5 py-5 sm:px-6">
        {locked ? (
          <div role="note" className="rounded-xl border border-[#f3d9a4] bg-[#fff8e8] px-4 py-3 text-sm text-[#6b4a00]">
            {locked}
          </div>
        ) : null}
        <fieldset disabled={Boolean(locked)} className="m-0 min-w-0 space-y-5 border-0 p-0 disabled:opacity-60">
          {children}
        </fieldset>
      </div>
    </section>
  );
}

type Tab = 'manual' | 'ssl' | 'stripe' | 'test';

/** Provider menu: one tab per provider, each with its on/off state. */
function ProviderTabs({
  value,
  onChange,
  tabs,
}: {
  value: Tab;
  onChange: (tab: Tab) => void;
  tabs: { id: Tab; name: string; mark: string; color: string; active: boolean }[];
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === value);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!;
    onChange(next.id);
    document.getElementById(`provider-tab-${next.id}`)?.focus();
  }
  return (
    <div
      role="tablist"
      aria-label="Payment providers"
      onKeyDown={onKeyDown}
      className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 sm:grid-cols-4"
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`provider-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`provider-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-1.5 py-2.5 text-xs font-semibold sm:gap-2.5 sm:px-4 sm:text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
              selected ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'text-[var(--color-ink)] hover:bg-[#eef3f0]'
            }`}
          >
            <span
              aria-hidden="true"
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white sm:flex"
              style={{ backgroundColor: selected ? 'rgba(255,255,255,0.22)' : tab.color }}
            >
              {tab.mark}
            </span>
            <span className="truncate">{tab.name}</span>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${tab.active ? 'bg-[#22c55e]' : selected ? 'bg-white/50' : 'bg-[#c3ccc8]'}`}
              aria-hidden="true"
            />
            <span className="sr-only">{tab.active ? '(active)' : '(off)'}</span>
          </button>
        );
      })}
    </div>
  );
}

const MANUAL_KEYS = [
  'paymentCodEnabled',
  'paymentBankTransferEnabled',
  'paymentBankTransferDetails',
  'paymentOtherEnabled',
  'paymentOtherDetails',
] as const;

const textareaClass =
  'block w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[#94a3b8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]';

/**
 * Cash on delivery, bank transfer and "other payment": the store's own options.
 * Saved with the store settings; checkout only offers (and accepts) the ones on.
 */
function ManualPaymentsPanel({
  store,
  onlineActive,
}: {
  store: ReturnType<typeof useStoreSettings>;
  onlineActive: boolean;
}) {
  const { settings, loading, error, reload, save, saving, canEdit } = store;
  const { draft, setField, changes, dirty, reset } = useSettingsDraft(settings, MANUAL_KEYS);

  if (loading && !settings) return <LoadingState label="Loading payment options…" />;
  if (error && !settings) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!settings) return null;

  const onCount = [draft.paymentCodEnabled, draft.paymentBankTransferEnabled, draft.paymentOtherEnabled].filter(Boolean).length;
  const noWayToPay = onCount === 0 && !onlineActive;
  const bankMissing = draft.paymentBankTransferEnabled && !draft.paymentBankTransferDetails?.trim();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || !dirty || noWayToPay) return;
    await save(changes, 'Manual payments saved');
  }

  return (
    <ProviderCardShell
      mark="৳"
      markColor="#0f766e"
      name="Manual payments"
      tagline="Cash on delivery and payments you confirm yourself"
      status={
        onCount > 0 ? <Pill tone="green">● {onCount} of 3 on</Pill> : <Pill tone="gray">All off</Pill>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <fieldset disabled={!canEdit || saving} className="m-0 min-w-0 space-y-4 border-0 p-0">
          <Switch
            checked={Boolean(draft.paymentCodEnabled)}
            onChange={(v) => setField('paymentCodEnabled', v)}
            label="Cash on delivery"
            hint="Customers pay in cash when the order arrives. You can also turn it off for a single delivery method in Shipping."
          />

          <div className="space-y-3">
            <Switch
              checked={Boolean(draft.paymentBankTransferEnabled)}
              onChange={(v) => setField('paymentBankTransferEnabled', v)}
              label="Bank transfer"
              hint="Customers transfer to your bank account; you confirm the payment on the order."
            />
            {draft.paymentBankTransferEnabled ? (
              <label className="block space-y-1.5 pl-1 text-sm">
                <span className="font-medium text-[var(--color-ink)]">Bank details shown to customers</span>
                <textarea
                  className={`${textareaClass} min-h-28`}
                  maxLength={1000}
                  value={draft.paymentBankTransferDetails ?? ''}
                  onChange={(e) => setField('paymentBankTransferDetails', e.target.value)}
                  placeholder={'Bank: Dutch-Bangla Bank\nAccount name: Your Business\nAccount number: 123 456 7890\nBranch: Gulshan · Routing: 090261234'}
                />
              </label>
            ) : null}
            {draft.paymentBankTransferEnabled && bankMissing ? (
              <p className="pl-1 text-xs font-medium text-[#8a5a00]">
                Add your bank details so customers know where to send the money.
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <Switch
              checked={Boolean(draft.paymentOtherEnabled)}
              onChange={(v) => setField('paymentOtherEnabled', v)}
              label="Other payment"
              hint="Customers arrange payment with you directly (e.g. bKash to your number)."
            />
            {draft.paymentOtherEnabled ? (
              <label className="block space-y-1.5 pl-1 text-sm">
                <span className="font-medium text-[var(--color-ink)]">
                  Instructions for customers <span className="font-normal text-[var(--color-muted)]">(optional)</span>
                </span>
                <textarea
                  className={`${textareaClass} min-h-20`}
                  maxLength={500}
                  value={draft.paymentOtherDetails ?? ''}
                  onChange={(e) => setField('paymentOtherDetails', e.target.value)}
                  placeholder="e.g. Send money with bKash to 01XXXXXXXXX and write your order number in the reference."
                />
              </label>
            ) : null}
          </div>
        </fieldset>

        {noWayToPay ? (
          <p role="alert" className="rounded-xl border border-[#f1c9b8] bg-[#fdf3ee] px-4 py-3 text-sm text-[#a3441f]">
            Customers need at least one way to pay. Keep one of these on, or turn on SSLCommerz or Stripe first.
          </p>
        ) : null}

        {canEdit ? (
          <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
            <Button type="submit" disabled={!dirty || saving || noWayToPay}>
              {saving ? 'Saving…' : 'Save manual payments'}
            </Button>
            {dirty ? (
              <Button type="button" variant="secondary" disabled={saving} onClick={reset}>
                Discard changes
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">Only store managers can change payment options.</p>
        )}
      </form>
    </ProviderCardShell>
  );
}

/** Card frame shared by the manual and online providers. */
function ProviderCardShell({
  mark,
  markColor,
  name,
  tagline,
  status,
  children,
}: {
  mark: string;
  markColor: string;
  name: string;
  tagline: string;
  status: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_1px_2px_rgba(16,40,32,0.04)]"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm"
            style={{ backgroundColor: markColor }}
          >
            {mark}
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg font-semibold text-[var(--color-ink)]">
              {name}
            </h2>
            <p className="text-sm text-[var(--color-muted)]">{tagline}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label={`${name} status`}>
          {status}
        </div>
      </header>
      <div className="space-y-5 px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function SafetyNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 text-xs text-[var(--color-muted)]">
      <span aria-hidden="true">🛡️</span>
      <span>{children}</span>
    </p>
  );
}

export default function PaymentSettingsPage() {
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();
  const { data: subscription } = useSubscription();
  const [items, setItems] = useState<PaymentProviderConfigSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('manual');
  const storeSettings = useStoreSettings();
  const manual = storeSettings.settings;
  const [validatingStripe, setValidatingStripe] = useState(false);
  const [validatingSsl, setValidatingSsl] = useState(false);

  const [testEnabled, setTestEnabled] = useState(false);
  const [testWebhookSecret, setTestWebhookSecret] = useState('');

  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripeMode, setStripeMode] = useState<Mode>('test');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');

  const [sslEnabled, setSslEnabled] = useState(false);
  const [sslMode, setSslMode] = useState<Mode>('test');
  const [sslStoreId, setSslStoreId] = useState('');
  const [sslStorePassword, setSslStorePassword] = useState('');

  const load = useCallback(async () => {
    if (!selectedStoreId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{
        success: true;
        data: PaymentProviderConfigSafe[];
      }>(`/stores/${selectedStoreId}/payment-providers`);
      setItems(result.data);
      const test = result.data.find((i) => i.provider === 'TEST');
      setTestEnabled(Boolean(test?.enabled));
      const stripe = result.data.find((i) => i.provider === 'STRIPE');
      setStripeEnabled(Boolean(stripe?.enabled));
      setStripeMode(stripe?.mode === 'live' ? 'live' : 'test');
      const ssl = result.data.find((i) => i.provider === 'SSL_COMMERZ');
      setSslEnabled(Boolean(ssl?.enabled));
      setSslMode(ssl?.mode === 'live' ? 'live' : 'test');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaveTest(event: FormEvent) {
    event.preventDefault();
    if (!selectedStoreId || !canWrite) return;
    setBusy(true);
    try {
      await api.post(`/stores/${selectedStoreId}/payment-providers`, {
        provider: 'TEST',
        enabled: testEnabled,
        mode: 'test',
        publicConfig: { label: 'Test online payment' },
        ...(testWebhookSecret.trim()
          ? { secrets: { webhookSecret: testWebhookSecret.trim() } }
          : {}),
      });
      pushToast('TEST provider saved', 'success');
      setTestWebhookSecret('');
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveStripe(event: FormEvent) {
    event.preventDefault();
    if (!selectedStoreId || !canWrite) return;
    setBusy(true);
    try {
      const secrets: Record<string, string> = {};
      if (stripeSecretKey.trim()) secrets.secretKey = stripeSecretKey.trim();
      if (stripeWebhookSecret.trim()) {
        secrets.webhookSecret = stripeWebhookSecret.trim();
      }
      const stripeRow = items.find((i) => i.provider === 'STRIPE');
      if (!stripeRow?.hasSecrets && (!secrets.secretKey || !secrets.webhookSecret)) {
        pushToast('Stripe secret key and webhook secret are required', 'error');
        return;
      }
      if (
        stripeRow?.hasSecrets &&
        Object.keys(secrets).length > 0 &&
        (!secrets.secretKey || !secrets.webhookSecret)
      ) {
        pushToast(
          'When updating Stripe secrets, provide both secret key and webhook secret',
          'error',
        );
        return;
      }

      await api.post(`/stores/${selectedStoreId}/payment-providers`, {
        provider: 'STRIPE',
        enabled: stripeEnabled,
        mode: stripeMode,
        publicConfig: { label: 'Stripe Checkout' },
        ...(Object.keys(secrets).length > 0 ? { secrets } : {}),
      });
      pushToast('Stripe provider saved', 'success');
      setStripeSecretKey('');
      setStripeWebhookSecret('');
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveSsl(event: FormEvent) {
    event.preventDefault();
    if (!selectedStoreId || !canWrite) return;
    setBusy(true);
    try {
      const secrets: Record<string, string> = {};
      if (sslStoreId.trim()) secrets.storeId = sslStoreId.trim();
      if (sslStorePassword.trim()) secrets.storePassword = sslStorePassword.trim();
      const sslRow = items.find((i) => i.provider === 'SSL_COMMERZ');
      if (!sslRow?.hasSecrets && (!secrets.storeId || !secrets.storePassword)) {
        pushToast('SSLCommerz store ID and store password are required', 'error');
        return;
      }
      if (
        sslRow?.hasSecrets &&
        Object.keys(secrets).length > 0 &&
        (!secrets.storeId || !secrets.storePassword)
      ) {
        pushToast(
          'When updating SSLCommerz secrets, provide both store ID and store password',
          'error',
        );
        return;
      }

      await api.post(`/stores/${selectedStoreId}/payment-providers`, {
        provider: 'SSL_COMMERZ',
        enabled: sslEnabled,
        mode: sslMode,
        publicConfig: { label: 'SSLCommerz' },
        ...(Object.keys(secrets).length > 0 ? { secrets } : {}),
      });
      pushToast('SSLCommerz provider saved', 'success');
      setSslStoreId('');
      setSslStorePassword('');
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onTestStripe() {
    if (!selectedStoreId || !canWrite) return;
    setValidatingStripe(true);
    try {
      await api.post(
        `/stores/${selectedStoreId}/payment-providers/STRIPE/validate`,
      );
      pushToast('Stripe credentials look valid', 'success');
    } catch (err) {
      pushToast(
        err instanceof ApiError ? err.message : 'Stripe validation failed',
        'error',
      );
    } finally {
      setValidatingStripe(false);
    }
  }

  async function onTestSsl() {
    if (!selectedStoreId || !canWrite) return;
    setValidatingSsl(true);
    try {
      await api.post(
        `/stores/${selectedStoreId}/payment-providers/SSL_COMMERZ/validate`,
      );
      pushToast('SSLCommerz credentials look valid', 'success');
    } catch (err) {
      pushToast(
        err instanceof ApiError ? err.message : 'SSLCommerz validation failed',
        'error',
      );
    } finally {
      setValidatingSsl(false);
    }
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="Select a store"
        description="Choose a store to configure payment providers."
      />
    );
  }

  const testRow = items.find((i) => i.provider === 'TEST');
  const stripeRow = items.find((i) => i.provider === 'STRIPE');
  const sslRow = items.find((i) => i.provider === 'SSL_COMMERZ');
  // The server refuses to turn on a provider the plan does not include; say so up front.
  const limits = subscription?.subscription?.plan.limits ?? null;
  const upgrade = (what: string, plans: string) => (
    <>
      <strong>{what}</strong> is available on the {plans} plan.{' '}
      <Link href="/dashboard/billing" className="font-semibold underline underline-offset-2">
        Upgrade in Plan &amp; billing →
      </Link>
    </>
  );
  const sslLocked = limits && !limits.onlinePayments ? upgrade('SSLCommerz', 'Growth or Business') : null;
  const stripeLocked = limits && !limits.stripe ? upgrade('Stripe', 'Business') : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payment providers</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Choose how customers can pay at checkout — Cash on delivery, bank transfer or online. Online keys are encrypted and never shown again after you save.
        </p>
      </div>

      {loading ? <LoadingState label="Loading providers…" /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && !canWrite ? (
        <EmptyState
          title="Read-only access"
          description="Payment provider settings require manager access."
        />
      ) : null}

      {!loading && !error && canWrite ? (
        <>
          <ProviderTabs
            value={tab}
            onChange={setTab}
            tabs={[
              {
                id: 'manual',
                name: 'Manual',
                mark: '৳',
                color: '#0f766e',
                active: Boolean(manual && (manual.paymentCodEnabled || manual.paymentBankTransferEnabled || manual.paymentOtherEnabled)),
              },
              { id: 'ssl', name: 'SSLCommerz', mark: 'S', color: '#1a7f5a', active: Boolean(sslRow?.enabled) },
              { id: 'stripe', name: 'Stripe', mark: 'S', color: '#635bff', active: Boolean(stripeRow?.enabled) },
              { id: 'test', name: 'Developer', mark: '</>', color: '#64748b', active: Boolean(testRow?.enabled) },
            ]}
          />

          <div id="provider-panel-manual" role="tabpanel" aria-labelledby="provider-tab-manual" hidden={tab !== 'manual'}>
            <ManualPaymentsPanel
              store={storeSettings}
              onlineActive={Boolean(
                (sslRow?.enabled && !sslLocked) || (stripeRow?.enabled && !stripeLocked) || testRow?.enabled,
              )}
            />
          </div>

          <div id="provider-panel-ssl" role="tabpanel" aria-labelledby="provider-tab-ssl" hidden={tab !== 'ssl'}>
            <ProviderCard
              mark="S"
              markColor="#1a7f5a"
              name="SSLCommerz"
              tagline="bKash, Nagad, Rocket and cards — for customers in Bangladesh"
              row={sslRow}
              testLabel="Sandbox"
              locked={sslLocked}
            >
              <form onSubmit={onSaveSsl} className="space-y-5">
                <Switch
                  checked={sslEnabled}
                  onChange={setSslEnabled}
                  label="Accept payments with SSLCommerz at checkout"
                  hint="Customers see SSLCommerz as a payment option when this is on."
                />
                <ModeSwitch value={sslMode} onChange={setSslMode} testLabel="Sandbox" />
                <div className="grid gap-4 md:grid-cols-2">
                  <SecretField
                    label="Store ID"
                    type="text"
                    value={sslStoreId}
                    onChange={setSslStoreId}
                    saved={Boolean(sslRow?.hasSecrets)}
                    placeholder="Your SSLCommerz store ID"
                  />
                  <SecretField
                    label="Store password"
                    value={sslStorePassword}
                    onChange={setSslStorePassword}
                    saved={Boolean(sslRow?.hasSecrets)}
                    placeholder="Your SSLCommerz store password"
                  />
                </div>
                <SafetyNote>
                  An order is marked paid only after SSLCommerz confirms the payment to us — never from the customer’s browser.
                </SafetyNote>
                <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
                  <Button type="submit" disabled={busy}>
                    {busy ? 'Saving…' : 'Save SSLCommerz'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || validatingSsl || !sslRow?.hasSecrets}
                    title={sslRow?.hasSecrets ? undefined : 'Save your keys first'}
                    onClick={() => void onTestSsl()}
                  >
                    {validatingSsl ? 'Testing…' : 'Test connection'}
                  </Button>
                </div>
              </form>
            </ProviderCard>
          </div>

          <div id="provider-panel-stripe" role="tabpanel" aria-labelledby="provider-tab-stripe" hidden={tab !== 'stripe'}>
            <ProviderCard
              mark="S"
              markColor="#635bff"
              name="Stripe"
              tagline="International credit and debit cards"
              row={stripeRow}
              testLabel="Test"
              locked={stripeLocked}
            >
              <form onSubmit={onSaveStripe} className="space-y-5">
                <Switch
                  checked={stripeEnabled}
                  onChange={setStripeEnabled}
                  label="Accept payments with Stripe at checkout"
                  hint="Customers pay on Stripe’s secure page and come back to your store."
                />
                <ModeSwitch value={stripeMode} onChange={setStripeMode} testLabel="Test" />
                <div className="grid gap-4 md:grid-cols-2">
                  <SecretField
                    label="Secret key"
                    value={stripeSecretKey}
                    onChange={setStripeSecretKey}
                    saved={Boolean(stripeRow?.hasSecrets)}
                    placeholder="sk_test_… or sk_live_…"
                  />
                  <SecretField
                    label="Webhook secret"
                    value={stripeWebhookSecret}
                    onChange={setStripeWebhookSecret}
                    saved={Boolean(stripeRow?.hasSecrets)}
                    placeholder="whsec_…"
                  />
                </div>
                <SafetyNote>
                  An order is marked paid only after Stripe’s signed webhook confirms it — never from the success page.
                </SafetyNote>
                <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
                  <Button type="submit" disabled={busy}>
                    {busy ? 'Saving…' : 'Save Stripe'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || validatingStripe || !stripeRow?.hasSecrets}
                    title={stripeRow?.hasSecrets ? undefined : 'Save your keys first'}
                    onClick={() => void onTestStripe()}
                  >
                    {validatingStripe ? 'Testing…' : 'Test connection'}
                  </Button>
                </div>
              </form>
            </ProviderCard>
          </div>

          <div id="provider-panel-test" role="tabpanel" aria-labelledby="provider-tab-test" hidden={tab !== 'test'}>
            <ProviderCard
              mark="</>"
              markColor="#64748b"
              name="Developer: test payment provider"
              tagline="For automated testing only. Customers never pay real money with it."
              row={testRow}
              testLabel="Test"
              locked={null}
            >
              <form onSubmit={onSaveTest} className="space-y-5">
                <Switch
                  checked={testEnabled}
                  onChange={setTestEnabled}
                  label="Show the test provider at checkout"
                  hint="Signs its webhooks with the secret below (HMAC)."
                />
                <SecretField
                  label="Webhook secret"
                  value={testWebhookSecret}
                  onChange={setTestWebhookSecret}
                  saved={Boolean(testRow?.hasSecrets)}
                  placeholder="Required"
                />
                <div className="border-t border-[var(--color-border)] pt-4">
                  <Button type="submit" disabled={busy}>
                    {busy ? 'Saving…' : 'Save TEST provider'}
                  </Button>
                </div>
              </form>
            </ProviderCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
