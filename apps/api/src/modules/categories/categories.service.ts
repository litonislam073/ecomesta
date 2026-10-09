import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  ProductStatus,
  StoreRole,
  type Category,
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
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from './dto/category.dto';

const MAX_TREE_WALK = 64;

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async create(
    userId: string,
    storeId: string,
    dto: CreateCategoryDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);

    if (dto.parentId) {
      await this.requireCategoryInStore(storeId, dto.parentId);
    }

    try {
      const category = await this.prisma.category.create({
        data: {
          storeId,
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          imageUrl: dto.imageUrl,
          parentId: dto.parentId ?? null,
          status: dto.status ?? ProductStatus.ACTIVE,
        },
      });

      await this.audit.log({
        action: 'CATEGORY_CREATED',
        entityType: 'Category',
        entityId: category.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { slug: category.slug, parentId: category.parentId },
        req,
      });

      return { success: true as const, data: this.toDto(category) };
    } catch (error) {
      this.rethrowUnique(error, 'Category slug is already taken for this store');
    }
  }

  async list(userId: string, storeId: string, query: ListCategoriesQueryDto) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireStore(storeId);

    if (query.tree) {
      return this.listTree(storeId, query);
    }

    const { page, limit, skip } = normalizePagination(query);
    const where = this.buildWhere(storeId, query);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: items.map((item) => this.toDto(item)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getOne(userId: string, storeId: string, categoryId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const category = await this.requireCategoryInStore(storeId, categoryId);
    return { success: true as const, data: this.toDto(category) };
  }

  async update(
    userId: string,
    storeId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireCategoryInStore(storeId, categoryId);

    if (dto.parentId !== undefined) {
      if (dto.parentId === null) {
        // clear parent
      } else if (dto.parentId === categoryId) {
        throw new UnprocessableEntityException(
          'A category cannot be its own parent',
        );
      } else {
        await this.requireCategoryInStore(storeId, dto.parentId);
        if (await this.wouldCreateCycle(storeId, categoryId, dto.parentId)) {
          throw new UnprocessableEntityException(
            'Circular category parent relationship is not allowed',
          );
        }
      }
    }

    try {
      const category = await this.prisma.category.update({
        where: { id: existing.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      await this.audit.log({
        action: 'CATEGORY_UPDATED',
        entityType: 'Category',
        entityId: category.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { changes: Object.keys(dto) },
        req,
      });

      return { success: true as const, data: this.toDto(category) };
    } catch (error) {
      this.rethrowUnique(error, 'Category slug is already taken for this store');
    }
  }

  async remove(
    userId: string,
    storeId: string,
    categoryId: string,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireCategoryInStore(storeId, categoryId);

    const [childCount, productCount] = await this.prisma.$transaction([
      this.prisma.category.count({ where: { parentId: categoryId, storeId } }),
      this.prisma.productCategory.count({ where: { categoryId } }),
    ]);

    if (childCount > 0) {
      throw new ConflictException(
        'Cannot delete category while child categories exist; reassign or delete children first',
      );
    }
    if (productCount > 0) {
      throw new ConflictException(
        'Cannot delete category while products are assigned; reassign products first',
      );
    }

    await this.prisma.category.delete({ where: { id: existing.id } });

    await this.audit.log({
      action: 'CATEGORY_DELETED',
      entityType: 'Category',
      entityId: existing.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { slug: existing.slug },
      req,
    });

    return { success: true as const, data: { id: existing.id, deleted: true } };
  }

  private async listTree(storeId: string, query: ListCategoriesQueryDto) {
    const where = this.buildWhere(storeId, {
      ...query,
      parentId: undefined,
    });
    const items = await this.prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 500,
    });

    const nodes = items.map((item) => ({
      ...this.toDto(item),
      children: [] as ReturnType<CategoriesService['toDto']>[],
    }));
    type Node = (typeof nodes)[number];
    const byId = new Map<string, Node>(nodes.map((n) => [n.id, n]));
    const roots: Node[] = [];

    for (const node of nodes) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else if (!node.parentId) {
        roots.push(node);
      } else {
        roots.push(node);
      }
    }

    return {
      success: true as const,
      data: { items: roots, meta: { total: items.length, tree: true } },
    };
  }

  private buildWhere(
    storeId: string,
    query: ListCategoriesQueryDto,
  ): Prisma.CategoryWhereInput {
    const where: Prisma.CategoryWhereInput = { storeId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.parentId !== undefined) {
      where.parentId = query.parentId;
    }
    if (query.search?.trim()) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    return where;
  }

  private async wouldCreateCycle(
    storeId: string,
    categoryId: string,
    newParentId: string,
  ): Promise<boolean> {
    let current: string | null = newParentId;
    const visited = new Set<string>();

    for (let depth = 0; depth < MAX_TREE_WALK && current; depth += 1) {
      if (current === categoryId) {
        return true;
      }
      if (visited.has(current)) {
        return true;
      }
      visited.add(current);

      const ancestor: { parentId: string | null } | null =
        await this.prisma.category.findFirst({
          where: { id: current, storeId },
          select: { parentId: true },
        });
      current = ancestor?.parentId ?? null;
    }

    return false;
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

  private async requireCategoryInStore(storeId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, storeId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }

  private toDto(category: Category) {
    return {
      id: category.id,
      storeId: category.storeId,
      parentId: category.parentId,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      status: category.status,
      isDemo: category.isDemo,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
