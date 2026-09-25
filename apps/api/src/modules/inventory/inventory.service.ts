import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  StoreRole,
  type InventoryItem,
  type InventoryMovement,
} from '@prisma/client';
import type { Request } from 'express';
import {
  normalizePagination,
  pageMeta,
} from '../../common/utils/catalog.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  AdjustInventoryDto,
  ListInventoryQueryDto,
  ListMovementsQueryDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string, storeId: string, query: ListInventoryQueryDto) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireStore(storeId);

    const { page, limit, skip } = normalizePagination(query);
    const where: Prisma.InventoryItemWhereInput = { storeId };
    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.variantId) {
      where.variantId = query.variantId;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { product: { name: { contains: term, mode: 'insensitive' } } },
        { product: { sku: { contains: term, mode: 'insensitive' } } },
        { variant: { name: { contains: term, mode: 'insensitive' } } },
        { variant: { sku: { contains: term, mode: 'insensitive' } } },
      ];
    }
    if (query.stockStatus === 'out') {
      where.quantity = { lte: 0 };
    } else if (query.stockStatus === 'in_stock') {
      where.quantity = { gt: 0 };
    } else if (query.stockStatus === 'low') {
      // Prefer configured threshold; otherwise treat 1–5 as low stock.
      where.AND = [
        { quantity: { gt: 0 } },
        {
          OR: [
            {
              AND: [
                { lowStockThreshold: { not: null } },
                // Prisma cannot compare two columns directly; filter after fetch for threshold rows.
                // Use a broad candidate set then refine in memory for threshold matches.
                { quantity: { lte: 100000 } },
              ],
            },
            {
              AND: [
                { lowStockThreshold: null },
                { quantity: { lte: 5 } },
              ],
            },
          ],
        },
      ];
    }

    let [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryItem.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: query.stockStatus === 'low' ? 0 : skip,
        take: query.stockStatus === 'low' ? 500 : limit,
        include: {
          product: {
            select: { id: true, name: true, sku: true, allowBackorder: true },
          },
          variant: { select: { id: true, name: true, sku: true } },
        },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    if (query.stockStatus === 'low') {
      items = items.filter((item) => {
        if (item.quantity <= 0) {
          return false;
        }
        if (item.lowStockThreshold != null) {
          return item.quantity <= item.lowStockThreshold;
        }
        return item.quantity <= 5;
      });
      total = items.length;
      items = items.slice(skip, skip + limit);
    }

    return {
      success: true as const,
      data: {
        items: items.map((item) => this.toItemDto(item)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getOne(userId: string, storeId: string, inventoryItemId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const item = await this.requireItem(storeId, inventoryItemId);
    return { success: true as const, data: this.toItemDto(item) };
  }

  /**
   * Atomically apply a signed quantity delta and write an InventoryMovement.
   * Uses SELECT ... FOR UPDATE so concurrent adjustments cannot overwrite.
   */
  async adjust(
    userId: string,
    storeId: string,
    dto: AdjustInventoryDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);

    if (dto.quantity === 0) {
      throw new BadRequestException('quantity delta must be non-zero');
    }
    if (dto.type !== InventoryMovementType.ADJUSTMENT) {
      // Phase 5 only exposes manual adjustments; other types reserved for orders later.
      throw new BadRequestException(
        'Only ADJUSTMENT movements are accepted via this endpoint in Phase 5',
      );
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, storeId },
      select: {
        id: true,
        trackInventory: true,
        allowBackorder: true,
        _count: { select: { variants: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (!product.trackInventory) {
      throw new UnprocessableEntityException(
        'Inventory tracking is disabled for this product',
      );
    }

    const variantId = dto.variantId ?? null;
    if (product._count.variants > 0 && !variantId) {
      throw new BadRequestException(
        'variantId is required when the product has variants',
      );
    }
    if (variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: variantId, productId: product.id, storeId },
        select: { id: true },
      });
      if (!variant) {
        throw new NotFoundException('Variant not found for this product');
      }
    } else if (product._count.variants > 0) {
      throw new BadRequestException(
        'variantId is required when the product has variants',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let item = await this.lockInventoryRow(tx, storeId, product.id, variantId);

      if (!item) {
        const created = await tx.inventoryItem.create({
          data: {
            storeId,
            productId: product.id,
            variantId,
            quantity: 0,
            reservedQuantity: 0,
          },
        });
        item = await this.lockInventoryRow(tx, storeId, product.id, variantId);
        if (!item) {
          item = {
            id: created.id,
            store_id: storeId,
            product_id: product.id,
            variant_id: variantId,
            quantity: 0,
            reserved_quantity: 0,
            low_stock_threshold: null,
          };
        }
      }

      const nextQuantity = item.quantity + dto.quantity;
      if (nextQuantity < 0 && !product.allowBackorder) {
        throw new UnprocessableEntityException(
          'Inventory quantity cannot become negative unless allowBackorder is enabled',
        );
      }
      if (item.reserved_quantity > nextQuantity && !product.allowBackorder) {
        throw new UnprocessableEntityException(
          'reservedQuantity cannot exceed on-hand quantity',
        );
      }

      const updated = await tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: nextQuantity },
        include: {
          product: {
            select: { id: true, name: true, sku: true, allowBackorder: true },
          },
          variant: { select: { id: true, name: true, sku: true } },
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          storeId,
          productId: product.id,
          variantId,
          type: InventoryMovementType.ADJUSTMENT,
          quantity: dto.quantity,
          referenceType: 'MANUAL_ADJUSTMENT',
          referenceId: userId,
          note: dto.note,
        },
      });

      return { item: updated, movement };
    });

    await this.audit.log({
      action: 'INVENTORY_ADJUSTED',
      entityType: 'InventoryItem',
      entityId: result.item.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        productId: product.id,
        variantId,
        delta: dto.quantity,
        quantityAfter: result.item.quantity,
        movementId: result.movement.id,
      },
      req,
    });

    return {
      success: true as const,
      data: {
        inventoryItem: this.toItemDto(result.item),
        movement: this.toMovementDto(result.movement),
      },
    };
  }

  async listMovements(
    userId: string,
    storeId: string,
    inventoryItemId: string,
    query: ListMovementsQueryDto,
  ) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const item = await this.requireItem(storeId, inventoryItemId);
    const { page, limit, skip } = normalizePagination(query);

    const where: Prisma.InventoryMovementWhereInput = {
      storeId,
      productId: item.productId,
      variantId: item.variantId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: items.map((m) => this.toMovementDto(m)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  private async lockInventoryRow(
    tx: Prisma.TransactionClient,
    storeId: string,
    productId: string,
    variantId: string | null,
  ): Promise<{
    id: string;
    store_id: string;
    product_id: string;
    variant_id: string | null;
    quantity: number;
    reserved_quantity: number;
    low_stock_threshold: number | null;
  } | null> {
    if (variantId) {
      const rows = await tx.$queryRaw<
        {
          id: string;
          store_id: string;
          product_id: string;
          variant_id: string | null;
          quantity: number;
          reserved_quantity: number;
          low_stock_threshold: number | null;
        }[]
      >`
        SELECT id, store_id, product_id, variant_id, quantity, reserved_quantity, low_stock_threshold
        FROM inventory_items
        WHERE store_id = ${storeId}::uuid
          AND product_id = ${productId}::uuid
          AND variant_id = ${variantId}::uuid
        FOR UPDATE
      `;
      return rows[0] ?? null;
    }

    const rows = await tx.$queryRaw<
      {
        id: string;
        store_id: string;
        product_id: string;
        variant_id: string | null;
        quantity: number;
        reserved_quantity: number;
        low_stock_threshold: number | null;
      }[]
    >`
      SELECT id, store_id, product_id, variant_id, quantity, reserved_quantity, low_stock_threshold
      FROM inventory_items
      WHERE store_id = ${storeId}::uuid
        AND product_id = ${productId}::uuid
        AND variant_id IS NULL
      FOR UPDATE
    `;
    return rows[0] ?? null;
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

  private async requireItem(storeId: string, inventoryItemId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId, storeId },
      include: {
        product: {
          select: { id: true, name: true, sku: true, allowBackorder: true },
        },
        variant: { select: { id: true, name: true, sku: true } },
      },
    });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    return item;
  }

  private toItemDto(
    item: InventoryItem & {
      product?: { id: string; name: string; sku: string | null; allowBackorder?: boolean };
      variant?: { id: string; name: string; sku: string | null } | null;
    },
  ) {
    return {
      id: item.id,
      storeId: item.storeId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      reservedQuantity: item.reservedQuantity,
      lowStockThreshold: item.lowStockThreshold,
      availableQuantity: item.quantity - item.reservedQuantity,
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
          }
        : undefined,
      variant: item.variant
        ? {
            id: item.variant.id,
            name: item.variant.name,
            sku: item.variant.sku,
          }
        : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private toMovementDto(movement: InventoryMovement) {
    return {
      id: movement.id,
      storeId: movement.storeId,
      productId: movement.productId,
      variantId: movement.variantId,
      type: movement.type,
      quantity: movement.quantity,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      note: movement.note,
      createdAt: movement.createdAt,
    };
  }
}
