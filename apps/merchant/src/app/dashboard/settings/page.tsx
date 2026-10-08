'use client';

import Link from 'next/link';
import { SettingsGate, SettingsHeader } from '@/components/settings/settings-ui';
import type { MerchantSubscription } from '@ecomesta/types';
import { formatBillingDate } from '@ecomesta/utils';
import { useStoreSettings, useStoreSettingsSummary } from '@/lib/store-settings';
import { useSubscription } from '@/lib/subscription-context';

function subscriptionLines(data: MerchantSubscription | null): string[] {
  const sub = data?.subscription;
  if (!sub) {
    return [
      data?.pendingPayment
        ? 'Payment being confirmed · your store goes live once it is confirmed'
        : 'No plan yet · choose and pay for a plan in Plan & billing',
    ];
  }
  const lines = [`${sub.plan.name} plan`];
  if (sub.phase === 'TRIAL' && sub.trialEndsAt) {
    lines.push(`Free trial ends ${formatBillingDate(sub.trialEndsAt)}`);
  } else if (sub.phase === 'GRACE' && sub.paymentDueBy) {
    lines.push(`Payment due by ${formatBillingDate(sub.paymentDueBy)}`);
  } else if (sub.phase === 'ACTIVE') {
    lines.push('Active');
  }
  return lines;
}

function OverviewCard({
  href,
  title,
  lines,
}: {
  href: string;
  title: string;
  lines: (string | null | undefined)[];
}) {
  return (
    <li>
      <Link
        href={href}
        className="block h-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        <h2 className="font-semibold text-[var(--color-ink)]">{title}</h2>
        <ul className="mt-2 space-y-0.5 text-sm text-[var(--color-muted)]">
          {lines.filter(Boolean).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Link>
    </li>
  );
}

export default function SettingsOverviewPage() {
  const { storeId, settings, loading, error, reload } = useStoreSettings();
  const { summary } = useStoreSettingsSummary();
  const subscription = useSubscription();

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Settings"
        description="Manage how your store works. Appearance is edited separately in Theme."
      />
      <SettingsGate storeId={storeId} loading={loading} error={error} onRetry={() => void reload()}>
        {settings ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <OverviewCard
              href="/dashboard/settings/general"
              title="General"
              lines={[
                settings.name,
                `${settings.currency} · ${settings.timezone}`,
                settings.defaultLanguage === 'bn' ? 'Bangla storefront' : 'English storefront',
              ]}
            />
            <OverviewCard
              href="/dashboard/settings/store"
              title="Store details"
              lines={[
                settings.email ?? 'No support email',
                settings.phone ?? 'No support phone',
              ]}
            />
            <OverviewCard
              href="/dashboard/settings/checkout"
              title="Checkout"
              lines={[
                'Guest checkout',
                'Phone required, email optional',
                settings.checkoutAllowOrderNotes ? 'Order notes on' : 'Order notes off',
              ]}
            />
            <OverviewCard
              href="/dashboard/settings/orders"
              title="Orders"
              lines={[
                settings.allowCustomerCancellation
                  ? 'Customers can cancel eligible orders'
                  : 'Only your team can cancel orders',
              ]}
            />
            <OverviewCard
              href="/dashboard/settings/customers"
              title="Customers"
              lines={['Guest checkout, no customer accounts']}
            />
            <OverviewCard
              href="/dashboard/settings/notifications"
              title="Notifications"
              lines={['Email delivery not connected yet']}
            />
            <OverviewCard
              href="/dashboard/settings/payments"
              title="Payments"
              lines={[
                'Cash on delivery and bank transfer',
                summary
                  ? summary.payments.onlineProviders.length
                    ? `Online: ${summary.payments.onlineProviders
                        .map((p) => `${p.provider}${p.mode === 'test' ? ' (test)' : ''}`)
                        .join(', ')}`
                    : 'No online provider enabled'
                  : null,
              ]}
            />
            <OverviewCard
              href="/dashboard/settings/shipping"
              title="Shipping"
              lines={
                summary
                  ? [
                      `${summary.shipping.zoneCount} zone${summary.shipping.zoneCount === 1 ? '' : 's'}`,
                      `${summary.shipping.activeMethodCount} active method${summary.shipping.activeMethodCount === 1 ? '' : 's'}`,
                    ]
                  : ['Zones and delivery methods']
              }
            />
            <OverviewCard
              href="/dashboard/settings/couriers"
              title="Couriers"
              lines={['Steadfast parcel booking and tracking']}
            />
            <OverviewCard
              href="/dashboard/settings/domains"
              title="Domains"
              lines={[summary?.domains.primaryHostname ?? 'Storefront addresses']}
            />
            <OverviewCard
              href="/dashboard/settings/seo"
              title="SEO"
              lines={[
                settings.seoTitle ?? 'Using store name as title',
                settings.seoIndexingEnabled ? 'Visible to search engines' : 'Hidden from search engines',
              ]}
            />
            <OverviewCard
              href="/dashboard/settings/tracking"
              title="Marketing & tracking"
              lines={[
                [
                  settings.metaPixelId ? 'Facebook Pixel' : null,
                  settings.gtmContainerId ? 'Tag Manager' : null,
                  settings.ga4MeasurementId ? 'Analytics' : null,
                  settings.googleSiteVerification ? 'Search Console' : null,
                ]
                  .filter(Boolean)
                  .join(', ') || 'Facebook Pixel, Google Analytics, Tag Manager, Search Console',
              ]}
            />
            <OverviewCard
              href="/dashboard/theme"
              title="Theme"
              lines={[summary?.theme.name ?? 'Colours, fonts, logo and homepage']}
            />
            <OverviewCard
              href="/dashboard/billing"
              title="Plan & billing"
              lines={subscriptionLines(subscription.data)}
            />
            <OverviewCard
              href="/dashboard/settings/danger-zone"
              title="Danger zone"
              lines={[`Status: ${settings.status}`]}
            />
          </ul>
        ) : null}
      </SettingsGate>
    </div>
  );
}
