'use client';

import { useState } from 'react';
import type {
  StoreThemeConfig,
  ThemeSocialLink,
  ThemeSocialNetwork,
} from '@ecomesta/types';
import { Card } from '@/components/ui/card';
import {
  MenuItemsField,
  TextAreaField,
  TextField,
  ToggleField,
} from '@/components/theme/theme-fields';

type Footer = NonNullable<StoreThemeConfig['footer']>;

const SOCIAL_NETWORKS: readonly ThemeSocialNetwork[] = [
  'facebook',
  'instagram',
  'twitter',
  'x',
  'youtube',
  'tiktok',
  'linkedin',
  'other',
];

function parseSocialLinks(raw: string): ThemeSocialLink[] {
  return raw
    .split('\n')
    .map((line) => {
      const [network, url] = line.split('|');
      return {
        network: (network ?? '').trim().toLowerCase(),
        url: (url ?? '').trim(),
      };
    })
    .filter(
      (entry): entry is { network: ThemeSocialNetwork; url: string } =>
        entry.url !== '' &&
        SOCIAL_NETWORKS.includes(entry.network as ThemeSocialNetwork),
    );
}

export function FooterSection({
  value,
  onChange,
  disabled,
}: {
  value: Footer;
  onChange: (patch: Footer) => void;
  disabled?: boolean;
}) {
  // Raw text stays as typed; incomplete lines are only dropped from the parsed
  // links, never from the textarea. Remounted (via `key`) when a new config loads.
  const [socialText, setSocialText] = useState(() =>
    (value.socialLinks ?? []).map((link) => `${link.network} | ${link.url}`).join('\n'),
  );
  return (
    <Card title="Footer" description="Footer copy, links, and social profiles.">
      <div className="grid gap-4">
        <TextField
          label="Footer tagline"
          value={value.tagline ?? ''}
          disabled={disabled}
          onChange={(tagline) => onChange({ ...value, tagline })}
        />
        <TextField
          label="Copyright"
          hint="Leave blank to fall back to the store name."
          value={value.copyright ?? ''}
          disabled={disabled}
          onChange={(copyright) => onChange({ ...value, copyright })}
        />
        <div>
          <ToggleField
            label="Show payment icons"
            checked={value.showPaymentIcons ?? false}
            disabled={disabled}
            onChange={(showPaymentIcons) =>
              onChange({ ...value, showPaymentIcons })
            }
          />
        </div>
        <div>
          <MenuItemsField
            label="Footer menu"
            items={value.menuItems ?? []}
            disabled={disabled}
            onChange={(menuItems) => onChange({ ...value, menuItems })}
          />
        </div>
        <div>
          <TextAreaField
            label="Social links"
            hint={`One per line as "network | https://…". Networks: ${SOCIAL_NETWORKS.join(', ')}.`}
            rows={4}
            value={socialText}
            disabled={disabled}
            onChange={(raw) => {
              setSocialText(raw);
              onChange({ ...value, socialLinks: parseSocialLinks(raw) });
            }}
          />
        </div>
      </div>
    </Card>
  );
}
