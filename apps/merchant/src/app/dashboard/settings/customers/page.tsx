'use client';

import Link from 'next/link';
import {
  ReadOnlyRow,
  SettingsGate,
  SettingsHeader,
} from '@/components/settings/settings-ui';
import { Card } from '@/components/ui/card';
import { useStoreSettings } from '@/lib/store-settings';

export default function CustomerSettingsPage() {
  const { storeId, settings, loading, error, reload } = useStoreSettings();

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Customers"
        description="How customer records are created in your store."
      />
      <SettingsGate storeId={storeId} loading={loading} error={error} onRetry={() => void reload()}>
        {settings ? (
          <div className="space-y-6">
            <Card title="Customer accounts">
              <dl className="divide-y divide-[var(--color-border)]">
                <ReadOnlyRow
                  label="Checkout"
                  value="Guest checkout"
                  hint="Customers don’t need an account or password to order. Storefront customer accounts are not available."
                />
                <ReadOnlyRow
                  label="Customer details"
                  value="Saved on each order"
                  hint="Guest orders keep the customer’s name, email, phone and address on the order. Customer records in your dashboard are added by your team."
                />
                <ReadOnlyRow
                  label="Order tracking"
                  value="Order link + email"
                  hint="Customers track orders with their order link and the email they used at checkout."
                />
              </dl>
            </Card>
            <Card title="Manage customers">
              <Link href="/dashboard/customers" className="text-sm font-medium text-[var(--color-accent)] hover:underline">
                View customers
              </Link>
            </Card>
          </div>
        ) : null}
      </SettingsGate>
    </div>
  );
}
