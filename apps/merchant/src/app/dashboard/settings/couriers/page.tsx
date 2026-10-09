'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { CourierConnectionInfo } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { SHIPMENT_COURIERS } from '@ecomesta/utils';
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

type Form = { credentials: Record<string, string>; pickupName: string; pickupPhone: string; pickupAddress: string; defaultWeightKg: string };
const emptyForm: Form = { credentials: {}, pickupName: '', pickupPhone: '', pickupAddress: '', defaultWeightKg: '' };

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
          <section
            aria-labelledby="other-couriers"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <h2 id="other-couriers" className="font-semibold">
              Other couriers
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              These couriers have no direct booking yet. Book with them as usual, then open the order, choose the
              courier under Shipments and add the tracking number. Your customer sees the courier and tracking number
              on the order tracking page.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {SHIPMENT_COURIERS.filter(
                (courier) => !['MANUAL', 'OTHER'].includes(courier.code) && !couriers.some((c) => c.provider === courier.code),
              ).map((courier) => (
                <li
                  key={courier.code}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-sm"
                >
                  {courier.name}
                </li>
              ))}
            </ul>
          </section>
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
    // Saved secrets are never sent back to the browser: secret fields always start empty.
    setForm({
      ...emptyForm,
      credentials: { ...courier.settings },
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
    const value = (key: string) => form.credentials[key]?.trim() ?? '';
    // Connecting needs every required value; later, an empty secret keeps the saved one.
    const missing = courier.fields.filter((field) => field.required && !value(field.key) && (!connected || !field.secret));
    if (missing.length > 0) return setFormError(`Enter the ${missing.map((field) => field.label).join(', ')}.`);
    // Only what changed is sent, so saving pickup details does not re-check the keys with the courier.
    const credentials = Object.fromEntries(
      courier.fields
        .filter((field) => (field.secret ? value(field.key) !== '' : value(field.key) !== (courier.settings[field.key] ?? '')))
        .map((field) => [field.key, value(field.key)]),
    );
    const weight = form.defaultWeightKg.trim();
    if (weight && !(Number(weight) > 0 && Number(weight) <= 100)) return setFormError('Default weight must be between 0.01 and 100 kg.');
    setBusy(true);
    setFormError(null);
    try {
      const res = await api.put<{ success: true; data: CourierConnectionInfo }>(`/stores/${storeId}/couriers/${courier.provider}`, {
        ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
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
            {courier.fields.map((field) => (
              <ReadOnlyRow key={field.key} label={field.label} value={field.secret ? 'Saved (hidden)' : courier.settings[field.key] || 'Not set'} />
            ))}
            <ReadOnlyRow
              label="Pickup location"
              value={[courier.pickupName, courier.pickupPhone, courier.pickupAddress].filter(Boolean).join(' · ') || 'Not set'}
            />
            <ReadOnlyRow label="Default weight" value={courier.defaultWeightKg ? `${courier.defaultWeightKg} kg` : 'Not set'} />
          </dl>
        ) : null}

        {!connected && !editing ? (
          <p className="text-sm text-[var(--color-muted)]">
            Book {courier.name} parcels from an order and refresh their delivery status here. {courier.connectHelp}
          </p>
        ) : null}

        {editing ? (
          <form onSubmit={(e) => void save(e)} className="space-y-4" noValidate>
            <p className="text-sm text-[var(--color-muted)]">{courier.connectHelp}</p>
            <div className="grid gap-4 md:grid-cols-2">
              {courier.fields.map((field) => (
                <Field
                  key={field.key}
                  id={`${id}-${field.key}`}
                  label={field.required ? field.label : `${field.label} (optional)`}
                  hint={field.secret && connected ? 'Leave empty to keep the saved value.' : field.hint}
                >
                  <Input
                    id={`${id}-${field.key}`}
                    type={field.secret ? 'password' : 'text'}
                    autoComplete={field.secret ? 'new-password' : 'off'}
                    spellCheck={false}
                    placeholder={field.placeholder}
                    value={form.credentials[field.key] ?? ''}
                    onChange={(e) => {
                      const next = e.target.value;
                      setForm((f) => ({ ...f, credentials: { ...f.credentials, [field.key]: next } }));
                    }}
                    maxLength={300}
                  />
                </Field>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
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
              hint={
                courier.provider === 'PAPERFLY'
                  ? 'Paperfly picks up parcels from this address.'
                  : `For your team. ${courier.name} picks up from the address set in your ${courier.name} account.`
              }
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
                {busy ? `Checking with ${courier.name}…` : connected ? 'Save' : `Connect ${courier.name}`}
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
        description="The saved API details are deleted. Booked shipments keep their tracking history, but you can't book or refresh them until you connect again."
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
