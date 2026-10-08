'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { CourierConnectionInfo } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Field, ReadOnlyNotice, ReadOnlyRow, SettingsGate, SettingsHeader, textareaClass } from '@/components/settings/settings-ui';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

type Form = { apiKey: string; secretKey: string; pickupName: string; pickupPhone: string; pickupAddress: string; defaultWeightKg: string };
const emptyForm: Form = { apiKey: '', secretKey: '', pickupName: '', pickupPhone: '', pickupAddress: '', defaultWeightKg: '' };

export default function CourierSettingsPage() {
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const [couriers, setCouriers] = useState<CourierConnectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: true; data: CourierConnectionInfo[] }>(`/stores/${selectedStoreId}/couriers`);
      setCouriers(res.data);
    } catch (err) {
      setError(humanApiError(err, 'Could not load couriers'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Couriers"
        description="Connect a courier to book parcels and track deliveries from an order."
      />
      {!canWrite ? <ReadOnlyNotice /> : null}
      <SettingsGate storeId={selectedStoreId} loading={loading} error={error} onRetry={() => void load()}>
        <div className="space-y-4">
          {couriers.map((courier) => (
            <CourierCard
              key={courier.provider}
              storeId={selectedStoreId!}
              courier={courier}
              canWrite={canWrite}
              onChange={(next) => setCouriers((list) => list.map((c) => (c.provider === next.provider ? next : c)))}
            />
          ))}
        </div>
      </SettingsGate>
    </div>
  );
}

function CourierCard({
  storeId,
  courier,
  canWrite,
  onChange,
}: {
  storeId: string;
  courier: CourierConnectionInfo;
  canWrite: boolean;
  onChange: (next: CourierConnectionInfo) => void;
}) {
  const { pushToast } = useToast();
  const connected = courier.status === 'CONNECTED';
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const id = courier.provider.toLowerCase();

  function startEditing() {
    // Saved keys are never sent back to the browser: the key fields always start empty.
    setForm({
      ...emptyForm,
      pickupName: courier.pickupName ?? '',
      pickupPhone: courier.pickupPhone ?? '',
      pickupAddress: courier.pickupAddress ?? '',
      defaultWeightKg: courier.defaultWeightKg?.toString() ?? '',
    });
    setFormError(null);
    setEditing(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const apiKey = form.apiKey.trim();
    const secretKey = form.secretKey.trim();
    if (!connected && (!apiKey || !secretKey)) return setFormError('Enter the API key and secret key from your Steadfast account.');
    if ((apiKey || secretKey) && !(apiKey && secretKey)) return setFormError('Enter both the API key and the secret key.');
    const weight = form.defaultWeightKg.trim();
    if (weight && !(Number(weight) > 0 && Number(weight) <= 100)) return setFormError('Default weight must be between 0.01 and 100 kg.');
    setBusy(true);
    setFormError(null);
    try {
      const res = await api.put<{ success: true; data: CourierConnectionInfo }>(`/stores/${storeId}/couriers/${courier.provider}`, {
        ...(apiKey ? { apiKey, secretKey } : {}),
        pickupName: form.pickupName,
        pickupPhone: form.pickupPhone,
        pickupAddress: form.pickupAddress,
        ...(weight ? { defaultWeightKg: Number(weight) } : {}),
      });
      onChange(res.data);
      setEditing(false);
      setForm(emptyForm);
      pushToast(connected ? `${courier.name} settings saved` : `${courier.name} connected`, 'success');
    } catch (err) {
      setFormError(humanApiError(err, `Could not save ${courier.name}`));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const res = await api.delete<{ success: true; data: CourierConnectionInfo }>(`/stores/${storeId}/couriers/${courier.provider}`);
      onChange(res.data);
      setConfirmDisconnect(false);
      setEditing(false);
      pushToast(`${courier.name} disconnected`, 'success');
    } catch (err) {
      pushToast(humanApiError(err, `Could not disconnect ${courier.name}`), 'error');
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Card
      title={courier.name}
      actions={<Badge tone={connected ? 'success' : 'neutral'}>{connected ? 'Connected' : 'Not connected'}</Badge>}
    >
      <div className="space-y-4 p-4">
        {connected && !editing ? (
          <dl className="divide-y divide-[var(--color-border)]">
            <ReadOnlyRow label="API credentials" value="Saved (hidden)" />
            <ReadOnlyRow
              label="Pickup location"
              value={[courier.pickupName, courier.pickupPhone, courier.pickupAddress].filter(Boolean).join(' · ') || 'Not set'}
            />
            <ReadOnlyRow label="Default weight" value={courier.defaultWeightKg ? `${courier.defaultWeightKg} kg` : 'Not set'} />
          </dl>
        ) : null}

        {!connected && !editing ? (
          <p className="text-sm text-[var(--color-muted)]">
            Book Steadfast parcels from an order and refresh their delivery status here. You need the API key and
            secret key from your Steadfast merchant account.
          </p>
        ) : null}

        {editing ? (
          <form onSubmit={(e) => void save(e)} className="space-y-4" noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id={`${id}-api-key`} label="API key" hint={connected ? 'Leave both keys empty to keep the saved ones.' : undefined}>
                <Input id={`${id}-api-key`} type="password" autoComplete="off" spellCheck={false} value={form.apiKey} onChange={set('apiKey')} maxLength={200} />
              </Field>
              <Field id={`${id}-secret-key`} label="Secret key">
                <Input id={`${id}-secret-key`} type="password" autoComplete="new-password" spellCheck={false} value={form.secretKey} onChange={set('secretKey')} maxLength={200} />
              </Field>
              <Field id={`${id}-pickup-name`} label="Pickup contact name">
                <Input id={`${id}-pickup-name`} value={form.pickupName} onChange={set('pickupName')} maxLength={100} />
              </Field>
              <Field id={`${id}-pickup-phone`} label="Pickup phone">
                <Input id={`${id}-pickup-phone`} inputMode="tel" value={form.pickupPhone} onChange={set('pickupPhone')} maxLength={20} />
              </Field>
            </div>
            <Field
              id={`${id}-pickup-address`}
              label="Pickup address"
              hint="For your team. Steadfast collects from the pickup address set in your Steadfast account."
            >
              <textarea id={`${id}-pickup-address`} className={textareaClass} rows={2} value={form.pickupAddress} onChange={set('pickupAddress')} maxLength={250} />
            </Field>
            <Field id={`${id}-weight`} label="Default parcel weight (kg)" hint="Pre-fills the weight when you book a parcel.">
              <Input id={`${id}-weight`} inputMode="decimal" value={form.defaultWeightKg} onChange={set('defaultWeightKg')} className="max-w-[10rem]" />
            </Field>
            {formError ? (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {formError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'Checking with Steadfast…' : connected ? 'Save' : `Connect ${courier.name}`}
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={startEditing}>
              {connected ? 'Update' : `Connect ${courier.name}`}
            </Button>
            {connected ? (
              <Button type="button" variant="secondary" onClick={() => setConfirmDisconnect(true)}>
                Disconnect
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmDisconnect}
        title={`Disconnect ${courier.name}?`}
        description="The saved API keys are deleted. Booked shipments keep their tracking history, but you can't book or refresh them until you connect again."
        confirmLabel="Disconnect"
        danger
        safeDefault
        busy={busy}
        onConfirm={() => void disconnect()}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </Card>
  );
}
