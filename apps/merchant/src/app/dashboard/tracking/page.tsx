'use client';

import Link from 'next/link';
import { FormEvent, useState, type ReactNode } from 'react';
import { Field, ReadOnlyNotice, SaveBar, SettingsGate } from '@/components/settings/settings-ui';
import { Input } from '@/components/ui/input';
import { useSettingsDraft, useStoreSettings, useStoreSettingsSummary } from '@/lib/store-settings';
import { storefrontUrl } from '@/lib/storefront-url';
import { TRACKING_PATTERNS, verificationCode } from '@/lib/tracking-ids';
import { useSubscription } from '@/lib/subscription-context';

const KEYS = ['metaPixelId', 'gtmContainerId', 'ga4MeasurementId', 'googleSiteVerification'] as const;
type TrackingKey = (typeof KEYS)[number];

const { pixel: PIXEL, gtm: GTM, ga4: GA4, verification: VERIFICATION } = TRACKING_PATTERNS;

/* Simple brand marks (shapes in each product's colour). */
const ICONS: Record<TrackingKey, { bg: string; svg: ReactNode }> = {
  metaPixelId: {
    bg: '#0866FF',
    svg: <path d="M4 15.5c0-4 2-7.5 4.3-7.5 3 0 4.4 6.6 7.4 6.6 1.2 0 2.3-1 2.3-3.1 0-2.7-1.4-5-3.2-5-2.4 0-4 4.6-6.2 8.4C7.4 17 6.2 18 5.3 18 4.5 18 4 17 4 15.5z" />,
  },
  gtmContainerId: {
    bg: '#246FDB',
    svg: <path d="M12 3l9 9-9 9-9-9 9-9zm0 5l-4 4 4 4 4-4-4-4z" />,
  },
  ga4MeasurementId: {
    bg: '#E37400',
    svg: <path d="M15 4h4v16h-4zM9.5 10h4v10h-4zM5 16.5a2 2 0 1 1 0 .01z" />,
  },
  googleSiteVerification: {
    bg: '#4285F4',
    svg: <path d="M10.5 4a6.5 6.5 0 0 1 5.2 10.4l4.3 4.3-1.4 1.4-4.3-4.3A6.5 6.5 0 1 1 10.5 4zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" />,
  },
};

