import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  PlatformRole,
  TenantRole,
  TenantStatus,
} from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateTenantDto, req?: Request) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Tenant slug is already taken');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          status: TenantStatus.ACTIVE,
        },
      });

      const membership = await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId,
          role: TenantRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });

      return { tenant, membership };
    });

    await this.audit.log({
      action: 'TENANT_CREATED',
      entityType: 'Tenant',
      entityId: result.tenant.id,
      userId,
      tenantId: result.tenant.id,
      metadata: { slug: result.tenant.slug },
      req,
    });

    return {
      success: true as const,
      data: {
        ...this.toTenantDto(result.tenant),
        membership: {
          role: result.membership.role,
          status: result.membership.status,
        },
      },
    };
  }

  async listForUser(userId: string, platformRole: string) {
    if (platformRole === PlatformRole.SUPER_ADMIN) {
      const tenants = await this.prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return {
        success: true as const,
        data: tenants.map((tenant) => this.toTenantDto(tenant)),
      };
    }

    const memberships = await this.prisma.tenantUser.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: { tenant: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true as const,
      data: memberships.map((membership) => ({
        ...this.toTenantDto(membership.tenant),
        membership: {
          role: membership.role,
          status: membership.status,
        },
      })),
    };
  }

  async getById(userId: string, tenantId: string) {
    await this.authorization.assertTenantAccess(userId, tenantId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const membership = await this.authorization.getTenantMembership(
      userId,
      tenantId,
    );

    return {
      success: true as const,
      data: {
        ...this.toTenantDto(tenant),
        membership: membership
          ? { role: membership.role, status: membership.status }
          : null,
      },
    };
  }

  async listMembers(userId: string, tenantId: string) {
    await this.authorization.assertTenantRole(userId, tenantId, [
      TenantRole.OWNER,
      TenantRole.ADMIN,
    ]);

    const members = await this.prisma.tenantUser.findMany({
      where: { tenantId },
      include: {
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
    });

    return {
      success: true as const,
      data: members.map((member) => ({
        id: member.id,
        role: member.role,
        status: member.status,
        user: member.user,
        createdAt: member.createdAt,
      })),
    };
  }

  private toTenantDto(tenant: {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}
