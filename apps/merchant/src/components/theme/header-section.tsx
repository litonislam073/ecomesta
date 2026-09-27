'use client';

import type { StoreThemeConfig, ThemeHeaderLayout } from '@ecomesta/types';
import { Card } from '@/components/ui/card';
import {
  MenuItemsField,
  SelectField,
  ToggleField,
} from '@/components/theme/theme-fields';

type Header = NonNullable<StoreThemeConfig['header']>;

const LAYOUTS: readonly ThemeHeaderLayout[] = ['classic', 'centered', 'minimal'];

export function HeaderSection({
  value,
  onChange,
  disabled,
}: {
  value: Header;
  onChange: (patch: Header) => void;
  disabled?: boolean;
}) {
  return (
    <Card title="Header" description="Layout and navigation for the storefront header.">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Header layout"
          value={value.layout ?? 'classic'}
          options={LAYOUTS}
          disabled={disabled}
          onChange={(layout) => onChange({ ...value, layout })}
        />
        <div className="space-y-3 pt-1">
          <ToggleField
            label="Sticky header"
            checked={value.sticky ?? false}
            disabled={disabled}
            onChange={(sticky) => onChange({ ...value, sticky })}
          />
          <ToggleField
            label="Show search"
            checked={value.showSearch ?? false}
            disabled={disabled}
            onChange={(showSearch) => onChange({ ...value, showSearch })}
          />
          <ToggleField
            label="Show cart"
            checked={value.showCart ?? true}
            disabled={disabled}
            onChange={(showCart) => onChange({ ...value, showCart })}
          />
        </div>
        <div className="md:col-span-2">
          <MenuItemsField
            label="Header menu"
            items={value.menuItems ?? []}
            disabled={disabled}
            onChange={(menuItems) => onChange({ ...value, menuItems })}
          />
        </div>
      </div>
    </Card>
  );
}
