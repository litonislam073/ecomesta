'use client';

import { useState } from 'react';
import { Button } from '@ecomesta/ui';
import { ImageField } from '@/components/media/image-field';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';
import { mediaSrc } from '@/lib/media';

export type CategoryImageItem = { id: string; name: string; imageUrl?: string | null };

const NOTE = 'Shown on the category cards. Landscape 800 × 600 px recommended (4:3). JPEG, PNG or WebP, up to 1.5 MB.';

/**
 * Pictures on the homepage category cards. They belong to the categories
 * (not the theme draft), so a save goes live at once, in every theme.
 */
export function CategoryImagesEditor({
  storeId,
  categories,
  disabled,
  onSaved,
}: {
  storeId: string | null;
  categories: CategoryImageItem[];
  disabled?: boolean;
  /** Called with the category's new image after it is saved. */
  onSaved: (id: string, imageUrl: string | null) => void;
}) {
  const { pushToast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(category: CategoryImageItem) {
    if (!storeId) return;
    const imageUrl = value.trim() || null;
    setSaving(true);
    try {
      await api.patch(`/stores/${storeId}/categories/${category.id}`, { imageUrl });
      onSaved(category.id, imageUrl);
      setEditing(null);
      pushToast(imageUrl ? `Image saved for ${category.name}.` : `Image removed from ${category.name}.`, 'success');
    } catch (err) {
      pushToast(humanApiError(err, 'Could not save the category image'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="category-images" className="space-y-2">
      <div>
        <h3 id="category-images" className="text-sm font-medium text-[var(--color-ink)]">
          Category images
        </h3>
        <p className="text-xs text-[var(--color-muted)]">
          Saved to the category right away and shown in every theme — no need to publish.
        </p>
      </div>
      <ul className="max-h-[28rem] space-y-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-1">
        {categories.map((category) => {
          const src = mediaSrc(category.imageUrl);
          const open = editing === category.id;
          return (
            <li key={category.id} className="rounded px-2 py-1.5">
              <div className="flex items-center gap-2">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-md border border-[var(--color-border)] object-cover" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f3f7f5] text-sm font-semibold text-[var(--color-muted)]"
                  >
                    {category.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
                {!open ? (
                  <button
                    type="button"
                    disabled={disabled || !storeId}
                    aria-label={`${src ? 'Change' : 'Add'} image for ${category.name}`}
                    onClick={() => {
                      setEditing(category.id);
                      setValue(category.imageUrl ?? '');
                    }}
                    className="shrink-0 text-xs font-medium text-[var(--color-accent)] hover:underline disabled:opacity-50"
                  >
                    {src ? 'Change' : 'Add image'}
                  </button>
                ) : null}
              </div>
              {open ? (
                <div className="mt-2 space-y-3 rounded-md bg-[var(--color-bg)] p-3">
                  <ImageField
                    label={`${category.name} image`}
                    purpose="product"
                    storeId={storeId}
                    value={value}
                    onChange={setValue}
                    disabled={saving}
                    note={NOTE}
                  />
                  <div className="flex gap-2">
                    <Button type="button" disabled={saving} onClick={() => void save(category)}>
                      {saving ? 'Saving…' : 'Save image'}
                    </Button>
                    <Button type="button" variant="secondary" disabled={saving} onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
