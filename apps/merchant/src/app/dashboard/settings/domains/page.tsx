'use client';

import Link from 'next/link';
import { ReadOnlyRow, SettingsGate, SettingsHeader } from '@/components/settings/settings-ui';
import { Card } from '@/components/ui/card';
import { useStoreSettingsSummary } from '@/lib/store-settings';
import { useStoreContext } from '@/lib/store-context';

export default function DomainSettingsPage() {
  const { selectedStoreId } = useStoreContext();
  const { summary, loading, error, reload } = useStoreSettingsSummary();

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Domains"
        description="Where customers find your storefront."
      />
      <SettingsGate storeId={selectedStoreId} loading={loading} error={error} onRetry={() => void reload()}>
        {summary ? (
          <Card
            title="Domain overview"
            actions={
              <Link href="/dashboard/domains" className="text-sm font-medium text-[var(--color-accent)] hover:underline">
                Manage domains
              </Link>
            }
          >
            <dl className="divide-y divide-[var(--color-border)]">
              <ReadOnlyRow
                label="Primary address"
                value={summary.domains.primaryHostname ?? 'Not set'}
                hint="Used as the canonical address in search results."
              />
              <ReadOnlyRow
                label="Platform address"
                value={summary.domains.platformHostname ?? 'Not set'}
              />
              <ReadOnlyRow
                label="Custom domains"
                value={`${summary.domains.activeCustomDomainCount} active${
                  summary.domains.pendingCustomDomainCount
                    ? `, ${summary.domains.pendingCustomDomainCount} pending verification`
                    : ''
                }`}
              />
            </dl>
          </Card>
        ) : null}
      </SettingsGate>
    </div>
  );
}
