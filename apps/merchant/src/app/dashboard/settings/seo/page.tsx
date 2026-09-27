'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  Field,
  ReadOnlyNotice,
  ReadOnlyRow,
  SaveBar,
  SettingsGate,
  SettingsHeader,
  ToggleRow,
  textareaClass,
} from '@/components/settings/settings-ui';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  SEO_DESCRIPTION_RANGE,
  SEO_TITLE_RANGE,
  SETTINGS_LIMITS,
  lengthWarning,
  parseKeywordList,
  useSettingsDraft,
  useStoreSettings,
  useStoreSettingsSummary,
} from '@/lib/store-settings';

const KEYS = [
  'seoTitle',
  'seoDescription',
  'seoKeywords',
  'ogTitle',
  'ogDescription',
  'ogImageUrl',
  'seoIndexingEnabled',
] as const;

const MARKUP = /[<>]/;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export default function SeoSettingsPage() {
  const { storeId, settings, loading, error, reload, save, saving, canEdit } =
    useStoreSettings();
  const { summary } = useStoreSettingsSummary();
  const { draft, setField, changes, dirty, reset } = useSettingsDraft(settings, KEYS);
  const [keywordText, setKeywordText] = useState('');

  useEffect(() => {
    setKeywordText((settings?.seoKeywords ?? []).join(', '));
  }, [settings]);

  const title = draft.seoTitle ?? '';
  const description = draft.seoDescription ?? '';
  const ogImageUrl = (draft.ogImageUrl ?? '').trim();
  const keywords = draft.seoKeywords ?? [];

  const errors = {
    seoTitle: MARKUP.test(title) ? 'Use plain text only (no < or >).' : null,
    seoDescription: MARKUP.test(description) ? 'Use plain text only (no < or >).' : null,
    ogTitle: MARKUP.test(draft.ogTitle ?? '') ? 'Use plain text only (no < or >).' : null,
    ogDescription: MARKUP.test(draft.ogDescription ?? '')
      ? 'Use plain text only (no < or >).'
      : null,
    ogImageUrl:
      ogImageUrl && !isHttpUrl(ogImageUrl)
        ? 'Enter a full image address starting with https://'
        : null,
    seoKeywords:
      keywords.length > SETTINGS_LIMITS.seoKeywords
        ? `Use at most ${SETTINGS_LIMITS.seoKeywords} keywords.`
        : keywords.some((k) => k.length > SETTINGS_LIMITS.seoKeyword)
          ? `Each keyword can be at most ${SETTINGS_LIMITS.seoKeyword} characters.`
          : keywords.some((k) => MARKUP.test(k))
            ? 'Use plain text only (no < or >).'
            : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || !dirty || hasErrors) return;
    await save(changes, 'SEO settings saved');
  }

  const previewTitle = title.trim() || settings?.name || 'Your store';
  const previewDescription =
    description.trim() || settings?.description || 'Add a description to control how your store appears in search results.';
  const canonical = summary?.domains.primaryHostname
    ? `https://${summary.domains.primaryHostname}/`
    : null;

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="SEO"
        description="Control how your storefront appears in search engines and when shared on social media."
      />
      <SettingsGate storeId={storeId} loading={loading} error={error} onRetry={() => void reload()}>
        {settings ? (
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            {!canEdit ? <ReadOnlyNotice /> : null}

            <Card title="Search engine listing">
              <div className="grid gap-4">
                <Field
                  id="seo-title"
                  label="Page title"
                  hint="Leave blank to use your store name."
                  counter={`${title.length}/${SEO_TITLE_RANGE.max}`}
                  warning={lengthWarning(title, SEO_TITLE_RANGE, 'title')}
                  error={errors.seoTitle}
                >
                  <Input
                    id="seo-title"
                    value={title}
                    maxLength={SETTINGS_LIMITS.seoTitle}
                    disabled={!canEdit}
                    onChange={(e) => setField('seoTitle', e.target.value)}
                  />
                </Field>
                <Field
                  id="seo-description"
                  label="Meta description"
                  counter={`${description.length}/${SEO_DESCRIPTION_RANGE.max}`}
                  warning={lengthWarning(description, SEO_DESCRIPTION_RANGE, 'description')}
                  error={errors.seoDescription}
                >
                  <textarea
                    id="seo-description"
                    className={`${textareaClass} min-h-20`}
                    value={description}
                    maxLength={SETTINGS_LIMITS.seoDescription}
                    disabled={!canEdit}
                    onChange={(e) => setField('seoDescription', e.target.value)}
                  />
                </Field>
                <Field
                  id="seo-keywords"
                  label="Keywords"
                  hint={`Comma-separated, up to ${SETTINGS_LIMITS.seoKeywords}.`}
                  error={errors.seoKeywords}
                >
                  <Input
                    id="seo-keywords"
                    value={keywordText}
                    disabled={!canEdit}
                    onChange={(e) => {
                      setKeywordText(e.target.value);
                      setField('seoKeywords', parseKeywordList(e.target.value));
                    }}
                  />
                </Field>

                <div aria-label="Search result preview" role="region" className="rounded-md border border-[var(--color-border)] p-3">
                  <p className="text-xs text-[var(--color-muted)]">Search result preview</p>
                  <p className="mt-1 truncate text-base text-[#1a0dab]">{previewTitle}</p>
                  {canonical ? <p className="truncate text-xs text-[#006621]">{canonical}</p> : null}
                  <p className="line-clamp-2 text-sm text-[var(--color-muted)]">{previewDescription}</p>
                </div>
              </div>
            </Card>

            <Card title="Social sharing" description="Used when your storefront link is shared on Facebook, WhatsApp and other apps.">
              <div className="grid gap-4">
                <Field id="og-title" label="Share title" hint="Leave blank to use the page title." error={errors.ogTitle}>
                  <Input
                    id="og-title"
                    value={draft.ogTitle ?? ''}
                    maxLength={SETTINGS_LIMITS.ogTitle}
                    disabled={!canEdit}
                    onChange={(e) => setField('ogTitle', e.target.value)}
                  />
                </Field>
                <Field
                  id="og-description"
                  label="Share description"
                  hint="Leave blank to use the meta description."
                  error={errors.ogDescription}
                >
                  <textarea
                    id="og-description"
                    className={`${textareaClass} min-h-20`}
                    value={draft.ogDescription ?? ''}
                    maxLength={SETTINGS_LIMITS.ogDescription}
                    disabled={!canEdit}
                    onChange={(e) => setField('ogDescription', e.target.value)}
                  />
                </Field>
                <Field
                  id="og-image"
                  label="Share image URL"
                  hint="A 1200×630 image works best. Leave blank to use your logo."
                  error={errors.ogImageUrl}
                >
                  <Input
                    id="og-image"
                    type="url"
                    inputMode="url"
                    value={draft.ogImageUrl ?? ''}
                    maxLength={SETTINGS_LIMITS.ogImageUrl}
                    disabled={!canEdit}
                    onChange={(e) => setField('ogImageUrl', e.target.value)}
                  />
                </Field>
              </div>
            </Card>

            <Card title="Search engine visibility">
              <ToggleRow
                id="seo-indexing"
                label="Allow search engines to index this store"
                description="Turn off while you set up your store. Search engines are asked not to show your pages."
                checked={Boolean(draft.seoIndexingEnabled)}
                disabled={!canEdit}
                onChange={(v) => setField('seoIndexingEnabled', v)}
              />
              <dl className="mt-2 border-t border-[var(--color-border)] pt-2">
                <ReadOnlyRow
                  label="Canonical address"
                  value={canonical ?? 'Set automatically from your primary domain'}
                  hint="Managed from Domains. Pages point search engines to this address."
                />
              </dl>
            </Card>

            <SaveBar saving={saving} dirty={dirty} canEdit={canEdit} onReset={() => {
              reset();
              setKeywordText((settings.seoKeywords ?? []).join(', '));
            }} />
          </form>
        ) : null}
      </SettingsGate>
    </div>
  );
}
