'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaItem, MediaPurpose } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { humanApiError } from '@/lib/catalog-utils';
import {
  IMAGE_GUIDES,
  MEDIA_ACCEPT,
  formatDimensions,
  listMedia,
  mediaFileProblem,
  mediaSrc,
  uploadMedia,
} from '@/lib/media';

const PAGE_SIZE = 24;

/** Why a gallery image cannot be used for `purpose`, mirroring the upload checks. */
export function pickProblem(item: MediaItem, purpose: MediaPurpose): string | null {
  if (purpose === 'favicon' && (!item.width || item.width !== item.height)) {
    return 'Not square';
  }
  return null;
}

/**
 * Lets the merchant pick an image from the store's gallery, or upload a new
 * one (which lands in the gallery and is picked straight away).
 */
export function MediaPickerDialog({
  open,
  storeId,
  purpose = 'general',
  title,
  onSelect,
  onClose,
}: {
  open: boolean;
  storeId: string;
  purpose?: MediaPurpose;
  title?: string;
  onSelect: (item: MediaItem) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guide = IMAGE_GUIDES[purpose];

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listMedia(storeId, nextPage, PAGE_SIZE);
        setItems((prev) => (nextPage === 1 ? result.data.items : [...prev, ...result.data.items]));
        setPage(result.data.meta.page);
        setTotalPages(result.data.meta.totalPages);
      } catch (err) {
        setError(humanApiError(err, 'Could not load your gallery.'));
      } finally {
        setLoading(false);
      }
    },
    [storeId],
  );

  useEffect(() => {
    if (open) void load(1);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>('[data-dialog-close]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open]);

  async function onFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = '';
    if (!file || uploading) return;
    const problem = mediaFileProblem(file);
    setError(problem);
    if (problem) return;
    setUploading(true);
    try {
      const result = await uploadMedia(storeId, file, purpose);
      onSelect(result.data);
    } catch (err) {
      setError(humanApiError(err, 'Could not upload the image.'));
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-picker-title"
    >
      <div
        ref={panelRef}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
          <div className="min-w-0">
            <h2 id="media-picker-title" className="text-lg font-semibold">
              {title ?? `Choose ${guide.title.toLowerCase()} from gallery`}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{guide.note}</p>
          </div>
          <Button data-dialog-close variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <input
            ref={inputRef}
            type="file"
            accept={MEDIA_ACCEPT}
            className="sr-only"
            aria-label="Upload a new image to the gallery"
            disabled={uploading}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            disabled={uploading}
            aria-busy={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Upload new image'}
          </Button>
          {error ? (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {items.length === 0 && !loading ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted)]">
              Your gallery is empty. Upload an image to get started.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Gallery images">
              {items.map((item) => {
                const problem = pickProblem(item, purpose);
                return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={Boolean(problem)}
                    className="group block w-full overflow-hidden rounded-md border border-[var(--color-border)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] enabled:hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => onSelect(item)}
                    aria-label={problem ? `${item.filename} (${problem.toLowerCase()})` : `Use ${item.filename}`}
                  >
                    <span className="block aspect-square bg-[#f3f7f5]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaSrc(item.url) ?? ''} alt="" className="h-full w-full object-contain" />
                    </span>
                    <span className="block truncate px-2 pt-1 text-xs font-medium">{item.filename}</span>
                    <span className="block px-2 pb-1 text-[11px] text-[var(--color-muted)]">
                      {problem ?? formatDimensions(item) ?? item.mimeType}
                    </span>
                  </button>
                </li>
                );
              })}
            </ul>
          )}
          {loading ? <p className="py-4 text-center text-sm text-[var(--color-muted)]">Loading…</p> : null}
          {!loading && page < totalPages ? (
            <div className="pt-4 text-center">
              <Button variant="secondary" onClick={() => void load(page + 1)}>
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
