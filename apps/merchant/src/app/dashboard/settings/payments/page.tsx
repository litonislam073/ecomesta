'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
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

export default function PaymentSettingsPage() {
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();
  const [items, setItems] = useState<PaymentProviderConfigSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [validatingStripe, setValidatingStripe] = useState(false);
  const [validatingSsl, setValidatingSsl] = useState(false);

  const [testEnabled, setTestEnabled] = useState(false);
  const [testWebhookSecret, setTestWebhookSecret] = useState('');

  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripeMode, setStripeMode] = useState<'test' | 'live'>('test');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');

  const [sslEnabled, setSslEnabled] = useState(false);
  const [sslMode, setSslMode] = useState<'test' | 'live'>('test');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payment providers</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Configure online providers. Secrets are encrypted at rest and never shown
          again after save.
        </p>
      </div>

      {loading ? <LoadingState label="Loading providers…" /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[#f3f7f5] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Enabled</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Secrets</th>
                <th className="px-4 py-3 font-medium">Implemented</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.provider}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-4 py-3 font-medium">{item.provider}</td>
                  <td className="px-4 py-3">{item.enabled ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">{item.mode}</td>
                  <td className="px-4 py-3">
                    {item.hasSecrets ? 'Configured (masked)' : 'Not set'}
                  </td>
                  <td className="px-4 py-3">
                    {item.implemented ? 'Yes' : 'Coming soon'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {canWrite ? (
        <>
          <form
            onSubmit={onSaveTest}
            className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <h2 className="font-semibold">TEST provider</h2>
            <p className="text-sm text-[var(--color-muted)]">
              Deterministic online provider for local/automated flows. Webhook HMAC
              uses your webhook secret.
              {testRow?.hasSecrets
                ? ' A secret is already stored — leave blank to keep it.'
                : ' Set a webhook secret to enable.'}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={testEnabled}
                onChange={(e) => setTestEnabled(e.target.checked)}
              />
              Enabled for checkout
            </label>
            <label className="block space-y-1 text-sm">
              <span>Webhook secret</span>
              <Input
                type="password"
                autoComplete="new-password"
                value={testWebhookSecret}
                onChange={(e) => setTestWebhookSecret(e.target.value)}
                placeholder={
                  testRow?.hasSecrets ? '•••••••• (unchanged)' : 'Required'
                }
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save TEST provider'}
            </Button>
          </form>

          <form
            onSubmit={onSaveStripe}
            className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <h2 className="font-semibold">Stripe</h2>
            <p className="text-sm text-[var(--color-muted)]">
              Hosted Stripe Checkout. Payments become PAID only after a verified
              webhook — never from the success redirect.
              {stripeRow?.hasSecrets
                ? ' Secrets are stored — leave blank to keep them.'
                : ' Provide secret key and webhook secret.'}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={stripeEnabled}
                onChange={(e) => setStripeEnabled(e.target.checked)}
              />
              Enabled for checkout
            </label>
            <label className="block space-y-1 text-sm">
              <span>Mode</span>
              <select
                className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
                value={stripeMode}
                onChange={(e) =>
                  setStripeMode(e.target.value === 'live' ? 'live' : 'test')
                }
              >
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span>Secret key</span>
              <Input
                type="password"
                autoComplete="new-password"
                value={stripeSecretKey}
                onChange={(e) => setStripeSecretKey(e.target.value)}
                placeholder={
                  stripeRow?.hasSecrets
                    ? '•••••••• (unchanged)'
                    : 'sk_test_… or sk_live_…'
                }
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Webhook secret</span>
              <Input
                type="password"
                autoComplete="new-password"
                value={stripeWebhookSecret}
                onChange={(e) => setStripeWebhookSecret(e.target.value)}
                placeholder={
                  stripeRow?.hasSecrets ? '•••••••• (unchanged)' : 'whsec_…'
                }
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save Stripe'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || validatingStripe || !stripeRow?.hasSecrets}
                onClick={() => void onTestStripe()}
              >
                {validatingStripe ? 'Testing…' : 'Test connection'}
              </Button>
            </div>
          </form>

          <form
            onSubmit={onSaveSsl}
            className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <h2 className="font-semibold">SSLCommerz</h2>
            <p className="text-sm text-[var(--color-muted)]">
              Bangladesh hosted checkout (v4). Payments become PAID only after the
              Order Validation API confirms the IPN — never from the browser success
              URL.
              {sslRow?.hasSecrets
                ? ' Secrets are stored — leave blank to keep them.'
                : ' Provide store ID and store password.'}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sslEnabled}
                onChange={(e) => setSslEnabled(e.target.checked)}
              />
              Enabled for checkout
            </label>
            <label className="block space-y-1 text-sm">
              <span>Mode</span>
              <select
                className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
                value={sslMode}
                onChange={(e) =>
                  setSslMode(e.target.value === 'live' ? 'live' : 'test')
                }
              >
                <option value="test">Sandbox</option>
                <option value="live">Live</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span>Store ID</span>
              <Input
                type="text"
                autoComplete="off"
                value={sslStoreId}
                onChange={(e) => setSslStoreId(e.target.value)}
                placeholder={
                  sslRow?.hasSecrets ? '•••••••• (unchanged)' : 'Store ID'
                }
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Store password</span>
              <Input
                type="password"
                autoComplete="new-password"
                value={sslStorePassword}
                onChange={(e) => setSslStorePassword(e.target.value)}
                placeholder={
                  sslRow?.hasSecrets ? '•••••••• (unchanged)' : 'Store password'
                }
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save SSLCommerz'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || validatingSsl || !sslRow?.hasSecrets}
                onClick={() => void onTestSsl()}
              >
                {validatingSsl ? 'Testing…' : 'Test connection'}
              </Button>
            </div>
          </form>
        </>
      ) : (
        <EmptyState
          title="Read-only access"
          description="Payment provider settings require manager access."
        />
      )}
    </div>
  );
}
