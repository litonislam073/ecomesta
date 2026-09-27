'use client';

import { FormEvent } from 'react';
import {
  ReadOnlyNotice,
  SaveBar,
  SettingsGate,
  SettingsHeader,
  ToggleRow,
} from '@/components/settings/settings-ui';
import { Card } from '@/components/ui/card';
import { useSettingsDraft, useStoreSettings } from '@/lib/store-settings';

const KEYS = ['allowCustomerCancellation'] as const;

export default function OrderSettingsPage() {
  const { storeId, settings, loading, error, reload, save, saving, canEdit } =
    useStoreSettings();
  const { draft, setField, changes, dirty, reset } = useSettingsDraft(settings, KEYS);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || !dirty) return;
    await save(changes, 'Order settings saved');
  }

  const statuses = settings?.fixed.customerCancellableStatuses ?? ['PENDING', 'CONFIRMED'];

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Orders"
        description="Control what customers can do with their orders after checkout."
      />
      <SettingsGate storeId={storeId} loading={loading} error={error} onRetry={() => void reload()}>
        {settings ? (
          <form onSubmit={onSubmit} className="space-y-6">
            {!canEdit ? <ReadOnlyNotice /> : null}
            <Card title="Customer cancellation">
              <ToggleRow
                id="orders-allow-cancellation"
                label="Let customers cancel their own orders"
                description="Customers see a Cancel order button on their order tracking page after confirming their email."
                checked={Boolean(draft.allowCustomerCancellation)}
                disabled={!canEdit}
                onChange={(v) => setField('allowCustomerCancellation', v)}
              />
              <div className="mt-3 rounded-md bg-[#f3f7f5] p-3 text-sm text-[var(--color-muted)]">
                <p className="font-medium text-[var(--color-ink)]">An order can only be cancelled when:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>its status is {statuses.join(' or ')},</li>
                  <li>nothing has been packed or shipped yet, and</li>
                  <li>no online payment has been taken or is in progress.</li>
                </ul>
                <p className="mt-2">
                  Cancelled items go back into stock. Orders that don’t qualify can still be
                  cancelled by your team from the order page.
                </p>
              </div>
            </Card>

            <SaveBar saving={saving} dirty={dirty} canEdit={canEdit} onReset={reset} />
          </form>
        ) : null}
      </SettingsGate>
    </div>
  );
}
