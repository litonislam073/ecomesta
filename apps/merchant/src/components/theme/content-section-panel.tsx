'use client';

import type { StoreThemeConfig, ThemeHomepageSection } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { ImageField } from '@/components/media/image-field';
import { Card } from '@/components/ui/card';
import { TextAreaField, TextField, ToggleField } from '@/components/theme/theme-fields';
import {
  CONTENT_SECTIONS,
  effectiveHomeSections,
  sectionKey,
  type ContentSectionType,
} from '@/components/theme/homepage-block-panel';

type Homepage = NonNullable<StoreThemeConfig['homepage']>;

/** Settings of one rich text or image banner section (there may be several). */
export function ContentSectionPanel({
  sectionId,
  storeId,
  value,
  onChange,
  onRemove,
  disabled,
}: {
  /** `section:<id>` as in the sections list. */
  sectionId: string;
  storeId: string | null;
  value: Homepage;
  onChange: (next: Homepage) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const sections = effectiveHomeSections(value);
  const index = sections.findIndex((section, i) => sectionKey(section, i) === sectionId);
  const section = sections[index];
  if (!section) return null;
  const type = section.type as ContentSectionType;
  const meta = CONTENT_SECTIONS[type];

  function patch(next: Partial<ThemeHomepageSection>) {
    onChange({ ...value, sections: sections.map((item, i) => (i === index ? { ...item, ...next } : item)) });
  }

  return (
    <Card title={meta.label} description={meta.description}>
      <div className="grid gap-4">
        <ToggleField
          label="Show this section"
          checked={section.enabled !== false}
          disabled={disabled}
          onChange={(enabled) => patch({ enabled })}
        />
        {type === 'image_banner' ? (
          <ImageField
            label="Image"
            purpose="background"
            previewShape="wide"
            storeId={storeId}
            value={section.imageUrl ?? ''}
            disabled={disabled}
            onChange={(imageUrl) => patch({ imageUrl })}
          />
        ) : null}
        <TextField
          label="Heading"
          value={section.title ?? ''}
          disabled={disabled}
          onChange={(title) => patch({ title })}
        />
        <TextAreaField
          label="Text"
          rows={4}
          value={section.text ?? ''}
          disabled={disabled}
          hint="Plain text. Line breaks are kept."
          onChange={(text) => patch({ text })}
        />
        <TextField
          label="Button label"
          value={section.buttonLabel ?? ''}
          placeholder="e.g. Shop now"
          disabled={disabled}
          onChange={(buttonLabel) => patch({ buttonLabel })}
        />
        <TextField
          label="Button link"
          value={section.buttonHref ?? ''}
          placeholder="/products"
          hint="https URL or path starting with /. The button shows when both are filled."
          disabled={disabled}
          onChange={(buttonHref) => patch({ buttonHref })}
        />
        {!disabled ? (
          <Button variant="danger" onClick={onRemove}>
            Remove section
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
