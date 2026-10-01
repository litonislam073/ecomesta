'use client';

import type { StoreThemeConfig, ThemeBorderRadius } from '@ecomesta/types';
import { ImageField } from '@/components/media/image-field';
import { Card } from '@/components/ui/card';
import {
  ColorField,
  SelectField,
  TextField,
} from '@/components/theme/theme-fields';

type Branding = NonNullable<StoreThemeConfig['branding']>;

const BORDER_RADIUS_OPTIONS: readonly ThemeBorderRadius[] = [
  'none',
  'sm',
  'md',
  'lg',
  'full',
];

const COLOR_FIELDS: Array<[keyof Branding, string]> = [
  ['primaryColor', 'Primary color'],
  ['secondaryColor', 'Secondary color'],
  ['accentColor', 'Accent color'],
  ['backgroundColor', 'Background color'],
  ['surfaceColor', 'Surface color'],
  ['textColor', 'Text color'],
  ['mutedTextColor', 'Muted text color'],
];

export function BrandingSection({
  storeId,
  value,
  saved,
  onChange,
  disabled,
}: {
  /** Store whose gallery uploads go to; null while no store is selected. */
  storeId: string | null;
  value: Branding;
  /** Last saved branding, for color validation. */
  saved?: Branding;
  onChange: (patch: Branding) => void;
  disabled?: boolean;
}) {
  return (
    <Card
      title="Branding"
      description="Logo, name, and the palette the storefront renders with."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Brand name"
          value={value.brandName ?? ''}
          disabled={disabled}
          onChange={(brandName) => onChange({ ...value, brandName })}
        />
        <TextField
          label="Tagline"
          value={value.tagline ?? ''}
          disabled={disabled}
          onChange={(tagline) => onChange({ ...value, tagline })}
        />
        <ImageField
          label="Logo"
          purpose="logo"
          storeId={storeId}
          value={value.logoUrl ?? ''}
          disabled={disabled}
          onChange={(logoUrl) => onChange({ ...value, logoUrl })}
        />
        <ImageField
          label="Favicon"
          purpose="favicon"
          storeId={storeId}
          value={value.faviconUrl ?? ''}
          disabled={disabled}
          onChange={(faviconUrl) => onChange({ ...value, faviconUrl })}
        />
        {COLOR_FIELDS.map(([key, label]) => (
          <ColorField
            key={key}
            label={label}
            value={value[key] as string | undefined}
            saved={saved?.[key] as string | undefined}
            disabled={disabled}
            onChange={(next) => onChange({ ...value, [key]: next })}
          />
        ))}
        <SelectField
          label="Border radius"
          value={value.borderRadius ?? 'md'}
          options={BORDER_RADIUS_OPTIONS}
          disabled={disabled}
          onChange={(borderRadius) => onChange({ ...value, borderRadius })}
        />
      </div>
    </Card>
  );
}
