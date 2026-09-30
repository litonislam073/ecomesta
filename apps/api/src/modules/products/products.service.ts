import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  Prisma,
  ProductStatus,
  StoreRole,
  type Product,
  type ProductVariant,
} from '@prisma/client';
import type { Request } from 'express';
import {
  moneyToString,
  normalizePagination,
  pageMeta,
  parseMoney,
  parseOptionalMoney,
} from '../../common/utils/catalog.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  CreateProductDto,
  CreateVariantDto,
  ListProductsQueryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/product.dto';
import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_RETIRE_GRACE_SECONDS,
  PRODUCT_IMAGE_TYPES,
  detectImageType,
  safeImageFilename,
  uploadedMediaId,
} from './product-image.util';

/** The parts of a multer memory-storage file the image upload uses. */
export type UploadedImageFile = {
  buffer: Buffer;
  size: number;
  originalname?: string;
};

type ProductWithCategories = Product & {
  categories: { categoryId: string; category: { id: string; name: string; slug: string } }[];
  inventoryItems?: { quantity: number }[];
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async create(
    userId: string,
    storeId: string,
    dto: CreateProductDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);

    const basePrice = parseMoney(dto.basePrice, 'basePrice');
    const compareAtPrice = parseOptionalMoney(dto.compareAtPrice, 'compareAtPrice');
    const costPrice = parseOptionalMoney(dto.costPrice, 'costPrice');
    const categoryIds = dto.categoryIds ?? [];
    await this.assertCategoriesInStore(storeId, categoryIds);

    const trackInventory = dto.trackInventory ?? true;
    const status = dto.status ?? ProductStatus.DRAFT;

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            storeId,
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            shortDescription: dto.shortDescription,
            status,
            productType: dto.productType ?? 'PHYSICAL',
            sku: dto.sku || null,
            barcode: dto.barcode,
            basePrice,
            compareAtPrice: compareAtPrice === undefined ? null : compareAtPrice,
            costPrice: costPrice === undefined ? null : costPrice,
            trackInventory,
            allowBackorder: dto.allowBackorder ?? false,
            categories:
              categoryIds.length > 0
                ? {
                    create: categoryIds.map((categoryId) => ({ categoryId })),
                  }
                : undefined,
          },
          include: {
            categories: {
              include: {
                category: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        });

        if (trackInventory) {
          await tx.inventoryItem.create({
            data: {
              storeId,
              productId: created.id,
              variantId: null,
              quantity: 0,
              reservedQuantity: 0,
            },
          });
        }

        await tx.store.updateMany({
          where: { id: storeId, firstRealProductCreatedAt: null },
          data: { firstRealProductCreatedAt: new Date() },
        });

        return created;
      });

      await this.audit.log({
        action: 'PRODUCT_CREATED',
        entityType: 'Product',
        entityId: product.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { slug: product.slug, sku: product.sku },
        req,
      });

      return { success: true as const, data: this.toProductDto(product) };
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async list(userId: string, storeId: string, query: ListProductsQueryDto) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireStore(storeId);

    const { page, limit, skip } = normalizePagination(query);
    const where = this.buildWhere(storeId, query);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include: {
          categories: {
            include: {
              category: { select: { id: true, name: true, slug: true } },
            },
          },
          inventoryItems: { select: { quantity: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: items.map((item) => this.toProductDto(item)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getOne(userId: string, storeId: string, productId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const product = await this.requireProductInStore(storeId, productId, true);
    const variants = await this.prisma.productVariant.findMany({
      where: { productId, storeId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      success: true as const,
      data: {
        ...this.toProductDto(product),
        variants: variants.map((v) => this.toVariantDto(v)),
      },
    };
  }

  async update(
    userId: string,
    storeId: string,
    productId: string,
    dto: UpdateProductDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireProductInStore(storeId, productId, true);

    if (dto.categoryIds) {
      await this.assertCategoriesInStore(storeId, dto.categoryIds);
    }

    const basePrice =
      dto.basePrice !== undefined
        ? parseMoney(dto.basePrice, 'basePrice')
        : undefined;
    const compareAtPrice =
      dto.compareAtPrice !== undefined
        ? parseOptionalMoney(dto.compareAtPrice, 'compareAtPrice')
        : undefined;
    const costPrice =
      dto.costPrice !== undefined
        ? parseOptionalMoney(dto.costPrice, 'costPrice')
        : undefined;

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        if (dto.categoryIds) {
          await tx.productCategory.deleteMany({ where: { productId } });
          if (dto.categoryIds.length > 0) {
            await tx.productCategory.createMany({
              data: dto.categoryIds.map((categoryId) => ({
                productId,
                categoryId,
              })),
              skipDuplicates: true,
            });
          }
        }

        const updated = await tx.product.update({
          where: { id: existing.id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
            ...(dto.description !== undefined
              ? { description: dto.description }
              : {}),
            ...(dto.shortDescription !== undefined
              ? { shortDescription: dto.shortDescription }
              : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.productType !== undefined
              ? { productType: dto.productType }
              : {}),
            ...(dto.sku !== undefined ? { sku: dto.sku || null } : {}),
            ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
            ...(basePrice !== undefined ? { basePrice } : {}),
            ...(compareAtPrice !== undefined ? { compareAtPrice } : {}),
            ...(costPrice !== undefined ? { costPrice } : {}),
            ...(dto.trackInventory !== undefined
              ? { trackInventory: dto.trackInventory }
              : {}),
            ...(dto.allowBackorder !== undefined
              ? { allowBackorder: dto.allowBackorder }
              : {}),
          },
          include: {
            categories: {
              include: {
                category: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        });

        const trackInventory = updated.trackInventory;
        if (trackInventory) {
          const variantCount = await tx.productVariant.count({
            where: { productId },
          });
          if (variantCount === 0) {
            await this.ensureProductInventory(tx, storeId, productId);
          }
        }

        return updated;
      });

      await this.audit.log({
        action: 'PRODUCT_UPDATED',
        entityType: 'Product',
        entityId: product.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { changes: Object.keys(dto) },
        req,
      });

      return { success: true as const, data: this.toProductDto(product) };
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  /**
   * Soft-delete / archive: set status ARCHIVED. Hard delete is not used so
   * future order history can still reference the product.
   */
  async archive(
    userId: string,
    storeId: string,
    productId: string,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireProductInStore(storeId, productId, true);

    if (existing.status === ProductStatus.ARCHIVED) {
      return {
        success: true as const,
        data: this.toProductDto(existing as ProductWithCategories),
      };
    }

    const product = await this.prisma.product.update({
      where: { id: existing.id },
      data: { status: ProductStatus.ARCHIVED },
      include: {
        categories: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    await this.audit.log({
      action: 'PRODUCT_ARCHIVED',
      entityType: 'Product',
      entityId: product.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { previousStatus: existing.status },
      req,
    });

    return { success: true as const, data: this.toProductDto(product) };
  }

  // ---------------------------------------------------------------------------
  // Product image (SF-04)
  // ---------------------------------------------------------------------------

  /**
   * Stores an uploaded image in `media` and points the product at it. The new
   * row, the product update and removal of the replaced upload commit together,
   * so the product never references a missing image and nothing is orphaned.
   */
  async setImage(
    userId: string,
    storeId: string,
    productId: string,
    file: UploadedImageFile | undefined,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    await this.requireProductInStore(storeId, productId);

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
    const ext = PRODUCT_IMAGE_TYPES[mimeType];
    const mediaId = randomUUID();
    const imageUrl = `${this.apiBaseUrl()}/api/v1/public/media/${mediaId}`;

    const { product, replacedMediaId } = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent uploads for this product so each replaced upload is removed.
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
      const current = await tx.product.findFirstOrThrow({
        where: { id: productId, storeId },
        select: { imageUrl: true },
      });
      await tx.media.create({
        data: {
          id: mediaId,
          storeId,
          uploadedByUserId: userId,
          url: imageUrl,
          key: `products/${productId}/${mediaId}.${ext}`,
          filename: safeImageFilename(file.originalname, ext),
          mimeType,
          size: file.buffer.length,
          data: new Uint8Array(file.buffer),
        },
        select: { id: true },
      });
      const updated = await tx.product.update({
        where: { id: productId },
        data: { imageUrl },
        include: {
          categories: {
            include: { category: { select: { id: true, name: true, slug: true } } },
          },
        },
      });
      const previous = uploadedMediaId(current.imageUrl);
      await this.retireProductImage(tx, storeId, previous);
      return { product: updated, replacedMediaId: previous };
    });

    await this.audit.log({
      action: 'PRODUCT_IMAGE_UPDATED',
      entityType: 'Product',
      entityId: productId,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { mediaId, mimeType, size: file.buffer.length, replacedMediaId },
      req,
    });

    return { success: true as const, data: this.toProductDto(product) };
  }

  async removeImage(
    userId: string,
    storeId: string,
    productId: string,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    await this.requireProductInStore(storeId, productId);

    const { product, removedMediaId } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
      const current = await tx.product.findFirstOrThrow({
        where: { id: productId, storeId },
        select: { imageUrl: true },
      });
      const updated = await tx.product.update({
        where: { id: productId },
        data: { imageUrl: null },
        include: {
          categories: {
            include: { category: { select: { id: true, name: true, slug: true } } },
          },
        },
      });
      const previous = uploadedMediaId(current.imageUrl);
      await this.retireProductImage(tx, storeId, previous);
      return { product: updated, removedMediaId: previous };
    });

    await this.audit.log({
      action: 'PRODUCT_IMAGE_REMOVED',
      entityType: 'Product',
      entityId: productId,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { removedMediaId },
      req,
    });

    return { success: true as const, data: this.toProductDto(product) };
  }

  /** Public bytes for an uploaded image; unknown ids are a plain 404. */
  async getMediaFile(mediaId: string) {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, data: { not: null } },
      select: { mimeType: true, data: true },
    });
    if (!media?.data) {
      throw new NotFoundException('Image not found');
    }
    return { mimeType: media.mimeType, data: Buffer.from(media.data) };
  }

  /**
   * A replaced or removed upload stays servable for a grace period, because
   * storefront pages cache product data briefly and may still reference it.
   * Its `updatedAt` marks when it stopped being used; uploads unreferenced for
   * longer than the grace period are purged for the whole store here.
   * Prisma stores UTC in `timestamp without time zone`, hence the explicit UTC.
   */
  private async retireProductImage(
    tx: Prisma.TransactionClient,
    storeId: string,
    mediaId: string | null,
  ) {
    if (mediaId) {
      await tx.media.updateMany({
        where: { id: mediaId, storeId },
        data: { updatedAt: new Date() },
      });
    }
    await tx.$executeRaw`
      DELETE FROM media m
      WHERE m.store_id = ${storeId}::uuid
        AND m.key LIKE 'products/%'
        AND m.updated_at < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${PRODUCT_IMAGE_RETIRE_GRACE_SECONDS})
        AND NOT EXISTS (
          SELECT 1 FROM products p
          WHERE p.store_id = m.store_id AND p.image_url = m.url
        )
    `;
  }

  private apiBaseUrl(): string {
    return this.config.get<string>('API_URL')!.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  }

  // ---------------------------------------------------------------------------
  // Variants
  // ---------------------------------------------------------------------------

  async createVariant(
    userId: string,
    storeId: string,
    productId: string,
    dto: CreateVariantDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const product = await this.requireProductInStore(storeId, productId);

    const price = parseMoney(dto.price, 'price');
    const compareAtPrice = parseOptionalMoney(dto.compareAtPrice, 'compareAtPrice');
    const costPrice = parseOptionalMoney(dto.costPrice, 'costPrice');
    const weight =
      dto.weight === undefined
        ? undefined
        : dto.weight === null || dto.weight === ''
          ? null
          : parseWeight(dto.weight);

    try {
      const variant = await this.prisma.$transaction(async (tx) => {
        const created = await tx.productVariant.create({
          data: {
            storeId,
            productId: product.id,
            name: dto.name,
            sku: dto.sku || null,
            barcode: dto.barcode,
            price,
            compareAtPrice:
              compareAtPrice === undefined ? null : compareAtPrice,
            costPrice: costPrice === undefined ? null : costPrice,
            weight: weight === undefined ? null : weight,
            status: dto.status ?? ProductStatus.ACTIVE,
          },
        });

        if (product.trackInventory) {
          // Prefer variant-level inventory once variants exist.
          // Migrate product-level stock onto the first variant only.
          const productLevel = await tx.inventoryItem.findFirst({
            where: { storeId, productId, variantId: null },
          });
          const variantCount = await tx.productVariant.count({
            where: { productId, storeId },
          });
          const migrateQty =
            variantCount === 1 && productLevel ? productLevel.quantity : 0;
          const migrateReserved =
            variantCount === 1 && productLevel
              ? productLevel.reservedQuantity
              : 0;

          if (productLevel) {
            await tx.inventoryItem.delete({ where: { id: productLevel.id } });
          }

          await tx.inventoryItem.create({
            data: {
              storeId,
              productId,
              variantId: created.id,
              quantity: migrateQty,
              reservedQuantity: migrateReserved,
            },
          });
        }

        return created;
      });

      await this.audit.log({
        action: 'VARIANT_CREATED',
        entityType: 'ProductVariant',
        entityId: variant.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { productId, sku: variant.sku },
        req,
      });

      return { success: true as const, data: this.toVariantDto(variant) };
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async listVariants(userId: string, storeId: string, productId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireProductInStore(storeId, productId);

    const variants = await this.prisma.productVariant.findMany({
      where: { storeId, productId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      success: true as const,
      data: variants.map((v) => this.toVariantDto(v)),
    };
  }

  async getVariant(
    userId: string,
    storeId: string,
    productId: string,
    variantId: string,
  ) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const variant = await this.requireVariant(storeId, productId, variantId);
    return { success: true as const, data: this.toVariantDto(variant) };
  }

  async updateVariant(
    userId: string,
    storeId: string,
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireVariant(storeId, productId, variantId);

    const price =
      dto.price !== undefined ? parseMoney(dto.price, 'price') : undefined;
    const compareAtPrice =
      dto.compareAtPrice !== undefined
        ? parseOptionalMoney(dto.compareAtPrice, 'compareAtPrice')
        : undefined;
    const costPrice =
      dto.costPrice !== undefined
        ? parseOptionalMoney(dto.costPrice, 'costPrice')
        : undefined;
    const weight =
      dto.weight === undefined
        ? undefined
        : dto.weight === null || dto.weight === ''
          ? null
          : parseWeight(dto.weight);

    try {
      const variant = await this.prisma.productVariant.update({
        where: { id: existing.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku || null } : {}),
          ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
          ...(price !== undefined ? { price } : {}),
          ...(compareAtPrice !== undefined ? { compareAtPrice } : {}),
          ...(costPrice !== undefined ? { costPrice } : {}),
          ...(weight !== undefined ? { weight } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      await this.audit.log({
        action: 'VARIANT_UPDATED',
        entityType: 'ProductVariant',
        entityId: variant.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { productId, changes: Object.keys(dto) },
        req,
      });

      return { success: true as const, data: this.toVariantDto(variant) };
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async deleteVariant(
    userId: string,
    storeId: string,
    productId: string,
    variantId: string,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireVariant(storeId, productId, variantId);

    const inventory = await this.prisma.inventoryItem.findFirst({
      where: { storeId, productId, variantId },
    });
    if (
      inventory &&
      (inventory.quantity !== 0 || inventory.reservedQuantity !== 0)
    ) {
      throw new ConflictException(
        'Cannot delete variant with non-zero inventory; adjust stock to zero first',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (inventory) {
        await tx.inventoryItem.delete({ where: { id: inventory.id } });
      }
      await tx.productVariant.delete({ where: { id: existing.id } });

      const remaining = await tx.productVariant.count({
        where: { productId, storeId },
      });
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { trackInventory: true },
      });
      if (remaining === 0 && product?.trackInventory) {
        await this.ensureProductInventory(tx, storeId, productId);
      }
    });

    await this.audit.log({
      action: 'VARIANT_DELETED',
      entityType: 'ProductVariant',
      entityId: existing.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { productId, sku: existing.sku },
      req,
    });

    return {
      success: true as const,
      data: { id: existing.id, deleted: true },
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildWhere(
    storeId: string,
    query: ListProductsQueryDto,
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = { storeId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.productType) {
      where.productType = query.productType;
    }
    if (query.categoryId) {
      where.categories = { some: { categoryId: query.categoryId } };
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async assertCategoriesInStore(storeId: string, categoryIds: string[]) {
    if (categoryIds.length === 0) {
      return;
    }
    const found = await this.prisma.category.findMany({
      where: { storeId, id: { in: categoryIds } },
      select: { id: true },
    });
    if (found.length !== categoryIds.length) {
      throw new BadRequestException(
        'One or more categoryIds do not belong to this store',
      );
    }
  }

  private async ensureProductInventory(
    tx: Prisma.TransactionClient,
    storeId: string,
    productId: string,
  ) {
    const existing = await tx.inventoryItem.findFirst({
      where: { storeId, productId, variantId: null },
    });
    if (!existing) {
      await tx.inventoryItem.create({
        data: {
          storeId,
          productId,
          variantId: null,
          quantity: 0,
          reservedQuantity: 0,
        },
      });
    }
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

  private async requireProductInStore(
    storeId: string,
    productId: string,
    withCategories = false,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
      include: withCategories
        ? {
            categories: {
              include: {
                category: { select: { id: true, name: true, slug: true } },
              },
            },
          }
        : undefined,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product as ProductWithCategories | Product;
  }

  private async requireVariant(
    storeId: string,
    productId: string,
    variantId: string,
  ) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, storeId },
    });
    if (!variant) {
      throw new NotFoundException('Variant not found');
    }
    return variant;
  }

  private rethrowUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(',')
        : String(error.meta?.target ?? '');
      if (target.includes('slug')) {
        throw new ConflictException(
          'Product slug is already taken for this store',
        );
      }
      if (target.includes('sku')) {
        throw new ConflictException(
          'SKU is already taken for this store',
        );
      }
      throw new ConflictException('Unique constraint violation');
    }
    throw error;
  }

  private toProductDto(product: Product | ProductWithCategories) {
    const categories =
      'categories' in product && Array.isArray(product.categories)
        ? product.categories.map((link) => ({
            id: link.category.id,
            name: link.category.name,
            slug: link.category.slug,
          }))
        : [];

    const inventoryItems =
      'inventoryItems' in product && Array.isArray(product.inventoryItems)
        ? product.inventoryItems
        : undefined;

    return {
      id: product.id,
      storeId: product.storeId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription,
      status: product.status,
      productType: product.productType,
      sku: product.sku,
      barcode: product.barcode,
      basePrice: moneyToString(product.basePrice),
      compareAtPrice: moneyToString(product.compareAtPrice),
      costPrice: moneyToString(product.costPrice),
      trackInventory: product.trackInventory,
      allowBackorder: product.allowBackorder,
      imageUrl: product.imageUrl,
      isDemo: product.isDemo,
      ...(inventoryItems
        ? {
            onHandQuantity: inventoryItems.reduce(
              (sum, row) => sum + row.quantity,
              0,
            ),
          }
        : {}),
      categoryIds: categories.map((c) => c.id),
      categories,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private toVariantDto(variant: ProductVariant) {
    return {
      id: variant.id,
      storeId: variant.storeId,
      productId: variant.productId,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      price: moneyToString(variant.price),
      compareAtPrice: moneyToString(variant.compareAtPrice),
      costPrice: moneyToString(variant.costPrice),
      weight: variant.weight == null ? null : variant.weight.toString(),
      status: variant.status,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }
}

function parseWeight(value: unknown): Prisma.Decimal {
  const asString = typeof value === 'number' ? String(value) : String(value).trim();
  if (!/^\d+(\.\d{1,3})?$/.test(asString)) {
    throw new BadRequestException(
      'weight must be a non-negative number with up to 3 decimals',
    );
  }
  const decimal = new Prisma.Decimal(asString);
  if (decimal.isNegative()) {
    throw new BadRequestException('weight cannot be negative');
  }
  return decimal;
}
