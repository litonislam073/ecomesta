import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  StoreStatus,
  SubscriptionStatus,
  TenantStatus,
  UserStatus,
} from '@prisma/client';
import { moneyToString } from '../../common/utils/catalog.util';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';

const RECENT_AUDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async getStats(userId: string) {
    await this.authorization.assertSuperAdmin(userId);

    const since = new Date(Date.now() - RECENT_AUDIT_WINDOW_MS);

    const [
      usersTotal,
      usersActive,
      tenantsTotal,
      tenantsActive,
      storesTotal,
      storesActive,
      subscriptionsTotal,
      subscriptionsActive,
      ordersTotal,
      revenue,
      recentAuditCount,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
      this.prisma.store.count(),
      this.prisma.store.count({ where: { status: StoreStatus.ACTIVE } }),
      this.prisma.subscription.count(),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        _sum: { grandTotal: true },
        where: { status: { not: OrderStatus.CANCELLED } },
      }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
    ]);

    return {
      success: true as const,
      data: {
        users: { total: usersTotal, active: usersActive },
        tenants: { total: tenantsTotal, active: tenantsActive },
        stores: { total: storesTotal, active: storesActive },
        subscriptions: {
          total: subscriptionsTotal,
          active: subscriptionsActive,
        },
        orders: { total: ordersTotal },
        orderRevenueSum: moneyToString(revenue._sum.grandTotal) ?? '0.00',
        recentAuditCount,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
