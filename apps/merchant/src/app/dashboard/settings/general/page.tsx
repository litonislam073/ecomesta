'use client';

import { FormEvent } from 'react';
import type { StoreLanguage } from '@ecomesta/types';
import {
  Field,
  ReadOnlyNotice,
  ReadOnlyRow,
  SaveBar,
  SettingsGate,
  SettingsHeader,
  textareaClass,
} from '@/components/settings/settings-ui';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SETTINGS_LIMITS, useSettingsDraft, useStoreSettings } from '@/lib/store-settings';

const KEYS = ['name', 'description', 'defaultLanguage'] as const;

export default function GeneralSettingsPage() {
  const { storeId, settings, loading, error, reload, save, saving, canEdit } =
    useStoreSettings();
  const { draft, setField, changes, dirty, reset } = useSettingsDraft(settings, KEYS);

  const name = draft.name ?? '';
  const nameError =
    name.trim().length < 2
      ? 'Store name must be at least 2 characters.'
      : /[<>]/.test(name)
        ? 'Store name cannot contain < or >.'
        : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || !dirty || nameError) return;
    await save(changes, 'General settings saved');
  }

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="General"
        description="Your store’s name, description, language and regional defaults."
      />
      <SettingsGate storeId={storeId} loading={loading} error={error} onRetry={() => void reload()}>
        {settings ? (
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            {!canEdit ? <ReadOnlyNotice /> : null}
            <Card title="Store profile">
              <div className="grid gap-4">
                <Field
                  id="store-name"
                  label="Store name"
                  hint="Shown in the storefront header, page titles and search results."
                  error={dirty && nameError ? nameError : null}
                  counter={`${name.length}/${SETTINGS_LIMITS.name}`}
                >
                  <Input
                    id="store-name"
                    value={name}
                    maxLength={SETTINGS_LIMITS.name}
                    disabled={!canEdit}
                    onChange={(e) => setField('name', e.target.value)}
                  />
                </Field>
                <Field
                  id="store-description"
                  label="Description"
                  hint="A short summary of what you sell. Used on the storefront when no hero text is set."
                  counter={`${(draft.description ?? '').length}/${SETTINGS_LIMITS.description}`}
                >
                  <textarea
                    id="store-description"
                    className={`${textareaClass} min-h-24`}
                    value={draft.description ?? ''}
                    maxLength={SETTINGS_LIMITS.description}
                    disabled={!canEdit}
                    onChange={(e) => setField('description', e.target.value)}
                  />
                </Field>
                <Field
                  id="store-language"
                  label="Storefront language"
                  hint="Sets the language of your storefront pages for browsers, screen readers and search engines."
                >
                  <Select
                    id="store-language"
                    value={draft.defaultLanguage ?? 'en'}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setField('defaultLanguage', e.target.value as StoreLanguage)
                    }
                  >
                    <option value="en">English</option>
                    <option value="bn">বাংলা (Bangla)</option>
                  </Select>
                </Field>
              </div>
            </Card>

            <Card title="Regional defaults">
              <dl className="divide-y divide-[var(--color-border)]">
                <ReadOnlyRow label="Business" value={settings.businessName} />
                <ReadOnlyRow
                  label="Store address (slug)"
                  value={<code>{settings.slug}</code>}
                  hint="Used for your platform subdomain. It cannot be changed because existing links and domains depend on it."
                />
                <ReadOnlyRow
                  label="Currency"
                  value={settings.currency}
                  hint="Prices, orders and payments use this currency. Changing currency is not supported after a store is created."
                />
                <ReadOnlyRow
                  label="Timezone"
                  value={settings.timezone}
                  hint="Used for order dates and reports."
                />
              </dl>
            </Card>

            <SaveBar saving={saving} dirty={dirty} canEdit={canEdit} onReset={reset} />
          </form>
        ) : null}
      </SettingsGate>
    </div>
  );
}
