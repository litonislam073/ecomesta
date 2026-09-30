'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Product } from '@ecomesta/types';
import { Button } from '@ecomesta/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/api-client';
import { humanApiError } from '@/lib/catalog-utils';

/** Mirrors the API limits so the merchant hears about a bad file immediately. */
export const PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const PRODUCT_IMAGE_MAX_BYTES = 1_500_000;

export function productImageProblem(file: File): string | null {
  if (!PRODUCT_IMAGE_ACCEPT.split(',').includes(file.type)) {
    return 'Choose a JPEG, PNG or WebP image.';
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return 'Image must be 1.5 MB or smaller.';
  }
  return null;
}

/** Demo-catalog images are storefront-relative paths; uploads are absolute URLs. */
export function productImageSrc(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('/')) {
    const web = (process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return `${web}${imageUrl}`;
  }
  return imageUrl;
}

export function uploadProductImage(storeId: string, productId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return api.upload<{ success: true; data: Product }>(
    `/stores/${storeId}/products/${productId}/image`,
    form,
  );
}

function ImagePreview({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="flex aspect-square w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[#f3f7f5] sm:w-40">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="px-2 text-center text-xs text-[var(--color-muted)]">No image</span>
      )}
    </div>
  );
}

/**
 * Product image on the edit page. Upload, replace and remove are saved
 * straight away; the rest of the product form is unaffected.
 */
export function ProductImageField({
  storeId,
  product,
  canWrite,
  onChange,
}: {
  storeId: string;
  product: Pick<Product, 'id' | 'name' | 'imageUrl'>;
  canWrite: boolean;
  onChange: (product: Product) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const src = productImageSrc(product.imageUrl);

  async function onFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = '';
    if (!file || busy) return;
    const problem = productImageProblem(file);
    setError(problem);
    if (problem) return;
    setBusy('upload');
    try {
      const result = await uploadProductImage(storeId, product.id, file);
      onChange(result.data);
    } catch (err) {
      setError(humanApiError(err, 'Could not upload the image.'));
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    if (busy) return;
    setBusy('remove');
    setError(null);
    try {
      const result = await api.delete<{ success: true; data: Product }>(
        `/stores/${storeId}/products/${product.id}/image`,
      );
      onChange(result.data);
      setConfirmRemove(false);
    } catch (err) {
      setError(humanApiError(err, 'Could not remove the image.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <h2 className="text-xl font-semibold">Product image</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Shown on your storefront. JPEG, PNG or WebP, up to 1.5 MB. Changes are saved immediately.
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <ImagePreview src={src} alt={product.name} />
        {canWrite ? (
          <div className="min-w-0 space-y-3">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={PRODUCT_IMAGE_ACCEPT}
              className="sr-only"
              aria-label={src ? 'Replace product image' : 'Upload product image'}
              disabled={busy !== null}
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy !== null}
                aria-busy={busy === 'upload'}
                onClick={() => inputRef.current?.click()}
              >
                {busy === 'upload' ? 'Uploading…' : src ? 'Replace image' : 'Upload image'}
              </Button>
              {src ? (
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy !== null}
                  onClick={() => setConfirmRemove(true)}
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
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmRemove}
        title="Remove this image?"
        description="The product will show no image on your storefront until you upload a new one."
        confirmLabel="Remove image"
        danger
        safeDefault
        busy={busy === 'remove'}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => void onRemove()}
      />
    </section>
  );
}

/**
 * Image choice on the create page: the file is kept locally and uploaded once
 * the product exists.
 */
export function PendingProductImage({
  file,
  onChange,
  disabled,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onFile(next: File | undefined) {
    if (inputRef.current) inputRef.current.value = '';
    if (!next) return;
    const problem = productImageProblem(next);
    setError(problem);
    if (!problem) onChange(next);
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <h2 className="text-xl font-semibold">Product image</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Optional. JPEG, PNG or WebP, up to 1.5 MB. Uploaded when you create the product.
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <ImagePreview src={preview} alt="Selected product image" />
        <div className="min-w-0 space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept={PRODUCT_IMAGE_ACCEPT}
            className="sr-only"
            aria-label="Choose product image"
            disabled={disabled}
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              {file ? 'Choose another image' : 'Choose image'}
            </Button>
            {file ? (
              <Button type="button" variant="secondary" disabled={disabled} onClick={() => onChange(null)}>
                Clear
              </Button>
            ) : null}
          </div>
          {file ? (
            <p className="break-all text-sm text-[var(--color-muted)]">{file.name}</p>
          ) : null}
          {error ? (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
