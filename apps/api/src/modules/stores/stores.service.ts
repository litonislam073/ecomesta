import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  StoreRole,
  StoreStatus,
  TenantRole,
} from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { EmailService } from '../email/email.service';
import { CreateStoreDto } from './dto/create-store.dto';
import {
  STORE_SLUG_TAKEN_MESSAGE,
  assertStoreSlugAvailable,
  isUniqueConstraintError,
} from './store-slug';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly billingAccess: BillingAccessService,
    private readonly email: EmailService,
  ) {}

  async createForTenant(
    userId: string,
    tenantId: string,
    dto: CreateStoreDto,
    req?: Request,
  ) {
    await this.authorization.assertTenantRole(userId, tenantId, [
      TenantRole.OWNER,
      TenantRole.ADMIN,
    ]);
    await this.billingAccess.assertTenantCanOperate(tenantId);

    await assertStoreSlugAvailable(this.prisma, dto.slug);

    const result = await this.prisma
      .$transaction(async (tx) => {
        const store = await tx.store.create({
          data: {
            tenantId,
            name: dto.name,
            slug: dto.slug,
            currency: dto.currency ?? 'BDT',
            timezone: dto.timezone ?? 'Asia/Dhaka',
            locale: dto.locale ?? 'en-BD',
            status: StoreStatus.DRAFT,
          },
        });

        const membership = await tx.storeUser.create({
          data: {
            storeId: store.id,
            userId,
            role: StoreRole.STORE_MANAGER,
            status: MembershipStatus.ACTIVE,
          },
        });

        const owner = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { firstName: true },
        });
        await this.email.sendStoreCreated(
          { userId, tenantId, storeId: store.id },
          {
            firstName: owner.firstName,
            storeName: store.name,
            storeSlug: store.slug,
            planName: null,
            billingCycle: null,
            trialEndsAt: null,
          },
          tx,
        );

        return { store, membership };
      })
      .catch((error: unknown) => {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException(STORE_SLUG_TAKEN_MESSAGE);
        }
        throw error;
      });
    this.email.dispatchPending();

    await this.audit.log({
      action: 'STORE_CREATED',
      entityType: 'Store',
      entityId: result.store.id,
      userId,
      tenantId,
      storeId: result.store.id,
      metadata: { slug: result.store.slug },
      req,
    });

    return {
      success: true as const,
      data: {
        ...this.toStoreDto(result.store),
        membership: {
          role: result.membership.role,
          status: result.membership.status,
        },
      },
    };
  }

  async listForTenant(userId: string, tenantId: string) {
    await this.authorization.assertTenantAccess(userId, tenantId);

    const isElevated =
      (await this.authorization.isSuperAdmin(userId)) ||
      (await this.authorization.hasTenantRole(userId, tenantId, [
        TenantRole.OWNER,
        TenantRole.ADMIN,
      ]));

    if (isElevated) {
      const stores = await this.prisma.store.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      return {
        success: true as const,
        data: stores.map((store) => this.toStoreDto(store)),
      };
    }

    const memberships = await this.prisma.storeUser.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        store: { tenantId },
      },
      include: { store: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true as const,
      data: memberships.map((membership) => ({
        ...this.toStoreDto(membership.store),
        membership: {
          role: membership.role,
          status: membership.status,
        },
      })),
    };
  }

  async listAccessible(userId: string) {
    const storeIds = await this.authorization.listAccessibleStoreIds(userId);
    if (storeIds.length === 0) {
      return { success: true as const, data: [] };
    }

    const stores = await this.prisma.store.findMany({
      where: { id: { in: storeIds } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true as const,
      data: stores.map((store) => this.toStoreDto(store)),
    };
  }

  async getById(userId: string, storeId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const membership = await this.authorization.getStoreMembership(
      userId,
      storeId,
    );

    return {
      success: true as const,
      data: {
        ...this.toStoreDto(store),
        membership: membership
          ? { role: membership.role, status: membership.status }
          : null,
      },
    };
  }

  private toStoreDto(store: {
    id: string;
    tenantId: string;
    name: string;
    slug: string;
    description: string | null;
    status: StoreStatus;
    currency: string;
    timezone: string;
    locale: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: store.id,
      tenantId: store.tenantId,
      name: store.name,
      slug: store.slug,
      description: store.description,
      status: store.status,
      currency: store.currency,
      timezone: store.timezone,
      locale: store.locale,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };
  }
}
