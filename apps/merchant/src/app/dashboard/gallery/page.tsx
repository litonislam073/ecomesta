'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaItem, OffsetPageMeta } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { StoreScoped } from '@/components/catalog/store-scoped';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/components/ui/toast';
import { humanApiError } from '@/lib/catalog-utils';
import {
  IMAGE_GUIDES,
  MEDIA_ACCEPT,
  deleteMedia,
  formatBytes,
  formatDimensions,
  listMedia,
  mediaFileProblem,
  mediaSrc,
  uploadMedia,
} from '@/lib/media';
import { useCanManageStore } from '@/lib/permissions';
import { useStoreContext } from '@/lib/store-context';

const PAGE_SIZE = 24;

function GalleryContent() {
  const { selectedStoreId } = useStoreContext();
  const canWrite = useCanManageStore();
  const { pushToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!selectedStoreId) {
      setItems([]);
      setMeta(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listMedia(selectedStoreId, page, PAGE_SIZE);
      setItems(result.data.items);
      setMeta(result.data.meta);
    } catch (err) {
      setError(humanApiError(err, 'Failed to load the gallery'));
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = '';
    if (!selectedStoreId || files.length === 0 || uploading) return;
    const problems: string[] = [];
    let uploaded = 0;
    setUploadErrors([]);
    setUploading({ done: 0, total: files.length });
    for (const [index, file] of files.entries()) {
      const problem = mediaFileProblem(file);
      if (problem) {
        problems.push(`${file.name}: ${problem}`);
      } else {
        try {
          await uploadMedia(selectedStoreId, file, 'general');
          uploaded += 1;
        } catch (err) {
          problems.push(`${file.name}: ${humanApiError(err, 'Could not upload.')}`);
        }
      }
      setUploading({ done: index + 1, total: files.length });
    }
    setUploading(null);
    setUploadErrors(problems);
    if (uploaded > 0) {
      pushToast(uploaded === 1 ? 'Image added to the gallery' : `${uploaded} images added to the gallery`, 'success');
      if (page === 1) await load();
      else setPage(1);
    }
  }

  async function copyUrl(item: MediaItem) {
    try {
      await navigator.clipboard.writeText(item.url);
      pushToast('Image URL copied', 'success');
    } catch {
      pushToast('Could not copy. Select the URL and copy it manually.', 'error');
    }
  }

  async function confirmDelete() {
    if (!selectedStoreId || !toDelete) return;
    setDeleting(true);
    try {
      await deleteMedia(selectedStoreId, toDelete.id);
      pushToast('Image deleted', 'success');
      setToDelete(null);
      if (items.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (err) {
      pushToast(humanApiError(err, 'Could not delete the image.'), 'error');
      setToDelete(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  if (!selectedStoreId) {
    return <EmptyState title="Select a store" description="Choose a store from the header to see its gallery." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Gallery</h1>
          <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
            Every image you upload for this store — logo, favicon, banner backgrounds and product photos — is kept
            here. Use any of them again from the theme editor or a product page with “Choose from gallery”.
          </p>
        </div>
        {canWrite ? (
          <div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={MEDIA_ACCEPT}
              className="sr-only"
              aria-label="Upload images to the gallery"
              disabled={uploading !== null}
              onChange={(event) => void onFiles(event.target.files)}
            />
            <Button disabled={uploading !== null} aria-busy={uploading !== null} onClick={() => inputRef.current?.click()}>
              {uploading ? `Uploading ${uploading.done}/${uploading.total}…` : 'Upload images'}
            </Button>
          </div>
        ) : null}
      </div>

      <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
        <summary className="cursor-pointer font-medium">Recommended image sizes</summary>
        <dl className="mt-3 space-y-2">
          {(['logo', 'favicon', 'background', 'product'] as const).map((purpose) => (
            <div key={purpose}>
              <dt className="font-medium">{IMAGE_GUIDES[purpose].title}</dt>
              <dd className="text-[var(--color-muted)]">{IMAGE_GUIDES[purpose].note}</dd>
            </div>
          ))}
        </dl>
      </details>

      {uploadErrors.length > 0 ? (
        <div className="rounded-lg border border-[var(--color-danger)] p-3 text-sm" role="alert">
          <p className="font-medium">Some images were not uploaded:</p>
          <ul className="mt-1 list-disc pl-5">
            {uploadErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? <LoadingState label="Loading gallery" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No images yet"
          description="Upload images here, or from the theme editor and product pages. They will all appear in this gallery."
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Gallery images">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <a href={mediaSrc(item.url) ?? '#'} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-[#f3f7f5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaSrc(item.url) ?? ''} alt={item.filename} loading="lazy" className="h-full w-full object-contain" />
              </a>
              <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 text-sm">
                <p className="truncate font-medium" title={item.filename}>
                  {item.filename}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {[formatDimensions(item), formatBytes(item.size), item.mimeType.replace('image/', '').toUpperCase()]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {item.usedBy.length > 0 ? `Used by: ${item.usedBy.map((u) => u.label).join(', ')}` : 'Not used yet'}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Button variant="secondary" onClick={() => void copyUrl(item)}>
                    Copy URL
                  </Button>
                  {canWrite ? (
                    <Button
                      variant="danger"
                      disabled={item.usedBy.length > 0}
                      title={item.usedBy.length > 0 ? 'Replace it where it is used before deleting' : undefined}
                      onClick={() => setToDelete(item)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {meta ? <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} /> : null}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this image?"
        description={`“${toDelete?.filename ?? ''}” will be removed from the gallery for good. Links to it will stop working.`}
        confirmLabel="Delete image"
        danger
        safeDefault
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

export default function GalleryPage() {
  return (
    <StoreScoped>
      <GalleryContent />
    </StoreScoped>
  );
}
