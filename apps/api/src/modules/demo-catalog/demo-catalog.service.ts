import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  ProductStatus,
  StoreRole,
} from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  DEMO_CATEGORIES,
  DEMO_PRODUCTS,
  demoProductImageUrl,
} from './demo-catalog.data';

const DEMO_REFERENCE_TYPE = 'DEMO_CATALOG_IMPORT';

@Injectable()
export class DemoCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async status(userId: string, storeId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const store = await this.requireStore(storeId);

    const imported = store.demoCatalogImportedAt !== null;
    const hasRealProducts = store.firstRealProductCreatedAt !== null;

    return {
      success: true as const,
      data: {
        available: !imported && !hasRealProducts,
        imported,
        hasRealProducts,
      },
    };
  }

  async import(userId: string, storeId: string, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);

    const counts = await this.prisma.$transaction(
      async (tx) => {
        // Atomic claim: concurrent requests block on the store row lock and the
        // loser re-evaluates the predicate against the committed value.
        const importedAt = new Date();
        const claimed = await tx.store.updateMany({
          where: {
            id: storeId,
            demoCatalogImportedAt: null,
            firstRealProductCreatedAt: null,
          },
          data: { demoCatalogImportedAt: importedAt },
        });
        if (claimed.count === 0) {
          const current = await tx.store.findUnique({
            where: { id: storeId },
            select: { demoCatalogImportedAt: true },
          });
          throw new ConflictException(
            current?.demoCatalogImportedAt
              ? 'Sample products have already been added to this store'
              : 'Sample products are only available before you add your own products',
          );
        }

        return this.createCatalog(tx, storeId, userId);
      },
      { timeout: 20_000 },
    );

    await this.audit.log({
      action: 'DEMO_CATALOG_IMPORTED',
      entityType: 'Store',
      entityId: storeId,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { ...counts },
      req,
    });

    return { success: true as const, data: counts };
  }

  private async createCatalog(
    tx: Prisma.TransactionClient,
    storeId: string,
    userId: string,
  ) {
    const [existingCategories, existingProducts] = await Promise.all([
      tx.category.findMany({ where: { storeId }, select: { slug: true } }),
      tx.product.findMany({ where: { storeId }, select: { slug: true } }),
    ]);
    const categorySlugs = new Set(
      existingCategories.map((c) => c.slug.toLowerCase()),
    );
    const productSlugs = new Set(
      existingProducts.map((p) => p.slug.toLowerCase()),
    );

    const categoryIds = new Map<string, string>();
    for (const definition of DEMO_CATEGORIES) {
      const category = await tx.category.create({
        data: {
          storeId,
          name: definition.name,
          slug: uniqueSlug(definition.slug, categorySlugs),
          description: definition.description,
          status: ProductStatus.ACTIVE,
          isDemo: true,
        },
      });
      categoryIds.set(definition.key, category.id);
    }

    let variantCount = 0;
    let inventoryCount = 0;

    for (const definition of DEMO_PRODUCTS) {
      const categoryId = categoryIds.get(definition.categoryKey);
      const product = await tx.product.create({
        data: {
          storeId,
          name: definition.name,
          slug: uniqueSlug(definition.slug, productSlugs),
          sku: definition.sku,
          shortDescription: definition.shortDescription,
          description: definition.description,
          status: ProductStatus.ACTIVE,
          productType: 'PHYSICAL',
          basePrice: new Prisma.Decimal(definition.basePrice),
          compareAtPrice: definition.compareAtPrice
            ? new Prisma.Decimal(definition.compareAtPrice)
            : null,
          trackInventory: true,
          allowBackorder: false,
          imageUrl: demoProductImageUrl(definition),
          isDemo: true,
          categories: categoryId ? { create: [{ categoryId }] } : undefined,
        },
      });

      if (definition.variants?.length) {
        for (const variantDefinition of definition.variants) {
          const variant = await tx.productVariant.create({
            data: {
              storeId,
              productId: product.id,
              name: variantDefinition.name,
              sku: variantDefinition.sku,
              price: new Prisma.Decimal(variantDefinition.price),
              status: ProductStatus.ACTIVE,
            },
          });
          variantCount += 1;
          await this.createOpeningStock(
            tx,
            storeId,
            product.id,
            variant.id,
            variantDefinition.quantity,
            userId,
          );
          inventoryCount += 1;
        }
      } else {
        await this.createOpeningStock(
          tx,
          storeId,
          product.id,
          null,
          definition.quantity ?? 0,
          userId,
        );
        inventoryCount += 1;
      }
    }

    return {
      categories: DEMO_CATEGORIES.length,
      products: DEMO_PRODUCTS.length,
      variants: variantCount,
      inventoryItems: inventoryCount,
    };
  }

  private async createOpeningStock(
    tx: Prisma.TransactionClient,
    storeId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    userId: string,
  ) {
    await tx.inventoryItem.create({
      data: {
        storeId,
        productId,
        variantId,
        quantity,
        reservedQuantity: 0,
      },
    });
    if (quantity > 0) {
      await tx.inventoryMovement.create({
        data: {
          storeId,
          productId,
          variantId,
          type: InventoryMovementType.ADJUSTMENT,
          quantity,
          referenceType: DEMO_REFERENCE_TYPE,
          referenceId: userId,
          note: 'Opening stock for sample product',
        },
      });
    }
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        tenantId: true,
        demoCatalogImportedAt: true,
        firstRealProductCreatedAt: true,
      },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }
}

function uniqueSlug(base: string, taken: Set<string>): string {
  let candidate = base;
  let attempt = 1;
  while (taken.has(candidate)) {
    candidate = attempt === 1 ? `${base}-sample` : `${base}-sample-${attempt}`;
    attempt += 1;
  }
  taken.add(candidate);
  return candidate;
}
