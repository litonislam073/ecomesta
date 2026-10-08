'use client';

import type { StoreThemeConfig } from '@ecomesta/types';
import { Card } from '@/components/ui/card';
import { NumberField, SelectField } from '@/components/theme/theme-fields';
import { THEME_FONT_OPTIONS } from '@/components/theme/theme-utils';

type Typography = NonNullable<StoreThemeConfig['typography']>;

export function TypographySection({
  value,
  onChange,
  disabled,
}: {
  value: Typography;
  onChange: (patch: Typography) => void;
  disabled?: boolean;
}) {
  return (
    <Card
      title="Typography"
      description="Font families are limited to a whitelist the storefront can load safely."
    >
      <div className="grid gap-4">
        <SelectField
          label="Heading font"
          value={value.headingFont ?? 'System'}
          options={THEME_FONT_OPTIONS}
          disabled={disabled}
          onChange={(headingFont) => onChange({ ...value, headingFont })}
        />
        <SelectField
          label="Body font"
          value={value.bodyFont ?? 'System'}
          options={THEME_FONT_OPTIONS}
          disabled={disabled}
          onChange={(bodyFont) => onChange({ ...value, bodyFont })}
        />
        <NumberField
          label="Base font size"
          hint="12–24 px"
          min={12}
          max={24}
          value={value.baseFontSize}
          disabled={disabled}
          onChange={(baseFontSize) => onChange({ ...value, baseFontSize })}
        />
        <NumberField
          label="Heading letter spacing"
          hint="-5 to 10 px"
          min={-5}
          max={10}
          step={0.5}
          value={value.headingLetterSpacing}
          disabled={disabled}
          onChange={(headingLetterSpacing) =>
            onChange({ ...value, headingLetterSpacing })
          }
        />
      </div>
    </Card>
  );
}
