import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, StoreRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { MediaItem, MediaUsage } from '@ecomesta/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_TYPES,
  detectImageType,
  mediaPurposeProblem,
  readImageDimensions,
  safeImageFilename,
  type MediaPurpose,
  type ProductImageMimeType,
} from './product-image.util';

/** The parts of a multer memory-storage file an image upload uses. */
export type UploadedImageFile = {
  originalname?: string;
  size: number;
  buffer: Buffer;
};

export type CheckedImage = {
  mimeType: ProductImageMimeType;
  ext: string;
  width: number;
  height: number;
};

/** Columns read for gallery listings; never the file bytes. */
const MEDIA_ITEM_SELECT = {
  id: true,
  url: true,
  filename: true,
  mimeType: true,
  size: true,
  width: true,
  height: true,
  createdAt: true,
} satisfies Prisma.MediaSelect;

type MediaRow = Prisma.MediaGetPayload<{ select: typeof MEDIA_ITEM_SELECT }>;

/**
 * The store's media gallery: every image uploaded for the store (logo, favicon,
 * backgrounds, product images) is kept here until the merchant deletes it, and
 * can be reused anywhere an image URL is accepted.
 */
@Injectable()
export class MediaLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Checks an uploaded file before anything is written. The type comes from the
   * file's leading bytes and the size from its header, never from the client.
   */
  checkImage(file: UploadedImageFile | undefined, purpose: MediaPurpose): CheckedImage {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose an image file to upload');
    }
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      throw new PayloadTooLargeException('Image must be 1.5 MB or smaller');
    }
    const mimeType = detectImageType(file.buffer);
    if (!mimeType) {
      throw new UnsupportedMediaTypeException('Image must be a JPEG, PNG or WebP file');
    }
    const size = readImageDimensions(file.buffer, mimeType);
    if (!size || size.width < 1 || size.height < 1) {
      throw new UnprocessableEntityException('The image file is damaged or incomplete');
    }
    const problem = mediaPurposeProblem(purpose, size);
    if (problem) {
      throw new UnprocessableEntityException(problem);
    }
    return { mimeType, ext: PRODUCT_IMAGE_TYPES[mimeType], ...size };
  }

  /** Writes a checked image to the gallery inside the caller's transaction. */
  async createInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      storeId: string;
      userId: string;
      file: UploadedImageFile;
      image: CheckedImage;
      keyPrefix: string;
    },
  ): Promise<MediaRow> {
    const id = randomUUID();
    return tx.media.create({
      data: {
        id,
        storeId: input.storeId,
        uploadedByUserId: input.userId,
        url: this.publicUrl(id),
        key: `${input.keyPrefix}/${id}.${input.image.ext}`,
        filename: safeImageFilename(input.file.originalname, input.image.ext),
        mimeType: input.image.mimeType,
        size: input.file.buffer.length,
        width: input.image.width,
        height: input.image.height,
        data: new Uint8Array(input.file.buffer),
      },
      select: MEDIA_ITEM_SELECT,
    });
  }

  async list(userId: string, storeId: string, query: { page?: number; limit?: number }) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireStore(storeId);
    const limit = Math.min(Math.max(query.limit ?? 48, 1), 100);
    const page = Math.max(query.page ?? 1, 1);
    const where: Prisma.MediaWhereInput = { storeId, data: { not: null } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.media.findMany({
        where,
        select: MEDIA_ITEM_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.media.count({ where }),
    ]);
    const usages = await this.usages(this.prisma, storeId);
    return {
      success: true as const,
      data: {
        items: rows.map((row) => this.toItem(row, usages)),
        meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
      },
    };
  }

  async upload(
    userId: string,
    storeId: string,
    file: UploadedImageFile | undefined,
    purpose: MediaPurpose,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const store = await this.requireStore(storeId);
    const image = this.checkImage(file, purpose);
    const row = await this.prisma.$transaction((tx) =>
      this.createInTransaction(tx, { storeId, userId, file: file!, image, keyPrefix: `library/${purpose}` }),
    );
    await this.audit.log({
      action: 'MEDIA_UPLOADED',
      entityType: 'Media',
      entityId: row.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { purpose, mimeType: row.mimeType, size: row.size, width: row.width, height: row.height },
      req,
    });
    return { success: true as const, data: this.toItem(row, []) };
  }

  /**
   * Deletes a gallery image. An image still shown anywhere on the store is
   * refused, so deleting can never leave a broken image on the storefront.
   */
  async remove(userId: string, storeId: string, mediaId: string, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const store = await this.requireStore(storeId);
    const removed = await this.prisma.$transaction(async (tx) => {
      // Product, category, store and theme writes that set an image URL do not
      // lock media rows, so lock the store to see a stable set of references.
      await tx.$queryRaw`SELECT id FROM stores WHERE id = ${storeId}::uuid FOR NO KEY UPDATE`;
      const media = await tx.media.findFirst({
        where: { id: mediaId, storeId, data: { not: null } },
        select: MEDIA_ITEM_SELECT,
      });
      if (!media) {
        throw new NotFoundException('Image not found');
      }
      const usedBy = this.usedBy(media.url, await this.usages(tx, storeId));
      if (usedBy.length > 0) {
        throw new ConflictException({
          message: `This image is still used by: ${usedBy.map((u) => u.label).join(', ')}. Replace it there first.`,
          usedBy,
        });
      }
      await tx.media.delete({ where: { id: media.id } });
      return media;
    });
    await this.audit.log({
      action: 'MEDIA_DELETED',
      entityType: 'Media',
      entityId: removed.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { filename: removed.filename, size: removed.size },
      req,
    });
    return { success: true as const, data: { id: removed.id } };
  }

  /** A gallery image of this store, for pointing something at it. */
  async requireStoreMedia(
    tx: Prisma.TransactionClient,
    storeId: string,
    mediaId: string,
  ): Promise<{ id: string; url: string }> {
    const media = await tx.media.findFirst({
      where: { id: mediaId, storeId, data: { not: null } },
      select: { id: true, url: true },
    });
    if (!media) {
      throw new NotFoundException('Image not found in this store’s gallery');
    }
    return media;
  }

  publicUrl(mediaId: string): string {
    const base = this.config
      .get<string>('API_URL')!
      .replace(/\/+$/, '')
      .replace(/\/api\/v1$/, '');
    return `${base}/api/v1/public/media/${mediaId}`;
  }

  /** Every place in the store that currently shows an image, by URL. */
  private async usages(
    db: Prisma.TransactionClient | PrismaService,
    storeId: string,
  ): Promise<Array<MediaUsage & { url: string }>> {
    const [products, categories, store, themes] = await Promise.all([
      db.product.findMany({
        where: { storeId, imageUrl: { not: null } },
        select: { id: true, name: true, imageUrl: true },
      }),
      db.category.findMany({
        where: { storeId, imageUrl: { not: null } },
        select: { id: true, name: true, imageUrl: true },
      }),
      db.store.findUnique({
        where: { id: storeId },
        select: { logoUrl: true, faviconUrl: true, ogImageUrl: true },
      }),
      db.storeTheme.findMany({
        where: { storeId },
        select: { configuration: true, publishedConfiguration: true, theme: { select: { name: true } } },
      }),
    ]);
    const found: Array<MediaUsage & { url: string }> = [];
    for (const p of products) {
      found.push({ kind: 'product', id: p.id, label: `Product “${p.name}”`, url: p.imageUrl! });
    }
    for (const c of categories) {
      found.push({ kind: 'category', id: c.id, label: `Category “${c.name}”`, url: c.imageUrl! });
    }
    if (store?.logoUrl) found.push({ kind: 'store', id: null, label: 'Store logo', url: store.logoUrl });
    if (store?.faviconUrl) found.push({ kind: 'store', id: null, label: 'Store favicon', url: store.faviconUrl });
    if (store?.ogImageUrl) found.push({ kind: 'store', id: null, label: 'SEO share image', url: store.ogImageUrl });
    for (const t of themes) {
      for (const [config, state] of [
        [t.configuration, 'draft'],
        [t.publishedConfiguration, 'published'],
      ] as const) {
        for (const [path, url] of imageUrlsInConfig(config)) {
          found.push({ kind: 'theme', id: null, label: `${t.theme.name} theme ${path} (${state})`, url });
        }
      }
    }
    return found;
  }

  private usedBy(url: string, usages: Array<MediaUsage & { url: string }>): MediaUsage[] {
    const seen = new Set<string>();
    return usages
      .filter((u) => u.url === url)
      .map(({ kind, id, label }) => ({ kind, id, label }))
      .filter((u) => (seen.has(u.label) ? false : (seen.add(u.label), true)));
  }

  private toItem(row: MediaRow, usages: Array<MediaUsage & { url: string }>): MediaItem {
    return {
      id: row.id,
      url: row.url,
      filename: row.filename,
      mimeType: row.mimeType,
      size: row.size,
      width: row.width,
      height: row.height,
      createdAt: row.createdAt.toISOString(),
      usedBy: this.usedBy(row.url, usages),
    };
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, tenantId: true },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }
}

const THEME_IMAGE_FIELDS: Array<[section: string, key: string, label: string]> = [
  ['branding', 'logoUrl', 'logo'],
  ['branding', 'faviconUrl', 'favicon'],
  ['hero', 'imageUrl', 'banner background'],
  ['seo', 'ogImageUrl', 'share image'],
];

function imageUrlsInConfig(config: Prisma.JsonValue | null): Array<[label: string, url: string]> {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return [];
  const out: Array<[string, string]> = [];
  for (const [section, key, label] of THEME_IMAGE_FIELDS) {
    const block = (config as Record<string, unknown>)[section];
    if (block && typeof block === 'object' && !Array.isArray(block)) {
      const value = (block as Record<string, unknown>)[key];
      if (typeof value === 'string' && value) out.push([label, value]);
    }
  }
  return out;
}
