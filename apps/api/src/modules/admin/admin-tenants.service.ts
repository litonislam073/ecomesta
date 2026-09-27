import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TenantStatus } from '@prisma/client';
import type { Request } from 'express';
import {
  moneyToString,
  normalizePagination,
  pageMeta,
} from '../../common/utils/catalog.util';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ListAdminTenantsQueryDto,
  UpdateTenantStatusDto,
} from './dto/admin-tenant.dto';

const RECENT_AUDIT_LIMIT = 10;

@Injectable()
export class AdminTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async list(actingUserId: string, query: ListAdminTenantsQueryDto) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const { page, limit, skip } = normalizePagination(query);
    const where: Prisma.TenantWhereInput = {};
    if (query.status) where.status = query.status;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { stores: true, memberships: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: items.map(({ _count, ...tenant }) => ({
          ...tenant,
          counts: { stores: _count.stores, users: _count.memberships },
        })),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getOne(actingUserId: string, tenantId: string) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
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
        stores: {
          select: { id: true, name: true, slug: true, status: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { stores: true, memberships: true } },
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const [latestSubscription, ordersCount, recentAudit] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              slug: true,
              monthlyPrice: true,
              yearlyPrice: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where: { store: { tenantId } } }),
      this.prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: RECENT_AUDIT_LIMIT,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          storeId: true,
          createdAt: true,
          user: { select: { id: true, email: true } },
        },
      }),
    ]);

    const { _count, ...rest } = tenant;

    return {
      success: true as const,
      data: {
        ...rest,
        counts: {
          stores: _count.stores,
          users: _count.memberships,
          orders: ordersCount,
        },
        latestSubscription: latestSubscription
          ? {
              id: latestSubscription.id,
              status: latestSubscription.status,
              billingCycle: latestSubscription.billingCycle,
              startsAt: latestSubscription.startsAt,
              endsAt: latestSubscription.endsAt,
              trialEndsAt: latestSubscription.trialEndsAt,
              createdAt: latestSubscription.createdAt,
              plan: {
                id: latestSubscription.plan.id,
                name: latestSubscription.plan.name,
                slug: latestSubscription.plan.slug,
                monthlyPrice: moneyToString(
                  latestSubscription.plan.monthlyPrice,
                ),
                yearlyPrice: moneyToString(latestSubscription.plan.yearlyPrice),
              },
            }
          : null,
        recentAuditLogs: recentAudit,
      },
    };
  }

  /**
   * Suspension is enforced at read/authorization time; store rows keep their own
   * status so reactivating a tenant restores the previous storefront state.
   */
  async updateStatus(
    actingUserId: string,
    tenantId: string,
    dto: UpdateTenantStatusDto,
    req?: Request,
  ) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const existing = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: dto.status },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.audit.log({
      action:
        dto.status === TenantStatus.SUSPENDED
          ? 'TENANT_SUSPENDED'
          : 'TENANT_ACTIVATED',
      entityType: 'Tenant',
      entityId: tenant.id,
      userId: actingUserId,
      tenantId: tenant.id,
      metadata: {
        slug: tenant.slug,
        previousStatus: existing.status,
        status: tenant.status,
      },
      req,
    });

    return { success: true as const, data: tenant };
  }
}
