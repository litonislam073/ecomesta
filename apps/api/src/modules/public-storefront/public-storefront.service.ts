import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductStatus,
  StoreStatus,
  TenantStatus,
} from '@prisma/client';
import {
  moneyToString,
  normalizePagination,
  pageMeta,
  parseMoney,
} from '../../common/utils/catalog.util';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingAccessService } from '../billing/billing-access.service';
import {
  ListPublicCategoriesQueryDto,
  ListPublicProductsQueryDto,
} from './dto/public-storefront.dto';

@Injectable()
export class PublicStorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAccess: BillingAccessService,
  ) {}

  async getStore(storeSlug: string) {
    const store = await this.requireActiveStore(storeSlug);
    return { success: true as const, data: this.toStoreDto(store) };
  }

  async listCategories(storeSlug: string, query: ListPublicCategoriesQueryDto) {
    const store = await this.requireActiveStore(storeSlug);
    const items = await this.prisma.category.findMany({
      where: { storeId: store.id, status: ProductStatus.ACTIVE },
      orderBy: { name: 'asc' },
      take: 500,
    });

    const mapped = items.map((c) => this.toCategoryDto(c));
    if (query.tree) {
      return {
        success: true as const,
        data: { items: this.buildCategoryTree(mapped), meta: { tree: true } },
      };
    }
    return {
      success: true as const,
      data: {
        items: mapped,
        meta: { total: mapped.length, tree: false },
      },
    };
  }

  async listProducts(storeSlug: string, query: ListPublicProductsQueryDto) {
    const store = await this.requireActiveStore(storeSlug);
    const { page, limit, skip } = normalizePagination(query);

    let categoryId: string | undefined;
    if (query.categorySlug) {
      const category = await this.prisma.category.findFirst({
        where: {
          storeId: store.id,
          slug: query.categorySlug,
          status: ProductStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
      categoryId = category.id;
    }

    const where: Prisma.ProductWhereInput = {
      storeId: store.id,
      status: ProductStatus.ACTIVE,
    };

    if (categoryId) {
      where.categories = { some: { categoryId } };
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
        { shortDescription: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.basePrice = {};
      if (query.minPrice !== undefined) {
        where.basePrice.gte = parseMoney(query.minPrice, 'minPrice');
      }
      if (query.maxPrice !== undefined) {
        where.basePrice.lte = parseMoney(query.maxPrice, 'maxPrice');
      }
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [items, counted] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: query.inStock ? 0 : skip,
        take: query.inStock ? 500 : limit,
        include: {
          categories: {
            include: {
              category: {
                select: { id: true, name: true, slug: true, status: true },
              },
            },
          },
          variants: {
            where: { status: ProductStatus.ACTIVE },
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
              compareAtPrice: true,
              status: true,
            },
          },
          inventoryItems: {
            select: {
              quantity: true,
              reservedQuantity: true,
              variantId: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    let total = counted;
    let mapped = items.map((p) => this.toProductCard(p, store.currency));

    if (query.inStock) {
      mapped = mapped.filter((p) => p.available);
      total = mapped.length;
      mapped = mapped.slice(skip, skip + limit);
    }

    return {
      success: true as const,
      data: {
        items: mapped,
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getProduct(storeSlug: string, productSlug: string) {
    const store = await this.requireActiveStore(storeSlug);
    const product = await this.prisma.product.findFirst({
      where: {
        storeId: store.id,
        slug: productSlug,
        status: ProductStatus.ACTIVE,
      },
      include: {
        categories: {
          include: {
            category: {
              select: { id: true, name: true, slug: true, status: true },
            },
          },
        },
        variants: {
          where: { status: ProductStatus.ACTIVE },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            compareAtPrice: true,
            status: true,
          },
        },
        inventoryItems: {
          select: {
            quantity: true,
            reservedQuantity: true,
            variantId: true,
          },
        },
      },
    });

    if (!product) {
      // Same response for missing / draft / archived / wrong store.
      throw new NotFoundException('Product not found');
    }

    return {
      success: true as const,
      data: this.toProductDetail(product, store.currency),
    };
  }

  async getCategory(storeSlug: string, categorySlug: string) {
    const store = await this.requireActiveStore(storeSlug);
    const category = await this.prisma.category.findFirst({
      where: {
        storeId: store.id,
        slug: categorySlug,
        status: ProductStatus.ACTIVE,
      },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return { success: true as const, data: this.toCategoryDto(category) };
  }

  // ---------------------------------------------------------------------------

  async requireActiveStore(storeSlug: string) {
    const slug = storeSlug.trim().toLowerCase();
    if (!slug) {
      throw new NotFoundException('Store not found');
    }

    const matches = await this.prisma.store.findMany({
      where: {
        slug,
        status: StoreStatus.ACTIVE,
        // Suspended tenants are not publicly operable even if store row is ACTIVE.
        tenant: { status: TenantStatus.ACTIVE },
      },
      take: 2,
      select: {
        id: true,
        tenantId: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        faviconUrl: true,
        currency: true,
        timezone: true,
        locale: true,
        status: true,
        email: true,
        phone: true,
        address: true,
        checkoutRequirePhone: true,
        checkoutAllowOrderNotes: true,
        allowCustomerCancellation: true,
        seoTitle: true,
        seoDescription: true,
        seoKeywords: true,
        ogTitle: true,
        ogDescription: true,
        ogImageUrl: true,
        seoIndexingEnabled: true,
      },
    });

    if (matches.length === 0) {
      await this.billingAccess.throwIfSuspended({ slug });
      throw new NotFoundException('Store not found');
    }
    if (matches.length > 1) {
      throw new ConflictException(
        'Multiple active stores share this slug; use a unique slug or domain routing',
      );
    }
    const { tenantId, ...store } = matches[0]!;
    await this.billingAccess.assertTenantInGoodStanding(tenantId);
    return store;
  }

  private availability(
    trackInventory: boolean,
    allowBackorder: boolean,
    inventoryItems: { quantity: number; reservedQuantity: number; variantId: string | null }[],
    variantId: string | null,
  ): boolean {
    if (!trackInventory || allowBackorder) {
      return true;
    }
    const row = inventoryItems.find((i) =>
      variantId ? i.variantId === variantId : i.variantId == null,
    );
    if (!row) {
      return false;
    }
    return row.quantity - row.reservedQuantity > 0;
  }

  /** Public-safe store projection — contact details the merchant chose to publish, no internals. */
  private toStoreDto(store: Awaited<ReturnType<PublicStorefrontService['requireActiveStore']>>) {
    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      description: store.description,
      logoUrl: store.logoUrl,
      faviconUrl: store.faviconUrl,
      currency: store.currency,
      timezone: store.timezone,
      locale: store.locale,
      language: store.locale.toLowerCase().startsWith('bn') ? 'bn' : 'en',
      contact: {
        email: store.email,
        phone: store.phone,
        address: store.address,
      },
      checkout: {
        requireEmail: false,
        requirePhone: true,
        allowOrderNotes: store.checkoutAllowOrderNotes,
      },
      allowCustomerCancellation: store.allowCustomerCancellation,
      seo: {
        title: store.seoTitle,
        description: store.seoDescription,
        keywords: store.seoKeywords,
        ogTitle: store.ogTitle,
        ogDescription: store.ogDescription,
        ogImageUrl: store.ogImageUrl,
        indexingEnabled: store.seoIndexingEnabled,
      },
    };
  }

  private toCategoryDto(category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    parentId: string | null;
  }) {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      parentId: category.parentId,
    };
  }

  private buildCategoryTree(
    items: ReturnType<PublicStorefrontService['toCategoryDto']>[],
  ) {
    type Node = (typeof items)[number] & { children: Node[] };
    const map = new Map<string, Node>();
    for (const item of items) {
      map.set(item.id, { ...item, children: [] });
    }
    const roots: Node[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  private toProductCard(
    product: {
      id: string;
      name: string;
      slug: string;
      shortDescription: string | null;
      description: string | null;
      productType: string;
      sku: string | null;
      basePrice: Prisma.Decimal;
      compareAtPrice: Prisma.Decimal | null;
      trackInventory: boolean;
      allowBackorder: boolean;
      imageUrl: string | null;
      categories: {
        category: { id: string; name: string; slug: string; status: ProductStatus };
      }[];
      variants: {
        id: string;
        name: string;
        sku: string | null;
        price: Prisma.Decimal;
        compareAtPrice: Prisma.Decimal | null;
        status: ProductStatus;
      }[];
      inventoryItems: {
        quantity: number;
        reservedQuantity: number;
        variantId: string | null;
      }[];
    },
    currency: string,
  ) {
    const variants = product.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: moneyToString(v.price)!,
      compareAtPrice: moneyToString(v.compareAtPrice),
      available: this.availability(
        product.trackInventory,
        product.allowBackorder,
        product.inventoryItems,
        v.id,
      ),
    }));

    const baseAvailable =
      variants.length > 0
        ? variants.some((v) => v.available)
        : this.availability(
            product.trackInventory,
            product.allowBackorder,
            product.inventoryItems,
            null,
          );

    // A product with variants is sold at its variants' prices; `basePrice`
    // is often a placeholder such as 0. Cards show the range of the variants
    // that can be bought right now (null when none can).
    let variantPriceMin: Prisma.Decimal | null = null;
    let variantPriceMax: Prisma.Decimal | null = null;
    product.variants.forEach((v, index) => {
      if (!variants[index]!.available) return;
      if (!variantPriceMin || v.price.lt(variantPriceMin)) variantPriceMin = v.price;
      if (!variantPriceMax || v.price.gt(variantPriceMax)) variantPriceMax = v.price;
    });

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      productType: product.productType,
      currency,
      price: moneyToString(product.basePrice)!,
      compareAtPrice: moneyToString(product.compareAtPrice),
      sku: product.sku,
      available: baseAvailable,
      images: product.imageUrl
        ? [{ url: product.imageUrl, alt: product.name }]
        : [],
      categories: product.categories
        .filter((c) => c.category.status === ProductStatus.ACTIVE)
        .map((c) => ({
          id: c.category.id,
          name: c.category.name,
          slug: c.category.slug,
        })),
      hasVariants: variants.length > 0,
      variantPriceMin: moneyToString(variantPriceMin),
      variantPriceMax: moneyToString(variantPriceMax),
    };
  }

  private toProductDetail(
    product: Parameters<PublicStorefrontService['toProductCard']>[0],
    currency: string,
  ) {
    const card = this.toProductCard(product, currency);
    const variants = product.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: moneyToString(v.price)!,
      compareAtPrice: moneyToString(v.compareAtPrice),
      available: this.availability(
        product.trackInventory,
        product.allowBackorder,
        product.inventoryItems,
        v.id,
      ),
    }));

    return {
      ...card,
      description: product.description,
      variants,
    };
  }
}
