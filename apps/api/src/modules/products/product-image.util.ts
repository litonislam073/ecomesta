/**
 * SF-04 product image rules. The type is decided from the file's leading bytes,
 * never from the browser-supplied MIME type or filename.
 */

/** Stays below the 2 MB nginx `client_max_body_size` including multipart overhead. */
export const PRODUCT_IMAGE_MAX_BYTES = 1_500_000;

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

/** Pixel size read from the file header; null when the header is unreadable. */
export function readImageDimensions(
  buffer: Buffer,
  mimeType: ProductImageMimeType,
): { width: number; height: number } | null {
  if (mimeType === 'image/png') {
    // IHDR is always the first chunk: width and height follow the chunk type.
    if (buffer.length < 24 || buffer.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mimeType === 'image/webp') {
    const chunk = buffer.subarray(12, 16).toString('latin1');
    if (chunk === 'VP8 ' && buffer.length >= 30) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L' && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X' && buffer.length >= 30) {
      return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
    }
    return null;
  }
  // JPEG: walk the segments to the first start-of-frame marker.
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1]!;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return null;
}

/**
 * What an upload is for. Each purpose only adds checks the storefront relies
 * on; every upload ends up in the store's media gallery.
 */
export const MEDIA_PURPOSES = ['general', 'product', 'logo', 'favicon', 'background'] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

/** Larger images are almost certainly a mistake and slow every storefront page. */
export const MEDIA_MAX_DIMENSION = 6000;
export const FAVICON_MIN_SIZE = 16;
export const FAVICON_MAX_SIZE = 1024;

/** Reason an image cannot be used for `purpose`, or null when it can. */
export function mediaPurposeProblem(
  purpose: MediaPurpose,
  size: { width: number; height: number },
): string | null {
  if (size.width > MEDIA_MAX_DIMENSION || size.height > MEDIA_MAX_DIMENSION) {
    return `Image must be at most ${MEDIA_MAX_DIMENSION}×${MEDIA_MAX_DIMENSION} pixels`;
  }
  if (purpose === 'favicon') {
    if (size.width !== size.height) {
      return `Favicon must be square (this image is ${size.width}×${size.height} pixels)`;
    }
    if (size.width < FAVICON_MIN_SIZE || size.width > FAVICON_MAX_SIZE) {
      return `Favicon must be between ${FAVICON_MIN_SIZE}×${FAVICON_MIN_SIZE} and ${FAVICON_MAX_SIZE}×${FAVICON_MAX_SIZE} pixels`;
    }
  }
  return null;
}