function BrandIcon({ k, size = 'md' }: { k: TrackingKey; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-7 w-7 rounded-lg' : 'h-11 w-11 rounded-xl';
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center text-white shadow-sm ${box}`} style={{ backgroundColor: ICONS[k].bg }}>
      <svg viewBox="0 0 24 24" className={size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'} fill="currentColor">
        {ICONS[k].svg}
      </svg>
    </span>
  );
}

function StatusPill({ on, paused }: { on: boolean; paused?: boolean }) {
  if (on && paused) {
    return <span className="rounded-full bg-[#fff3d6] px-2.5 py-1 text-xs font-semibold text-[#8a5a00]">Paused (upgrade)</span>;
  }
  return on ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#e3f1ec] px-2.5 py-1 text-xs font-semibold text-[#1b6b53]">
      <span aria-hidden="true">●</span>
      <span>Connected</span>
    </span>
  ) : (
    <span className="rounded-full bg-[#f1f4f7] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]">Not set up</span>
  );
}

function Guide({ steps, link }: { steps: ReactNode[]; link: { href: string; label: string } }) {
  return (
    <details className="group rounded-lg bg-[#f6f8f7] px-3 py-2 text-sm">
      <summary className="cursor-pointer list-none font-medium text-[var(--color-accent)] marker:hidden">
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">›</span> Where do I find it?
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-[var(--color-muted)]">
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 font-medium text-[var(--color-accent)] hover:underline"
      >
        {link.label} <span aria-hidden="true">↗</span>
      </a>
    </details>
  );
}

function IntegrationCard({
  k,
  title,
  benefit,
  saved,
  paused,
  canRemove,
  onRemove,
  children,
}: {
  k: TrackingKey;
  title: string;
  benefit: string;
  saved: boolean;
  paused: boolean;
  canRemove: boolean;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`flex flex-col gap-4 rounded-2xl border bg-[var(--color-surface)] p-5 shadow-sm transition-shadow hover:shadow-md ${
        saved && !paused ? 'border-[#bfe0d3]' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <BrandIcon k={k} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">{title}</h2>
            <StatusPill on={saved} paused={paused} />
          </div>
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">{benefit}</p>
        </div>
      </div>
      {children}
      {saved && canRemove ? (
        <button type="button" onClick={onRemove} className="self-start text-xs font-medium text-[#b42318] hover:underline">
          Remove {title}
        </button>
      ) : null}
    </section>
  );
}

const FUNNEL: { what: string; meta: string; google: string; icon: string }[] = [
  { what: 'Visits a page', meta: 'PageView', google: 'page_view', icon: 'M3 5h18v14H3zM3 9h18' },
  { what: 'Views a product', meta: 'ViewContent', google: 'view_item', icon: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  { what: 'Adds to cart', meta: 'AddToCart', google: 'add_to_cart', icon: 'M3 4h2l2.4 11h10.2L20 7H6.2M9 20h.01M17 20h.01' },
  { what: 'Starts checkout', meta: 'InitiateCheckout', google: 'begin_checkout', icon: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3' },
  { what: 'Places an order', meta: 'Purchase', google: 'purchase', icon: 'M5 12l5 5L20 7' },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => setCopied(false));
      }}
      className="shrink-0 rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-medium hover:bg-[#f4f7f5]"
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  );
}

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
  const connected = settings ? KEYS.filter((key) => Boolean(settings[key])) : [];
  const hasSaved = connected.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with progress */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f3d30] via-[#145240] to-[#1b6b53] p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Marketing &amp; tracking</h1>
            <p className="mt-2 text-white/80">
              Connect Facebook Pixel, Google Tag Manager, Google Analytics and Search Console. Paste the ID — your store adds
              the code and sends shopping events for you.
            </p>
          </div>
          {settings ? (
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-sm font-semibold">
                {connected.length} of {KEYS.length} connected
              </p>
              <div className="mt-2 flex gap-1.5">
                {KEYS.map((key) => (
                  <span key={key} className={connected.includes(key) ? '' : 'opacity-30 grayscale'}>
                    <BrandIcon k={key} size="sm" />
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <SettingsGate storeId={storeId} loading={loading} error={error} onRetry={() => void reload()}>
        {settings ? (
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            {!canEdit ? <ReadOnlyNotice /> : null}
            {locked ? (
              <div role="status" className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#f2d9a6] bg-[#fff8e8] px-5 py-4 text-sm text-[#7a5300]">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffe9b8] text-lg">
                  🔒
                </span>
                <div className="min-w-0 flex-1">
                  <p>
                    <strong>Marketing &amp; tracking</strong> is available on the <strong>Growth</strong> and{' '}
                    <strong>Business</strong> plans.
                  </p>
                  {hasSaved ? (
                    <p className="mt-0.5 text-xs">Your saved IDs are kept but not used on your store until you upgrade.</p>
                  ) : null}
                </div>
                <Link
                  href="/dashboard/billing"
                  className="rounded-lg bg-[#8a5a00] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                >
                  Upgrade in Plan &amp; billing →
                </Link>
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-2">
              <IntegrationCard
                k="metaPixelId"
                title="Facebook (Meta) Pixel"
                benefit="Measure Facebook & Instagram ads and build audiences from your visitors."
                saved={Boolean(settings.metaPixelId)}
                paused={locked}
                canRemove={editable}
                onRemove={() => setField('metaPixelId', '')}
              >
                <Field id="meta-pixel-id" label="Pixel ID" error={errors.metaPixelId}>
                  <Input
                    id="meta-pixel-id"
                    inputMode="numeric"
                    placeholder="123456789012345"
                    value={draft.metaPixelId ?? ''}
                    disabled={!editable}
                    onChange={(e) => setField('metaPixelId', e.target.value)}
                  />
                </Field>
                <Guide
                  steps={['Open Meta Events Manager.', 'Choose Data sources → your Pixel.', 'Copy the number under the Pixel name (only the number, not the code).']}
                  link={{ href: 'https://business.facebook.com/events_manager2', label: 'Open Events Manager' }}
                />
              </IntegrationCard>

              <IntegrationCard
                k="gtmContainerId"
                title="Google Tag Manager"
                benefit="Manage all your marketing tags in one place, without code changes."
                saved={Boolean(settings.gtmContainerId)}
                paused={locked}
                canRemove={editable}
                onRemove={() => setField('gtmContainerId', '')}
              >
                <Field id="gtm-container-id" label="Container ID" error={errors.gtmContainerId}>
                  <Input
                    id="gtm-container-id"
                    placeholder="GTM-ABC1234"
                    autoCapitalize="characters"
                    value={draft.gtmContainerId ?? ''}
                    disabled={!editable}
                    onChange={(e) => setField('gtmContainerId', e.target.value)}
                  />
                </Field>
                <Guide
                  steps={['Open Tag Manager and pick your container.', 'The ID is at the top of the page and starts with GTM-.']}
                  link={{ href: 'https://tagmanager.google.com/', label: 'Open Tag Manager' }}
                />
              </IntegrationCard>

              <IntegrationCard
                k="ga4MeasurementId"
                title="Google Analytics 4"
                benefit="See visitors, sales and where they come from."
                saved={Boolean(settings.ga4MeasurementId)}
                paused={locked}
                canRemove={editable}
                onRemove={() => setField('ga4MeasurementId', '')}
              >
                <Field id="ga4-measurement-id" label="Measurement ID" error={errors.ga4MeasurementId}>
                  <Input
                    id="ga4-measurement-id"
                    placeholder="G-ABC123XYZ9"
                    autoCapitalize="characters"
                    value={draft.ga4MeasurementId ?? ''}
                    disabled={!editable}
                    onChange={(e) => setField('ga4MeasurementId', e.target.value)}
                  />
                </Field>
                <Guide
                  steps={[
                    'In Google Analytics open Admin → Data streams.',
                    'Choose your web stream and copy the Measurement ID (starts with G-).',
                    'Already have GA4 inside Tag Manager? Leave this empty so visits are not counted twice.',
                  ]}
                  link={{ href: 'https://analytics.google.com/', label: 'Open Google Analytics' }}
                />
              </IntegrationCard>

              <IntegrationCard
                k="googleSiteVerification"
                title="Google Search Console"
                benefit="Prove you own the store so it can show up in Google search."
                saved={Boolean(settings.googleSiteVerification)}
                paused={locked}
                canRemove={editable}
                onRemove={() => setField('googleSiteVerification', '')}
              >
                <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--color-muted)]">Your store address</p>
                    <span className="block truncate text-sm font-medium text-[var(--color-ink)]">{storeAddress}</span>
                  </div>
                  {storeAddress ? <CopyButton value={storeAddress} /> : null}
                </div>
                <Field
                  id="google-site-verification"
                  label="Verification tag"
                  hint={
                    verification && !errors.googleSiteVerification && verification !== (draft.googleSiteVerification ?? '').trim()
                      ? `Code found: ${verification}`
                      : 'Paste the whole meta tag — we take the code out of it.'
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
                <Guide
                  steps={[
                    <>
                      In Search Console, add a <strong>URL prefix</strong> property with your store address.
                    </>,
                    <>
                      Choose <strong>HTML tag</strong> and copy the tag.
                    </>,
                    'Paste it here, save, then click Verify in Search Console.',
                  ]}
                  link={{ href: 'https://search.google.com/search-console', label: 'Open Search Console' }}
                />
              </IntegrationCard>
            </div>

            <section aria-labelledby="tracking-events" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
              <h2 id="tracking-events" className="text-base font-semibold">What your store sends</h2>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                Sent automatically to every tag you connect, with prices in your store currency. Nothing is sent from the theme
                editor’s preview.
              </p>
              <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {FUNNEL.map((step, index) => (
                  <li key={step.meta} className="relative rounded-xl bg-[#f6f8f7] p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[var(--color-accent)] shadow-sm">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d={step.icon} />
                        </svg>
                      </span>
                      <span className="text-xs font-semibold text-[var(--color-muted)]">Step {index + 1}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-ink)]">{step.what}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded bg-[#e8f0ff] px-1.5 py-0.5 font-mono text-[11px] text-[#0b4fc4]" title="Facebook event">
                        {step.meta}
                      </span>
                      <span className="rounded bg-[#fff1e3] px-1.5 py-0.5 font-mono text-[11px] text-[#a35400]" title="Google event">
                        {step.google}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#0b4fc4] align-middle" /> Facebook
                </span>
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#a35400] align-middle" /> Google (Analytics &amp; Tag Manager)
                </span>
                <span>🔐 Only IDs are saved — no scripts.</span>
              </p>
            </section>

            <SaveBar saving={saving} dirty={dirty} canEdit={editable} onReset={reset} />
          </form>
        ) : null}
      </SettingsGate>
    </div>
  );
}
