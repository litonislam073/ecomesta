import type { MediaItem, MediaPurpose, OffsetPageMeta } from '@ecomesta/types';
import { api } from '@/lib/api-client';

/** Mirrors the API limits so the merchant hears about a bad file immediately. */
export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp';
export const MEDIA_MAX_BYTES = 1_500_000;

/**
 * What the storefront does with each kind of image, and the size that looks
 * best there. Shown next to every upload so merchants know what to prepare.
 */
export const IMAGE_GUIDES: Record<MediaPurpose, { title: string; note: string }> = {
  logo: {
    title: 'Logo',
    note:
      'Square image, 512 × 512 px recommended (at least 160 × 160 px). It is shown 40 × 40 px in the ' +
      'store header and cropped to a square, so keep the mark centred with some space around it. ' +
      'PNG or WebP with a transparent background works best. JPEG, PNG or WebP, up to 1.5 MB.',
  },
  favicon: {
    title: 'Favicon',
    note:
      'The small icon in the browser tab. Must be square: 512 × 512 px recommended (between 16 × 16 ' +
      'and 1024 × 1024 px). Browsers shrink it to 16–32 px, so use a simple, bold mark rather than ' +
      'text. PNG recommended, up to 1.5 MB.',
  },
  background: {
    title: 'Background image',
    note:
      'Wide landscape image, 1920 × 800 px recommended (at least 1200 × 500 px). It fills the homepage ' +
      'banner behind your headline and is cropped on small screens, so keep the important part in the ' +
      'centre. JPEG or WebP keeps the page fast; up to 1.5 MB.',
  },
  product: {
    title: 'Product image',
    note: 'Square image, 1000 × 1000 px recommended. JPEG, PNG or WebP, up to 1.5 MB.',
  },
  general: {
    title: 'Image',
    note: 'JPEG, PNG or WebP, up to 1.5 MB and at most 6000 × 6000 px.',
  },
};

export function mediaFileProblem(file: File): string | null {
  if (!MEDIA_ACCEPT.split(',').includes(file.type)) {
    return 'Choose a JPEG, PNG or WebP image.';
  }
  if (file.size > MEDIA_MAX_BYTES) {
    return 'Image must be 1.5 MB or smaller.';
  }
  return null;
}

/** Demo-catalog images are storefront-relative paths; uploads are absolute URLs. */
export function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/')) {
    const web = (process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return `${web}${url}`;
  }
  return url;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDimensions(item: Pick<MediaItem, 'width' | 'height'>): string | null {
  return item.width && item.height ? `${item.width} × ${item.height} px` : null;
}

export type MediaListMeta = OffsetPageMeta;

export function listMedia(storeId: string, page = 1, limit = 48) {
  return api.get<{ success: true; data: { items: MediaItem[]; meta: MediaListMeta } }>(
    `/stores/${storeId}/media?page=${page}&limit=${limit}`,
  );
}

export function uploadMedia(storeId: string, file: File, purpose: MediaPurpose = 'general') {
  const form = new FormData();
  form.append('file', file);
  return api.upload<{ success: true; data: MediaItem }>(
    `/stores/${storeId}/media?purpose=${purpose}`,
    form,
  );
}

export function deleteMedia(storeId: string, mediaId: string) {
  return api.delete<{ success: true; data: { id: string } }>(`/stores/${storeId}/media/${mediaId}`);
}
