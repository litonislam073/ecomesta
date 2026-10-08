import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingPaymentStatus, ManualPaymentMethod, Prisma, TenantRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { prepareWalletPayment } from '../billing/billing-payments.service';
import { ThemeAccessService, isPremiumTheme } from './theme-access.service';
import { publishedThemeCacheKey } from './theme-cache';

const PURCHASE_INCLUDE = {
  theme: { select: { id: true, slug: true, name: true } },
  tenant: { select: { id: true, name: true, slug: true } },
  submittedBy: { select: { email: true, firstName: true, lastName: true } },
  reviewedBy: { select: { email: true } },
} satisfies Prisma.ThemePurchaseInclude;

type PurchaseRow = Prisma.ThemePurchaseGetPayload<{ include: typeof PURCHASE_INCLUDE }>;

/**
 * Premium themes bought by mobile wallet. Submitting records the payment;
 * the theme unlocks for every store of the business only when a Super Admin
 * approves it. The amount always comes from the theme, never the client.
 */
@Injectable()
export class ThemePurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly access: ThemeAccessService,
  ) {}

  async purchase(
    userId: string,
    storeId: string,
    themeId: string,
    input: { method: ManualPaymentMethod; senderNumber: string; transactionId: string },
    req?: Request,
  ) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { id: true, tenantId: true } });
    if (!store) throw new NotFoundException('Store not found');
    // Paying is for the business owner or an admin, as for plan payments.
    await this.authorization.assertTenantRole(userId, store.tenantId, [TenantRole.OWNER, TenantRole.ADMIN]);

    const theme = await this.prisma.theme.findFirst({ where: { id: themeId, active: true } });
    if (!theme || !isPremiumTheme(theme)) throw new NotFoundException('This theme is not for sale');

    const access = await this.access.accessForTheme(store.tenantId, theme);
    if (access === 'included') throw new ConflictException(`${theme.name} is already included in your plan.`);
    if (access === 'owned') throw new ConflictException(`You already own ${theme.name}.`);
    if (access === 'pending') {
      throw new ConflictException(`Your payment for ${theme.name} is already waiting for review. We will confirm it shortly.`);
    }

    const prepared = prepareWalletPayment(input);
    // A wallet transaction pays for one thing only: a plan or a theme.
    const usedForPlan = await this.prisma.billingPayment.findFirst({
      where: { method: prepared.method, transactionId: prepared.transactionId },
      select: { id: true },
    });
    if (usedForPlan) throw this.transactionUsed();

    let created: PurchaseRow;
    try {
      created = await this.prisma.themePurchase.create({
        data: {
          tenantId: store.tenantId,
          themeId: theme.id,
          amount: theme.priceBdt!,
          method: prepared.method,
          payToNumber: prepared.account.number,
          senderNumber: prepared.senderNumber,
          transactionId: prepared.transactionId,
          submittedByUserId: userId,
        },
        include: PURCHASE_INCLUDE,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = JSON.stringify(err.meta?.target ?? '');
        throw target.includes('transaction')
          ? this.transactionUsed()
          : new ConflictException(`Your payment for ${theme.name} is already waiting for review.`);
      }
      throw err;
    }

    await this.audit.log({
      action: 'THEME_PURCHASE_SUBMITTED',
      entityType: 'ThemePurchase',
      entityId: created.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { theme: theme.slug, amount: created.amount.toFixed(2), method: created.method },
      req,
    });
    return { success: true as const, data: this.toMerchantDto(created) };
  }

  async adminList(query: { status?: BillingPaymentStatus; page?: number; limit?: number }) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const page = Math.max(query.page ?? 1, 1);
    const where: Prisma.ThemePurchaseWhereInput = query.status ? { status: query.status } : {};
    const [rows, total, pendingCount] = await this.prisma.$transaction([
      this.prisma.themePurchase.findMany({
        where,
        include: PURCHASE_INCLUDE,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.themePurchase.count({ where }),
      this.prisma.themePurchase.count({ where: { status: BillingPaymentStatus.PENDING } }),
    ]);
    return {
      success: true as const,
      data: {
        items: rows.map((row) => this.toAdminDto(row)),
        meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
        pendingCount,
      },
    };
  }

  async approve(adminUserId: string, purchaseId: string, req?: Request) {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM theme_purchases WHERE id = ${purchaseId}::uuid FOR UPDATE`;
      const purchase = await tx.themePurchase.findUnique({ where: { id: purchaseId } });
      if (!purchase) throw new NotFoundException('Theme purchase not found');
      if (purchase.status === BillingPaymentStatus.REJECTED) {
        throw new ConflictException('This payment was rejected and cannot be approved');
      }
      if (purchase.status === BillingPaymentStatus.APPROVED) {
        return tx.themePurchase.findUniqueOrThrow({ where: { id: purchaseId }, include: PURCHASE_INCLUDE });
      }
      return tx.themePurchase.update({
        where: { id: purchaseId },
        data: { status: BillingPaymentStatus.APPROVED, reviewedByUserId: adminUserId, reviewedAt: new Date() },
        include: PURCHASE_INCLUDE,
      });
    });
    await this.audit.log({
      action: 'THEME_PURCHASE_APPROVED',
      entityType: 'ThemePurchase',
      entityId: row.id,
      userId: adminUserId,
      tenantId: row.tenantId,
      metadata: { theme: row.theme.slug, amount: row.amount.toFixed(2) },
      req,
    });
    await this.invalidateTenantThemes(row.tenantId);
    return { success: true as const, data: this.toAdminDto(row) };
  }

  async reject(adminUserId: string, purchaseId: string, reason: string, req?: Request) {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM theme_purchases WHERE id = ${purchaseId}::uuid FOR UPDATE`;
      const purchase = await tx.themePurchase.findUnique({ where: { id: purchaseId } });
      if (!purchase) throw new NotFoundException('Theme purchase not found');
      if (purchase.status !== BillingPaymentStatus.PENDING) {
        throw new ConflictException('Only a payment waiting for review can be rejected');
      }
      return tx.themePurchase.update({
        where: { id: purchaseId },
        data: {
          status: BillingPaymentStatus.REJECTED,
          rejectionReason: reason.trim(),
          reviewedByUserId: adminUserId,
          reviewedAt: new Date(),
        },
        include: PURCHASE_INCLUDE,
      });
    });
    await this.audit.log({
      action: 'THEME_PURCHASE_REJECTED',
      entityType: 'ThemePurchase',
      entityId: row.id,
      userId: adminUserId,
      tenantId: row.tenantId,
      metadata: { theme: row.theme.slug, reason: row.rejectionReason },
      req,
    });
    // A store showing a theme it no longer may use falls back at once.
    await this.invalidateTenantThemes(row.tenantId);
    return { success: true as const, data: this.toAdminDto(row) };
  }

  /** Latest purchase per theme for the store's business (for the merchant theme list). */
  async latestForTenant(tenantId: string) {
    const rows = await this.prisma.themePurchase.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { themeId: true, status: true, rejectionReason: true, transactionId: true, createdAt: true },
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!latest.has(row.themeId)) latest.set(row.themeId, row);
    return latest;
  }

  private async invalidateTenantThemes(tenantId: string) {
    const stores = await this.prisma.store.findMany({ where: { tenantId }, select: { id: true } });
    try {
      if (stores.length) await this.redis.getClient().del(...stores.map((store) => publishedThemeCacheKey(store.id)));
    } catch {
      /* best effort: the 60 s cache expires on its own */
    }
  }

  private transactionUsed() {
    return new ConflictException('This transaction ID has already been submitted. Check the ID in your payment message.');
  }

  private toMerchantDto(row: PurchaseRow) {
    return {
      id: row.id,
      theme: row.theme,
      amount: row.amount.toFixed(2),
      currency: row.currency,
      method: row.method,
      senderNumber: row.senderNumber,
      transactionId: row.transactionId,
      status: row.status,
      rejectionReason: row.rejectionReason,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toAdminDto(row: PurchaseRow) {
    return {
      ...this.toMerchantDto(row),
      payToNumber: row.payToNumber,
      tenant: row.tenant,
      submittedBy: row.submittedBy,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }
}
