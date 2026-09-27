'use client';

import type { StoreThemeConfig, ThemeHeroAlignment } from '@ecomesta/types';
import { Card } from '@/components/ui/card';
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  ToggleField,
} from '@/components/theme/theme-fields';

type Hero = NonNullable<StoreThemeConfig['hero']>;

const ALIGNMENTS: readonly ThemeHeroAlignment[] = ['left', 'center', 'right'];

export function HeroSection({
  value,
  onChange,
  disabled,
}: {
  value: Hero;
  onChange: (patch: Hero) => void;
  disabled?: boolean;
}) {
  return (
    <Card title="Hero" description="The banner at the top of the storefront homepage.">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <ToggleField
            label="Show hero"
            checked={value.enabled ?? false}
            disabled={disabled}
            onChange={(enabled) => onChange({ ...value, enabled })}
          />
        </div>
        <TextField
          label="Headline"
          className="md:col-span-2"
          value={value.headline ?? ''}
          disabled={disabled}
          onChange={(headline) => onChange({ ...value, headline })}
        />
        <TextAreaField
          label="Subheadline"
          className="md:col-span-2"
          value={value.subheadline ?? ''}
          disabled={disabled}
          onChange={(subheadline) => onChange({ ...value, subheadline })}
        />
        <TextField
          label="CTA label"
          value={value.ctaLabel ?? ''}
          disabled={disabled}
          onChange={(ctaLabel) => onChange({ ...value, ctaLabel })}
        />
        <TextField
          label="CTA link"
          hint="https URL or path starting with /"
          value={value.ctaHref ?? ''}
          disabled={disabled}
          onChange={(ctaHref) => onChange({ ...value, ctaHref })}
        />
        <TextField
          label="Background image URL"
          value={value.imageUrl ?? ''}
          disabled={disabled}
          onChange={(imageUrl) => onChange({ ...value, imageUrl })}
        />
        <SelectField
          label="Alignment"
          value={value.alignment ?? 'left'}
          options={ALIGNMENTS}
          disabled={disabled}
          onChange={(alignment) => onChange({ ...value, alignment })}
        />
        <NumberField
          label="Overlay opacity"
          hint="0 to 1"
          min={0}
          max={1}
          step={0.05}
          value={value.overlayOpacity}
          disabled={disabled}
          onChange={(overlayOpacity) => onChange({ ...value, overlayOpacity })}
        />
      </div>
    </Card>
  );
}
