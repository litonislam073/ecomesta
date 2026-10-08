'use client';

import Link from 'next/link';
import { FormEvent } from 'react';
import {
  Field,
  ReadOnlyNotice,
  SaveBar,
  SettingsGate,
  SettingsHeader,
} from '@/components/settings/settings-ui';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSettingsDraft, useStoreSettings, useStoreSettingsSummary } from '@/lib/store-settings';
import { storefrontUrl } from '@/lib/storefront-url';
import { TRACKING_PATTERNS, verificationCode } from '@/lib/tracking-ids';
import { useSubscription } from '@/lib/subscription-context';

const KEYS = ['metaPixelId', 'gtmContainerId', 'ga4MeasurementId', 'googleSiteVerification'] as const;

const { pixel: PIXEL, gtm: GTM, ga4: GA4, verification: VERIFICATION } = TRACKING_PATTERNS;

function Connected({ on, paused }: { on: boolean; paused?: boolean }) {
  if (on && paused) {
    return <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-xs font-semibold text-[#8a5a00]">Paused (upgrade)</span>;
  }
  return on ? (
    <span className="rounded-full bg-[#e3f1ec] px-2 py-0.5 text-xs font-semibold text-[#1b6b53]">Connected</span>
  ) : (
    <span className="rounded-full bg-[#f1f4f7] px-2 py-0.5 text-xs font-medium text-[var(--color-muted)]">Not set up</span>
  );
}

const EVENTS: [string, string, string][] = [
  ['Page view', 'PageView', 'page_view'],
  ['Product viewed', 'ViewContent', 'view_item'],
  ['Added to cart', 'AddToCart', 'add_to_cart'],
  ['Checkout started', 'InitiateCheckout', 'begin_checkout'],
  ['Order placed', 'Purchase', 'purchase'],
];

export default function TrackingSettingsPage() {
  const { storeId, settings, loading, error, reload, save, saving, canEdit } = useStoreSettings();
  const { summary } = useStoreSettingsSummary();
  const { draft, setField, changes, dirty, reset } = useSettingsDraft(settings, KEYS);
  const { data: subscription } = useSubscription();
  // Growth and Business only; the server refuses a Starter store too.
  const limits = subscription?.subscription?.plan.limits ?? null;
  const locked = Boolean(limits && !limits.marketingTracking);
  const editable = canEdit && !locked;

  const pixel = (draft.metaPixelId ?? '').trim();
  const gtm = (draft.gtmContainerId ?? '').trim().toUpperCase();
  const ga4 = (draft.ga4MeasurementId ?? '').trim().toUpperCase();
  const verification = verificationCode(draft.googleSiteVerification ?? '');

  const errors = {
    metaPixelId: pixel && !PIXEL.test(pixel) ? 'The Pixel ID is a number, e.g. 123456789012345.' : null,
    gtmContainerId: gtm && !GTM.test(gtm) ? 'Use the container ID that starts with GTM-, e.g. GTM-ABC1234.' : null,
    ga4MeasurementId: ga4 && !GA4.test(ga4) ? 'Use the measurement ID that starts with G-, e.g. G-ABC123XYZ9.' : null,
    googleSiteVerification:
      verification && !VERIFICATION.test(verification)
        ? 'Paste the google-site-verification meta tag (or just its code) from Search Console.'
        : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editable || !dirty || hasErrors) return;
    await save(changes, 'Marketing & tracking saved');
  }

  const storeAddress = summary?.domains.primaryHostname
    ? `https://${summary.domains.primaryHostname}/`
    : settings
      ? storefrontUrl(settings.slug)
      : '';

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Marketing & tracking"
        description="Connect your Facebook Pixel, Google Tag Manager, Google Analytics and Search Console. Paste the ID only — your store adds the code for you."
      />
      <SettingsGate storeId={storeId} loading={loading} error={error} onRetry={() => void reload()}>
        {settings ? (
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            {!canEdit ? <ReadOnlyNotice /> : null}
            {locked ? (
              <div role="status" className="rounded-xl border border-[#f2d9a6] bg-[#fff8e8] px-4 py-3 text-sm text-[#7a5300]">
                <strong>Marketing &amp; tracking</strong> is available on the <strong>Growth</strong> and{' '}
                <strong>Business</strong> plans.{' '}
                <Link href="/dashboard/billing" className="font-semibold underline underline-offset-2">
                  Upgrade in Plan &amp; billing →
                </Link>
                {settings.metaPixelId || settings.gtmContainerId || settings.ga4MeasurementId || settings.googleSiteVerification ? (
                  <span className="mt-1 block text-xs">
                    Your saved IDs are kept but not used on your store until you upgrade.
                  </span>
                ) : null}
              </div>
            ) : null}

            <Card title="Facebook (Meta) Pixel" actions={<Connected on={Boolean(settings.metaPixelId)} paused={locked} />}>
              <Field
                id="meta-pixel-id"
                label="Pixel ID"
                hint="Meta Events Manager → Data sources → your Pixel → Settings. Only the number, not the code."
                error={errors.metaPixelId}
              >
                <Input
                  id="meta-pixel-id"
                  inputMode="numeric"
                  placeholder="123456789012345"
                  value={draft.metaPixelId ?? ''}
                  disabled={!editable}
                  onChange={(e) => setField('metaPixelId', e.target.value)}
                />
              </Field>
            </Card>

            <Card title="Google Tag Manager" actions={<Connected on={Boolean(settings.gtmContainerId)} paused={locked} />}>
              <Field
                id="gtm-container-id"
                label="Container ID"
                hint="tagmanager.google.com → your container. It starts with GTM-."
                error={errors.gtmContainerId}
              >
                <Input
                  id="gtm-container-id"
                  placeholder="GTM-ABC1234"
                  autoCapitalize="characters"
                  value={draft.gtmContainerId ?? ''}
                  disabled={!editable}
                  onChange={(e) => setField('gtmContainerId', e.target.value)}
                />
              </Field>
            </Card>

            <Card title="Google Analytics 4" actions={<Connected on={Boolean(settings.ga4MeasurementId)} paused={locked} />}>
              <Field
                id="ga4-measurement-id"
                label="Measurement ID"
                hint="Google Analytics → Admin → Data streams → your web stream. It starts with G-. If GA4 already runs inside your Tag Manager container, leave this empty so visits are not counted twice."
                error={errors.ga4MeasurementId}
              >
                <Input
                  id="ga4-measurement-id"
                  placeholder="G-ABC123XYZ9"
                  autoCapitalize="characters"
                  value={draft.ga4MeasurementId ?? ''}
                  disabled={!editable}
                  onChange={(e) => setField('ga4MeasurementId', e.target.value)}
                />
              </Field>
            </Card>

            <Card
              title="Google Search Console"
              actions={<Connected on={Boolean(settings.googleSiteVerification)} paused={locked} />}
            >
              <div className="space-y-3">
                <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--color-muted)]">
                  <li>
                    In Search Console, add a <strong>URL prefix</strong> property for{' '}
                    <span className="break-all font-medium text-[var(--color-ink)]">{storeAddress}</span>
                  </li>
                  <li>
                    Choose <strong>HTML tag</strong> and copy the tag.
                  </li>
                  <li>Paste it below, save, then click Verify in Search Console.</li>
                </ol>
                <Field
                  id="google-site-verification"
                  label="Verification tag"
                  hint={
                    verification && !errors.googleSiteVerification && verification !== (draft.googleSiteVerification ?? '').trim()
                      ? `Code found: ${verification}`
                      : 'The whole <meta name="google-site-verification" …> tag, or just the code inside it.'
                  }
                  error={errors.googleSiteVerification}
                >
                  <Input
                    id="google-site-verification"
                    placeholder='<meta name="google-site-verification" content="…" />'
                    value={draft.googleSiteVerification ?? ''}
                    disabled={!editable}
                    onChange={(e) => setField('googleSiteVerification', e.target.value)}
                  />
                </Field>
              </div>
            </Card>

            <Card
              title="What your store sends"
              description="Sent automatically to every tag you connect, with prices in your store currency. Nothing is sent from the theme editor’s preview."
            >
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <tr>
                    <th className="py-1.5 font-medium">When a shopper…</th>
                    <th className="py-1.5 font-medium">Facebook</th>
                    <th className="py-1.5 font-medium">Google</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {EVENTS.map(([what, meta, google]) => (
                    <tr key={meta}>
                      <td className="py-1.5">{what}</td>
                      <td className="py-1.5 font-mono text-xs">{meta}</td>
                      <td className="py-1.5 font-mono text-xs">{google}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <SaveBar saving={saving} dirty={dirty} canEdit={editable} onReset={reset} />
          </form>
        ) : null}
      </SettingsGate>
    </div>
  );
}
