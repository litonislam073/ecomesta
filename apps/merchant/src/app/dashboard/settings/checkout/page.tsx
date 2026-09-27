'use client';

import { FormEvent } from 'react';
import Link from 'next/link';
import {
  ReadOnlyNotice,
  ReadOnlyRow,
  SaveBar,
  SettingsGate,
  SettingsHeader,
  ToggleRow,
} from '@/components/settings/settings-ui';
import { Card } from '@/components/ui/card';
import { useSettingsDraft, useStoreSettings } from '@/lib/store-settings';

const KEYS = ['checkoutRequirePhone', 'checkoutAllowOrderNotes'] as const;

export default function CheckoutSettingsPage() {
  const { storeId, settings, loading, error, reload, save, saving, canEdit } =
    useStoreSettings();
  const { draft, setField, changes, dirty, reset } = useSettingsDraft(settings, KEYS);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || !dirty) return;
    await save(changes, 'Checkout settings saved');
  }

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Checkout"
        description="Choose what customers must provide when they place an order."
      />
      <SettingsGate storeId={storeId} loading={loading} error={error} onRetry={() => void reload()}>
        {settings ? (
          <form onSubmit={onSubmit} className="space-y-6">
            {!canEdit ? <ReadOnlyNotice /> : null}
            <Card title="Customer information">
              <ToggleRow
                id="checkout-require-phone"
                label="Require a phone number"
                description="Recommended for cash on delivery so couriers can reach the customer. Orders without a phone number are rejected."
                checked={Boolean(draft.checkoutRequirePhone)}
                disabled={!canEdit}
                onChange={(v) => setField('checkoutRequirePhone', v)}
              />
              <ToggleRow
                id="checkout-allow-notes"
                label="Allow order notes"
                description="Show an optional note field at checkout for delivery instructions."
                checked={Boolean(draft.checkoutAllowOrderNotes)}
                disabled={!canEdit}
                onChange={(v) => setField('checkoutAllowOrderNotes', v)}
              />
            </Card>

            <Card
              title="Always on"
              description="These rules keep checkout, payments and delivery working and cannot be turned off."
            >
              <dl className="divide-y divide-[var(--color-border)]">
                <ReadOnlyRow
                  label="Guest checkout"
                  value="On"
                  hint="Customers order without creating an account."
                />
                <ReadOnlyRow
                  label="Email address"
                  value="Required"
                  hint="Used for order tracking and by online payment providers."
                />
                <ReadOnlyRow
                  label="Shipping address"
                  value="Required"
                  hint="Division, district and upazila are used to calculate delivery."
                />
              </dl>
            </Card>

            <Card title="Related settings">
              <ul className="space-y-1 text-sm">
                <li>
                  <Link href="/dashboard/settings/payments" className="text-[var(--color-accent)] hover:underline">
                    Payment providers
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/shipping" className="text-[var(--color-accent)] hover:underline">
                    Shipping zones and methods
                  </Link>
                </li>
              </ul>
            </Card>

            <SaveBar saving={saving} dirty={dirty} canEdit={canEdit} onReset={reset} />
          </form>
        ) : null}
      </SettingsGate>
    </div>
  );
}
