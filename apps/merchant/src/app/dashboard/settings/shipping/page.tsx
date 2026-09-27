'use client';

import Link from 'next/link';
import { ReadOnlyRow, SettingsGate, SettingsHeader } from '@/components/settings/settings-ui';
import { Card } from '@/components/ui/card';
import { useStoreSettingsSummary } from '@/lib/store-settings';
import { useStoreContext } from '@/lib/store-context';

export default function ShippingSettingsPage() {
  const { selectedStoreId } = useStoreContext();
  const { summary, loading, error, reload } = useStoreSettingsSummary();

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Shipping"
        description="Delivery zones, methods and cash on delivery availability."
      />
      <SettingsGate storeId={selectedStoreId} loading={loading} error={error} onRetry={() => void reload()}>
        {summary ? (
          <Card
            title="Shipping overview"
            actions={
              <Link href="/dashboard/shipping" className="text-sm font-medium text-[var(--color-accent)] hover:underline">
                Manage shipping
              </Link>
            }
          >
            <dl className="divide-y divide-[var(--color-border)]">
              <ReadOnlyRow label="Shipping zones" value={summary.shipping.zoneCount} />
              <ReadOnlyRow
                label="Active methods"
                value={`${summary.shipping.activeMethodCount} of ${summary.shipping.methodCount}`}
              />
              <ReadOnlyRow
                label="Cash on delivery"
                value={
                  summary.shipping.codMethodCount > 0
                    ? `Available on ${summary.shipping.codMethodCount} method${summary.shipping.codMethodCount === 1 ? '' : 's'}`
                    : 'Not available on any method'
                }
              />
            </dl>
            {summary.shipping.activeMethodCount === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-danger)]">
                Customers can’t check out until at least one shipping method is active.
              </p>
            ) : null}
          </Card>
        ) : null}
      </SettingsGate>
    </div>
  );
}
