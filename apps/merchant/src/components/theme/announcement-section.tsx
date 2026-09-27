'use client';

import type { StoreThemeConfig } from '@ecomesta/types';
import { Card } from '@/components/ui/card';
import {
  ColorField,
  TextField,
  ToggleField,
} from '@/components/theme/theme-fields';

type Announcement = NonNullable<StoreThemeConfig['announcement']>;

export function AnnouncementSection({
  value,
  onChange,
  disabled,
}: {
  value: Announcement;
  onChange: (patch: Announcement) => void;
  disabled?: boolean;
}) {
  return (
    <Card
      title="Announcement bar"
      description="Optional strip above the header for shipping or promo notices."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <ToggleField
            label="Show announcement bar"
            checked={value.enabled ?? false}
            disabled={disabled}
            onChange={(enabled) => onChange({ ...value, enabled })}
          />
        </div>
        <TextField
          label="Announcement text"
          className="md:col-span-2"
          value={value.text ?? ''}
          disabled={disabled}
          onChange={(text) => onChange({ ...value, text })}
        />
        <TextField
          label="Announcement link"
          hint="Optional https URL or path starting with /"
          value={value.href ?? ''}
          disabled={disabled}
          onChange={(href) => onChange({ ...value, href })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            label="Background color"
            value={value.backgroundColor}
            disabled={disabled}
            onChange={(backgroundColor) =>
              onChange({ ...value, backgroundColor })
            }
          />
          <ColorField
            label="Text color"
            value={value.textColor}
            disabled={disabled}
            onChange={(textColor) => onChange({ ...value, textColor })}
          />
        </div>
      </div>
    </Card>
  );
}
