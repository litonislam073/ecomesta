import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StoreStatus } from '@prisma/client';
import type { Request } from 'express';
import {
  normalizePagination,
  pageMeta,
} from '../../common/utils/catalog.util';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ListAdminStoresQueryDto,
  UpdateStoreStatusDto,
} from './dto/admin-store.dto';

const TENANT_SUMMARY_SELECT = {
  select: { id: true, name: true, slug: true, status: true },
} as const;

@Injectable()
export class AdminStoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async list(actingUserId: string, query: ListAdminStoresQueryDto) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const { page, limit, skip } = normalizePagination(query);
    const where: Prisma.StoreWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.tenantId) where.tenantId = query.tenantId;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.store.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
          tenant: TENANT_SUMMARY_SELECT,
        },
      }),
      this.prisma.store.count({ where }),
    ]);

    return {
      success: true as const,
      data: { items, meta: pageMeta(total, page, limit) },
    };
  }

  async getOne(actingUserId: string, storeId: string) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        currency: true,
        timezone: true,
        locale: true,
        createdAt: true,
        updatedAt: true,
        tenant: TENANT_SUMMARY_SELECT,
        memberships: {
          select: {
            id: true,
            role: true,
            status: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        domains: {
          select: {
            id: true,
            hostname: true,
            type: true,
            status: true,
            isPrimary: true,
            verifiedAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        storeThemes: {
          where: { isActive: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            publishedAt: true,
            theme: { select: { name: true, slug: true } },
          },
        },
        _count: {
          select: {
            products: true,
            customers: true,
            orders: true,
            inventoryItems: true,
          },
        },
      },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const { _count, storeThemes, ...rest } = store;
    const activeTheme = storeThemes[0];

    return {
      success: true as const,
      data: {
        ...rest,
        // Read-only surface: theme writes stay on the merchant endpoints.
        theme: activeTheme
          ? {
              name: activeTheme.theme.name,
              slug: activeTheme.theme.slug,
              publishedAt: activeTheme.publishedAt?.toISOString() ?? null,
            }
          : null,
        counts: {
          products: _count.products,
          customers: _count.customers,
          orders: _count.orders,
          inventoryItems: _count.inventoryItems,
        },
      },
    };
  }

  async updateStatus(
    actingUserId: string,
    storeId: string,
    dto: UpdateStoreStatusDto,
    req?: Request,
  ) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const existing = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, slug: true, status: true, tenantId: true },
    });
    if (!existing) {
      throw new NotFoundException('Store not found');
    }

    const store = await this.prisma.store.update({
      where: { id: storeId },
      // An explicit admin decision replaces any pending billing restore.
      data: { status: dto.status, statusBeforeBillingSuspension: null },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        tenant: TENANT_SUMMARY_SELECT,
      },
    });

    await this.audit.log({
      action:
        dto.status === StoreStatus.SUSPENDED
          ? 'STORE_SUSPENDED'
          : 'STORE_ACTIVATED',
      entityType: 'Store',
      entityId: store.id,
      userId: actingUserId,
      tenantId: existing.tenantId,
      storeId: store.id,
      metadata: {
        slug: store.slug,
        previousStatus: existing.status,
        status: store.status,
      },
      req,
    });

    return { success: true as const, data: store };
  }
}
