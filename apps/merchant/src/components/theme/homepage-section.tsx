'use client';

import { useState } from 'react';
import type { StoreThemeConfig, ThemeSectionType } from '@ecomesta/types';
import { Card } from '@/components/ui/card';
import { TextAreaField, ToggleField } from '@/components/theme/theme-fields';
import { formatIdList, parseIdList } from '@/components/theme/theme-utils';

type Homepage = NonNullable<StoreThemeConfig['homepage']>;

const SECTION_LABELS: Record<ThemeSectionType, string> = {
  featured_categories: 'Featured categories',
  featured_products: 'Featured products',
  rich_text: 'Rich text',
  custom: 'Custom',
};

const DEFAULT_SECTION_ORDER: ThemeSectionType[] = [
  'featured_categories',
  'featured_products',
];

/**
 * Featured ids are edited as free text, so the raw buffer is kept locally and
 * only well-formed UUIDs are promoted into the draft configuration.
 */
export function HomepageSection({
  value,
  onChange,
  disabled,
}: {
  value: Homepage;
  onChange: (patch: Homepage) => void;
  disabled?: boolean;
}) {
  const [categoriesText, setCategoriesText] = useState(() =>
    formatIdList(value.featuredCategories),
  );
  const [productsText, setProductsText] = useState(() =>
    formatIdList(value.featuredProducts),
  );

  const sections = value.sections ?? [];

  function toggleSection(type: ThemeSectionType, enabled: boolean) {
    const existing = sections.find((section) => section.type === type);
    const next = existing
      ? sections.map((section) =>
          section.type === type ? { ...section, enabled } : section,
        )
      : [...sections, { type, title: SECTION_LABELS[type], enabled }];
    onChange({ ...value, sections: next });
  }

  return (
    <Card
      title="Homepage"
      description="Pick which homepage blocks render and which records they feature."
    >
      <div className="space-y-4">
        <div className="space-y-3">
          {DEFAULT_SECTION_ORDER.map((type) => (
            <ToggleField
              key={type}
              label={`Show ${SECTION_LABELS[type].toLowerCase()} section`}
              checked={
                sections.find((section) => section.type === type)?.enabled ?? false
              }
              disabled={disabled}
              onChange={(enabled) => toggleSection(type, enabled)}
            />
          ))}
        </div>

        <TextAreaField
          label="Featured category IDs"
          hint="Comma-separated UUIDs. Invalid entries are ignored on save."
          value={categoriesText}
          disabled={disabled}
          onChange={(raw) => {
            setCategoriesText(raw);
            onChange({ ...value, featuredCategories: parseIdList(raw) });
          }}
        />
        <TextAreaField
          label="Featured product IDs"
          hint="Comma-separated UUIDs. Invalid entries are ignored on save."
          value={productsText}
          disabled={disabled}
          onChange={(raw) => {
            setProductsText(raw);
            onChange({ ...value, featuredProducts: parseIdList(raw) });
          }}
        />
      </div>
    </Card>
  );
}
