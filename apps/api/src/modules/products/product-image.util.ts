/**
 * SF-04 product image rules. The type is decided from the file's leading bytes,
 * never from the browser-supplied MIME type or filename.
 */

/** Stays below the 2 MB nginx `client_max_body_size` including multipart overhead. */
export const PRODUCT_IMAGE_MAX_BYTES = 1_500_000;

/**
 * How long a replaced/removed upload stays servable. Storefront pages cache
 * product data for 30 s, so this comfortably outlives any cached reference.
 */
export const PRODUCT_IMAGE_RETIRE_GRACE_SECONDS = 600;

export const PRODUCT_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type ProductImageMimeType = keyof typeof PRODUCT_IMAGE_TYPES;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  return (
    buffer.length >= offset + bytes.length &&
    bytes.every((byte, index) => buffer[offset + index] === byte)
  );
}

export function detectImageType(buffer: Buffer): ProductImageMimeType | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, PNG_SIGNATURE)) return 'image/png';
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** Display-only name: no path segments, control characters or long input. */
export function safeImageFilename(original: string | undefined, ext: string): string {
  const base = (original ?? '')
    .split(/[\\/]/)
    .pop()!
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .slice(0, 120);
  return base || `product-image.${ext}`;
}

const MEDIA_PATH = /\/api\/v1\/public\/media\/([0-9a-f-]{36})$/i;

/** Media id when `imageUrl` points at an uploaded image served by this API. */
export function uploadedMediaId(imageUrl: string | null): string | null {
  return imageUrl?.match(MEDIA_PATH)?.[1]?.toLowerCase() ?? null;
}
