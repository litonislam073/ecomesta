import { Injectable } from '@nestjs/common';
import { AffiliatePayoutStatus, AffiliateStatus, BillingPaymentStatus, PlatformRole } from '@prisma/client';
import type { AdminBadges } from '@ecomesta/types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Sidebar counters for the Super Admin console: payments and theme purchases
 * waiting for review, affiliate applications and withdrawals, and accounts created since this admin last opened Users.
 */
@Injectable()
export class AdminBadgesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(adminUserId: string): Promise<{ success: true; data: AdminBadges }> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminUserId }, select: { adminUsersSeenAt: true } });
    let seenAt = admin?.adminUsersSeenAt ?? null;
    if (!seenAt) {
      // First visit: start counting from now rather than flagging every existing account.
      seenAt = new Date();
      await this.prisma.user.update({ where: { id: adminUserId }, data: { adminUsersSeenAt: seenAt } });
    }
    const [newUsers, pendingPayments, pendingThemePurchases, pendingAffiliates, pendingAffiliatePayouts] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gt: seenAt }, platformRole: { not: PlatformRole.SUPER_ADMIN } } }),
      this.prisma.billingPayment.count({ where: { status: BillingPaymentStatus.PENDING } }),
      this.prisma.themePurchase.count({ where: { status: BillingPaymentStatus.PENDING } }),
      this.prisma.affiliate.count({ where: { status: AffiliateStatus.PENDING } }),
      this.prisma.affiliatePayout.count({ where: { status: AffiliatePayoutStatus.REQUESTED } }),
    ]);
    return {
      success: true,
      data: { newUsers, pendingPayments, pendingThemePurchases, pendingAffiliates, pendingAffiliatePayouts },
    };
  }

  /** The admin opened the Users list: the "new users" badge starts again from now. */
  async markUsersSeen(adminUserId: string): Promise<{ success: true; data: AdminBadges }> {
    await this.prisma.user.update({ where: { id: adminUserId }, data: { adminUsersSeenAt: new Date() } });
    return this.get(adminUserId);
  }
}
