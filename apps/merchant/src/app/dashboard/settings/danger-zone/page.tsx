'use client';

import { ReadOnlyRow, SettingsGate, SettingsHeader } from '@/components/settings/settings-ui';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useStoreSettings } from '@/lib/store-settings';

const STATUS_TONE = {
  ACTIVE: 'success',
  DRAFT: 'neutral',
  INACTIVE: 'warning',
  SUSPENDED: 'danger',
} as const;

export default function DangerZoneSettingsPage() {
  const { storeId, settings, loading, error, reload } = useStoreSettings();

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Danger zone"
        description="Store status and permanent actions."
      />
      <SettingsGate storeId={storeId} loading={loading} error={error} onRetry={() => void reload()}>
        {settings ? (
          <Card className="border-[var(--color-danger)]/40" title="Store status">
            <dl className="divide-y divide-[var(--color-border)]">
              <ReadOnlyRow
                label="Current status"
                value={<Badge tone={STATUS_TONE[settings.status] ?? 'neutral'}>{settings.status}</Badge>}
              />
              <ReadOnlyRow
                label="Disable storefront"
                value="Managed by platform administration"
                hint="Contact Ecomesta support to pause or reactivate your storefront."
              />
              <ReadOnlyRow
                label="Delete store"
                value="Store deletion is managed by platform administration."
              />
            </dl>
          </Card>
        ) : null}
      </SettingsGate>
    </div>
  );
}
