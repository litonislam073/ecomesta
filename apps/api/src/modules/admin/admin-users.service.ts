import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PlatformRole, Prisma, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import {
  normalizePagination,
  pageMeta,
} from '../../common/utils/catalog.util';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ListAdminUsersQueryDto,
  UpdateUserPlatformRoleDto,
  UpdateUserStatusDto,
} from './dto/admin-user.dto';

const USER_LIST_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  platformRole: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async list(actingUserId: string, query: ListAdminUsersQueryDto) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const { page, limit, skip } = normalizePagination(query);
    const where: Prisma.UserWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.platformRole) where.platformRole = query.platformRole;
    if (query.search?.trim()) {
      where.email = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const sort = query.sort ?? 'createdAt';
    const order = query.order ?? 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_LIST_SELECT,
        orderBy: { [sort]: order },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      success: true as const,
      data: { items, meta: pageMeta(total, page, limit) },
    };
  }

  async getOne(actingUserId: string, userId: string) {
    await this.authorization.assertSuperAdmin(actingUserId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...USER_LIST_SELECT,
        tenantMemberships: {
          select: {
            id: true,
            role: true,
            status: true,
            createdAt: true,
            tenant: {
              select: { id: true, name: true, slug: true, status: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        storeMemberships: {
          select: {
            id: true,
            role: true,
            status: true,
            createdAt: true,
            store: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                tenantId: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { success: true as const, data: user };
  }

  async updateStatus(
    actingUserId: string,
    userId: string,
    dto: UpdateUserStatusDto,
    req?: Request,
  ) {
    await this.authorization.assertSuperAdmin(actingUserId);
    const existing = await this.requireUser(userId);

    if (
      dto.status === UserStatus.SUSPENDED &&
      existing.platformRole === PlatformRole.SUPER_ADMIN &&
      existing.status === UserStatus.ACTIVE
    ) {
      await this.assertAnotherSuperAdminRemains(
        userId,
        'Cannot suspend the last active Super Admin',
      );
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: dto.status },
      select: USER_LIST_SELECT,
    });

    if (dto.status === UserStatus.SUSPENDED) {
      await this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.log({
      action:
        dto.status === UserStatus.SUSPENDED
          ? 'USER_SUSPENDED'
          : 'USER_ACTIVATED',
      entityType: 'User',
      entityId: user.id,
      userId: actingUserId,
      metadata: {
        targetUserId: user.id,
        previousStatus: existing.status,
        status: user.status,
        sessionsRevoked: dto.status === UserStatus.SUSPENDED,
      },
      req,
    });

    return { success: true as const, data: user };
  }

  async updatePlatformRole(
    actingUserId: string,
    userId: string,
    dto: UpdateUserPlatformRoleDto,
    req?: Request,
  ) {
    await this.authorization.assertSuperAdmin(actingUserId);
    const existing = await this.requireUser(userId);

    if (
      dto.platformRole === PlatformRole.USER &&
      existing.platformRole === PlatformRole.SUPER_ADMIN &&
      existing.status === UserStatus.ACTIVE
    ) {
      await this.assertAnotherSuperAdminRemains(
        userId,
        'Cannot demote the last active Super Admin',
      );
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { platformRole: dto.platformRole },
      select: USER_LIST_SELECT,
    });

    await this.audit.log({
      action: 'PLATFORM_ROLE_CHANGED',
      entityType: 'User',
      entityId: user.id,
      userId: actingUserId,
      metadata: {
        targetUserId: user.id,
        previousPlatformRole: existing.platformRole,
        platformRole: user.platformRole,
      },
      req,
    });

    return { success: true as const, data: user };
  }

  private async assertAnotherSuperAdminRemains(
    excludedUserId: string,
    message: string,
  ): Promise<void> {
    const remaining = await this.prisma.user.count({
      where: {
        id: { not: excludedUserId },
        platformRole: PlatformRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    if (remaining === 0) {
      throw new UnprocessableEntityException(message);
    }
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, platformRole: true, status: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
