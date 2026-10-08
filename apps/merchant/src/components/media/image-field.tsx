'use client';

import { useId, useRef, useState } from 'react';
import type { MediaPurpose } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { MediaPickerDialog } from '@/components/media/media-picker-dialog';
import { TextField } from '@/components/theme/theme-fields';
import { humanApiError } from '@/lib/catalog-utils';
import { IMAGE_GUIDES, MEDIA_ACCEPT, mediaFileProblem, mediaSrc, uploadMedia } from '@/lib/media';

/**
 * An image setting (logo, favicon, banner background…). The merchant uploads a
 * file or picks one from the store's gallery; every upload is kept in the
 * gallery. The URL stays editable for images hosted elsewhere.
 */
export function ImageField({
  label,
  purpose,
  storeId,
  value,
  onChange,
  disabled,
  note,
  previewShape = 'square',
}: {
  label: string;
  purpose: MediaPurpose;
  storeId: string | null;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  /** Size guidance; defaults to the guide for `purpose`. */
  note?: string;
  previewShape?: 'square' | 'wide';
}) {
  const noteId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = mediaSrc(value.trim() || null);
  const canUpload = Boolean(storeId) && !disabled;

  async function onFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = '';
    if (!file || uploading || !storeId) return;
    const problem = mediaFileProblem(file);
    setError(problem);
    if (problem) return;
    setUploading(true);
    try {
      const result = await uploadMedia(storeId, file, purpose);
      onChange(result.data.url);
    } catch (err) {
      setError(humanApiError(err, 'Could not upload the image.'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2" role="group" aria-labelledby={`${noteId}-label`}>
      <p id={`${noteId}-label`} className="text-sm font-medium">
        {label}
      </p>
      <p id={noteId} className="text-xs text-[var(--color-muted)]">
        {note ?? IMAGE_GUIDES[purpose].note}
      </p>
      <div className="flex flex-col gap-3">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--color-border)] bg-[#f3f7f5] ${
            previewShape === 'wide' ? 'aspect-[12/5] w-full' : 'aspect-square w-24'
          }`}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={`${label} preview`} className="h-full w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-xs text-[var(--color-muted)]">No image</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={MEDIA_ACCEPT}
            className="sr-only"
            aria-label={`Upload ${label.toLowerCase()}`}
            aria-describedby={noteId}
            disabled={!canUpload || uploading}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!canUpload || uploading}
              aria-busy={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? 'Uploading…' : src ? 'Upload new' : 'Upload'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!canUpload || uploading}
              onClick={() => setPickerOpen(true)}
            >
              Choose from gallery
            </Button>
            {value ? (
              <Button
                type="button"
                variant="secondary"
                disabled={disabled || uploading}
                onClick={() => {
                  setError(null);
                  onChange('');
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
          {error ? (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <TextField
            label={`${label} URL`}
            hint="Filled in for you when you upload or choose an image. You can also paste an https URL."
            value={value}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      </div>
      {storeId ? (
        <MediaPickerDialog
          open={pickerOpen}
          storeId={storeId}
          purpose={purpose}
          onClose={() => setPickerOpen(false)}
          onSelect={(item) => {
            setPickerOpen(false);
            setError(null);
            onChange(item.url);
          }}
        />
      ) : null}
    </div>
  );
}
