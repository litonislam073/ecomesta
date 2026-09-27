import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { clientIp } from '../../common/utils/request-host.util';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    action: string;
    entityType: string;
    entityId?: string;
    userId?: string;
    tenantId?: string;
    storeId?: string;
    metadata?: Prisma.InputJsonValue;
    req?: Request;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
        tenantId: params.tenantId,
        storeId: params.storeId,
        metadata: params.metadata,
        ipAddress: this.clientIp(params.req),
        userAgent: params.req?.headers['user-agent']?.toString().slice(0, 512),
      },
    });
  }

  private clientIp(req?: Request): string | undefined {
    return req ? clientIp(req) : undefined;
  }
}
