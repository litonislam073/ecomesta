'use client';

import { FormEvent } from 'react';
import Link from 'next/link';
import {
  Field,
  ReadOnlyNotice,
  SaveBar,
  SettingsGate,
  SettingsHeader,
  textareaClass,
} from '@/components/settings/settings-ui';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SETTINGS_LIMITS, useSettingsDraft, useStoreSettings } from '@/lib/store-settings';

const KEYS = ['email', 'phone', 'address'] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s\-()]{5,38}$/;

export default function StoreDetailsSettingsPage() {
  const { storeId, settings, loading, error, reload, save, saving, canEdit } =
    useStoreSettings();
  const { draft, setField, changes, dirty, reset } = useSettingsDraft(settings, KEYS);

  const email = (draft.email ?? '').trim();
  const phone = (draft.phone ?? '').trim();
  const emailError = email && !EMAIL_PATTERN.test(email) ? 'Enter a valid email address.' : null;
  const phoneError =
    phone && !PHONE_PATTERN.test(phone)
      ? 'Enter a valid phone number, for example +8801XXXXXXXXX.'
      : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || !dirty || emailError || phoneError) return;
    await save(changes, 'Store details saved');
  }

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Store details"
        description="How customers can reach you. Filled-in details appear in your storefront footer."
      />
      <SettingsGate storeId={storeId} loading={loading} error={error} onRetry={() => void reload()}>
        {settings ? (
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            {!canEdit ? <ReadOnlyNotice /> : null}
            <Card title="Contact information">
              <div className="grid gap-4">
                <Field
                  id="store-email"
                  label="Support email"
                  hint="Leave blank to hide it from the storefront."
                  error={emailError}
                >
                  <Input
                    id="store-email"
                    type="email"
                    autoComplete="email"
                    value={draft.email ?? ''}
                    maxLength={SETTINGS_LIMITS.email}
                    disabled={!canEdit}
                    onChange={(e) => setField('email', e.target.value)}
                  />
                </Field>
                <Field
                  id="store-phone"
                  label="Support phone"
                  hint="Include the country code, for example +8801XXXXXXXXX."
                  error={phoneError}
                >
                  <Input
                    id="store-phone"
                    type="tel"
                    autoComplete="tel"
                    value={draft.phone ?? ''}
                    maxLength={SETTINGS_LIMITS.phone}
                    disabled={!canEdit}
                    onChange={(e) => setField('phone', e.target.value)}
                  />
                </Field>
                <Field
                  id="store-address"
                  label="Business address"
                  counter={`${(draft.address ?? '').length}/${SETTINGS_LIMITS.address}`}
                >
                  <textarea
                    id="store-address"
                    className={`${textareaClass} min-h-20`}
                    value={draft.address ?? ''}
                    maxLength={SETTINGS_LIMITS.address}
                    disabled={!canEdit}
                    onChange={(e) => setField('address', e.target.value)}
                  />
                </Field>
              </div>
            </Card>

            <Card title="Logo and favicon">
              <p className="text-sm text-[var(--color-muted)]">
                Your logo, favicon and colours are part of your theme.{' '}
                <Link href="/dashboard/theme" className="font-medium text-[var(--color-accent)] hover:underline">
                  Edit branding in Theme
                </Link>
              </p>
            </Card>

            <SaveBar saving={saving} dirty={dirty} canEdit={canEdit} onReset={reset} />
          </form>
        ) : null}
      </SettingsGate>
    </div>
  );
}
