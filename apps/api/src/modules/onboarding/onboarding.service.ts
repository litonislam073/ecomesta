import { ConflictException, Injectable } from '@nestjs/common';
import {
  MembershipStatus,
  StoreRole,
  StoreStatus,
  TenantRole,
  TenantStatus,
} from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OnboardStoreDto } from './dto/onboard-store.dto';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createTenantAndStore(userId: string, dto: OnboardStoreDto, req?: Request) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
      select: { id: true },
    });
    if (existingTenant) {
      throw new ConflictException('Tenant slug is already taken');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.businessName,
          slug: dto.tenantSlug,
          status: TenantStatus.ACTIVE,
        },
      });

      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId,
          role: TenantRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });

      const store = await tx.store.create({
        data: {
          tenantId: tenant.id,
          name: dto.storeName,
          slug: dto.storeSlug,
          currency: dto.currency ?? 'USD',
          timezone: dto.timezone ?? 'UTC',
          locale: dto.locale ?? 'en-US',
          status: StoreStatus.DRAFT,
        },
      });

      await tx.storeUser.create({
        data: {
          storeId: store.id,
          userId,
          role: StoreRole.STORE_MANAGER,
          status: MembershipStatus.ACTIVE,
        },
      });

      return { tenant, store };
    });

    await this.audit.log({
      action: 'TENANT_CREATED',
      entityType: 'Tenant',
      entityId: result.tenant.id,
      userId,
      tenantId: result.tenant.id,
      metadata: { slug: result.tenant.slug, via: 'onboarding' },
      req,
    });

    await this.audit.log({
      action: 'STORE_CREATED',
      entityType: 'Store',
      entityId: result.store.id,
      userId,
      tenantId: result.tenant.id,
      storeId: result.store.id,
      metadata: { slug: result.store.slug, via: 'onboarding' },
      req,
    });

    return {
      success: true as const,
      data: {
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
          status: result.tenant.status,
          createdAt: result.tenant.createdAt,
          updatedAt: result.tenant.updatedAt,
        },
        store: {
          id: result.store.id,
          tenantId: result.store.tenantId,
          name: result.store.name,
          slug: result.store.slug,
          status: result.store.status,
          currency: result.store.currency,
          timezone: result.store.timezone,
          locale: result.store.locale,
          createdAt: result.store.createdAt,
          updatedAt: result.store.updatedAt,
        },
      },
    };
  }
}
