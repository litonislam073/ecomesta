import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  normalizePagination,
  pageMeta,
} from '../../common/utils/catalog.util';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAdminAuditLogsQueryDto } from './dto/admin-audit.dto';

@Injectable()
export class AdminAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(actingUserId: string, query: ListAdminAuditLogsQueryDto) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const { page, limit, skip } = normalizePagination(query);
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action?.trim()) where.action = query.action.trim();
    if (query.userId) where.userId = query.userId;
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.storeId) where.storeId = query.storeId;

    const from = this.parseDate(query.from, 'from');
    const to = this.parseDate(query.to, 'to');
    if (from && to && to < from) {
      throw new BadRequestException('to must be after from');
    }
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          tenantId: true,
          storeId: true,
          userId: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      success: true as const,
      data: { items, meta: pageMeta(total, page, limit) },
    };
  }

  private parseDate(value: string | undefined, field: string): Date | undefined {
    if (!value) {
      return undefined;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return date;
  }
}
