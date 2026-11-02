import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  PlatformRole,
  StoreRole,
  StoreStatus,
  TenantRole,
  TenantStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async isSuperAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true, status: true },
    });
    return (
      user?.platformRole === PlatformRole.SUPER_ADMIN &&
      user.status === UserStatus.ACTIVE
    );
  }

  /** Platform control-plane gate — DB-backed, not JWT-only. */
  async assertSuperAdmin(userId: string): Promise<void> {
    if (!(await this.isSuperAdmin(userId))) {
      throw new ForbiddenException('Super Admin access required');
    }
  }

  async getTenantMembership(userId: string, tenantId: string) {
    return this.prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: { tenantId, userId },
      },
    });
  }

  async getStoreMembership(userId: string, storeId: string) {
    return this.prisma.storeUser.findUnique({
      where: {
        storeId_userId: { storeId, userId },
      },
    });
  }

  async hasTenantAccess(userId: string, tenantId: string): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) {
      return true;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });
    if (!tenant || tenant.status === TenantStatus.SUSPENDED) {
      return false;
    }

    const membership = await this.getTenantMembership(userId, tenantId);
    return membership?.status === MembershipStatus.ACTIVE;
  }

  async hasTenantRole(
    userId: string,
    tenantId: string,
    roles: TenantRole[],
  ): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) {
      return true;
    }

    if (!(await this.hasTenantAccess(userId, tenantId))) {
      return false;
    }

    const membership = await this.getTenantMembership(userId, tenantId);
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      return false;
    }

    return roles.includes(membership.role);
  }

  async hasStoreAccess(userId: string, storeId: string): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) {
      return true;
    }

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        tenantId: true,
        status: true,
        tenant: { select: { status: true } },
      },
    });
    if (!store) {
      return false;
    }
    if (store.status === StoreStatus.SUSPENDED) {
      return false;
    }
    if (store.tenant.status === TenantStatus.SUSPENDED) {
      return false;
    }

    const storeMembership = await this.getStoreMembership(userId, storeId);
    if (storeMembership?.status === MembershipStatus.ACTIVE) {
      return true;
    }

    // Tenant OWNER/ADMIN may manage all stores under the tenant.
    return this.hasTenantRole(userId, store.tenantId, [
      TenantRole.OWNER,
      TenantRole.ADMIN,
    ]);
  }

  async hasStoreRole(
    userId: string,
    storeId: string,
    roles: StoreRole[],
  ): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) {
      return true;
    }

    if (!(await this.hasStoreAccess(userId, storeId))) {
      return false;
    }

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { tenantId: true },
    });
    if (!store) {
      return false;
    }

    // Tenant OWNER/ADMIN implied elevated store access for management actions.
    if (
      await this.hasTenantRole(userId, store.tenantId, [
        TenantRole.OWNER,
        TenantRole.ADMIN,
      ])
    ) {
      return true;
    }

    const membership = await this.getStoreMembership(userId, storeId);
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      return false;
    }

    return roles.includes(membership.role);
  }

  async assertTenantAccess(userId: string, tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!(await this.hasTenantAccess(userId, tenantId))) {
      if (
        tenant.status === TenantStatus.SUSPENDED &&
        !(await this.isSuperAdmin(userId))
      ) {
        throw new ForbiddenException('This tenant is suspended');
      }
      throw new ForbiddenException('You do not have access to this tenant');
    }
  }

  async assertTenantRole(
    userId: string,
    tenantId: string,
    roles: TenantRole[],
  ): Promise<void> {
    await this.assertTenantAccess(userId, tenantId);

    if (!(await this.hasTenantRole(userId, tenantId, roles))) {
      throw new ForbiddenException('Insufficient tenant role');
    }
  }

  /**
   * Same rules as hasStoreAccess/hasStoreRole, evaluated with two parallel
   * round trips (user+store, then memberships) instead of ~15 sequential
   * queries, which dominated every merchant write on a remote database.
   */
  private async resolveStoreAccess(userId: string, storeId: string) {
    const [superAdmin, store] = await Promise.all([
      this.isSuperAdmin(userId),
      this.prisma.store.findUnique({
        where: { id: storeId },
        select: {
          id: true,
          tenantId: true,
          status: true,
          tenant: { select: { status: true } },
        },
      }),
    ]);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    if (superAdmin) {
      return {
        store,
        superAdmin,
        access: true,
        elevated: true,
        storeMembership: null,
      };
    }

    const [storeMembership, tenantMembership] = await Promise.all([
      this.getStoreMembership(userId, storeId),
      this.getTenantMembership(userId, store.tenantId),
    ]);
    const suspended =
      store.status === StoreStatus.SUSPENDED ||
      store.tenant.status === TenantStatus.SUSPENDED;
    const storeActive = storeMembership?.status === MembershipStatus.ACTIVE;
    const elevated =
      tenantMembership?.status === MembershipStatus.ACTIVE &&
      (tenantMembership.role === TenantRole.OWNER ||
        tenantMembership.role === TenantRole.ADMIN);
    return {
      store,
      superAdmin,
      access: !suspended && (storeActive || elevated),
      elevated,
      storeMembership,
    };
  }

  async assertStoreAccess(userId: string, storeId: string): Promise<void> {
    const { store, superAdmin, access } = await this.resolveStoreAccess(
      userId,
      storeId,
    );
    if (access) return;
    if (!superAdmin) {
      if (store.tenant.status === TenantStatus.SUSPENDED) {
        throw new ForbiddenException('This tenant is suspended');
      }
      if (store.status === StoreStatus.SUSPENDED) {
        throw new ForbiddenException('This store is suspended');
      }
    }
    throw new ForbiddenException('You do not have access to this store');
  }

  async assertStoreRole(
    userId: string,
    storeId: string,
    roles: StoreRole[],
  ): Promise<void> {
    const { store, superAdmin, access, elevated, storeMembership } =
      await this.resolveStoreAccess(userId, storeId);
    if (!access) {
      if (!superAdmin) {
        if (store.tenant.status === TenantStatus.SUSPENDED) {
          throw new ForbiddenException('This tenant is suspended');
        }
        if (store.status === StoreStatus.SUSPENDED) {
          throw new ForbiddenException('This store is suspended');
        }
      }
      throw new ForbiddenException('You do not have access to this store');
    }
    if (elevated) return;
    if (
      storeMembership?.status === MembershipStatus.ACTIVE &&
      roles.includes(storeMembership.role)
    ) {
      return;
    }
    throw new ForbiddenException('Insufficient store role');
  }

  async listAccessibleStoreIds(userId: string): Promise<string[]> {
    if (await this.isSuperAdmin(userId)) {
      // Merchant APIs stay scoped — Super Admin uses explicit admin routes.
      return [];
    }

    const [storeMemberships, elevatedTenants] = await Promise.all([
      this.prisma.storeUser.findMany({
        where: { userId, status: MembershipStatus.ACTIVE },
        select: { storeId: true },
      }),
      this.prisma.tenantUser.findMany({
        where: {
          userId,
          status: MembershipStatus.ACTIVE,
          role: { in: [TenantRole.OWNER, TenantRole.ADMIN] },
        },
        select: { tenantId: true },
      }),
    ]);

    const elevatedStores =
      elevatedTenants.length === 0
        ? []
        : await this.prisma.store.findMany({
            where: {
              tenantId: { in: elevatedTenants.map((item) => item.tenantId) },
              status: { not: StoreStatus.SUSPENDED },
              tenant: { status: { not: TenantStatus.SUSPENDED } },
            },
            select: { id: true },
          });

    const membershipStoreIds = storeMemberships.map((item) => item.storeId);
    const membershipStores =
      membershipStoreIds.length === 0
        ? []
        : await this.prisma.store.findMany({
            where: {
              id: { in: membershipStoreIds },
              status: { not: StoreStatus.SUSPENDED },
              tenant: { status: { not: TenantStatus.SUSPENDED } },
            },
            select: { id: true },
          });

    return Array.from(
      new Set([
        ...membershipStores.map((item) => item.id),
        ...elevatedStores.map((item) => item.id),
      ]),
    );
  }
}
