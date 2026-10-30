import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, StoreStatus } from '@prisma/client';
import type { Request } from 'express';
import { isValidSlug, normalizeSlug } from '../../common/utils/slug.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { isReservedStoreSlug } from '../domains/domain-normalize';

/**
 * Placeholder address a soft-deleted store keeps so its real one is free. The
 * double hyphen never passes slug validation, so no merchant can claim it.
 */
export function deletedStorePlaceholderSlug(storeId: string): string {
  return `deleted--${storeId}`;
}

const STORE_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
  tenantId: true,
  deletedAt: true,
  deletedSlug: true,
  statusBeforeDeletion: true,
} as const;

/**
 * Removing a store a merchant opened by mistake. Soft delete takes it offline,
 * hides it from the merchant and frees its address, and can be undone; permanent
 * delete erases the store and everything in it. The business (tenant), its plan
 * and its billing history stay either way, so the merchant can open a new store
 * on the same plan.
 */
@Injectable()
export class AdminStoreDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async softDelete(actingUserId: string, storeId: string, reason: string | undefined, req?: Request) {
    await this.authorization.assertSuperAdmin(actingUserId);
    const store = await this.requireStore(storeId);
    if (store.deletedAt) throw new ConflictException('This store is already deleted.');

    const now = new Date();
    const deactivated = await this.prisma.$transaction(async (tx) => {
      await tx.store.update({
        where: { id: store.id },
        data: {
          deletedAt: now,
          deletedSlug: store.slug,
          slug: deletedStorePlaceholderSlug(store.id),
          statusBeforeDeletion: store.status,
          // Offline, and out of reach of billing: neither a payment approval
          // nor the end of a billing suspension may bring it back.
          status: StoreStatus.SUSPENDED,
          statusBeforeBillingSuspension: null,
          awaitingFirstPayment: false,
        },
      });
      // The merchant loses the store; restore gives these memberships back.
      const { count } = await tx.storeUser.updateMany({
        where: { storeId: store.id, status: MembershipStatus.ACTIVE },
        data: { status: MembershipStatus.INACTIVE },
      });
      return count;
    });

    await this.audit.log({
      action: 'STORE_SOFT_DELETED',
      entityType: 'Store',
      entityId: store.id,
      userId: actingUserId,
      tenantId: store.tenantId,
      storeId: store.id,
      metadata: {
        name: store.name,
        slug: store.slug,
        previousStatus: store.status,
        membershipsDeactivated: deactivated,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      },
      req,
    });
    return { success: true as const, data: await this.summary(store.id) };
  }

  /** Brings a soft-deleted store back, on its old address unless another store took it. */
  async restore(actingUserId: string, storeId: string, newSlug: string | undefined, req?: Request) {
    await this.authorization.assertSuperAdmin(actingUserId);
    const store = await this.requireStore(storeId);
    if (!store.deletedAt) throw new ConflictException('This store is not deleted.');

    const slug = normalizeSlug(newSlug ?? store.deletedSlug ?? '');
    if (!isValidSlug(slug)) {
      throw new BadRequestException({ message: 'Give the store a valid address.', error: 'SLUG_INVALID' });
    }
    const taken =
      isReservedStoreSlug(slug) ||
      (await this.prisma.store.findFirst({ where: { slug, id: { not: store.id } }, select: { id: true } }));
    if (taken) {
      throw new ConflictException({
        message: newSlug
          ? `The address "${slug}" is already used. Choose another one.`
          : `The old address "${slug}" is now used by another store. Give this store a new address.`,
        error: 'SLUG_TAKEN',
      });
    }

    const restoredStatus = store.statusBeforeDeletion ?? StoreStatus.INACTIVE;
    const reactivated = await this.prisma.$transaction(async (tx) => {
      await tx.store.update({
        where: { id: store.id },
        data: { deletedAt: null, deletedSlug: null, statusBeforeDeletion: null, slug, status: restoredStatus },
      });
      const { count } = await tx.storeUser.updateMany({
        where: { storeId: store.id, status: MembershipStatus.INACTIVE },
        data: { status: MembershipStatus.ACTIVE },
      });
      return count;
    });

    await this.audit.log({
      action: 'STORE_RESTORED',
      entityType: 'Store',
      entityId: store.id,
      userId: actingUserId,
      tenantId: store.tenantId,
      storeId: store.id,
      metadata: { name: store.name, slug, status: restoredStatus, membershipsReactivated: reactivated },
      req,
    });
    return { success: true as const, data: await this.summary(store.id) };
  }

  /**
   * Erases the store and everything in it, in an order the foreign keys allow.
   * The caller types the store's address to confirm.
   */
  async deletePermanently(actingUserId: string, storeId: string, confirmSlug: string, req?: Request) {
    await this.authorization.assertSuperAdmin(actingUserId);
    const store = await this.requireStore(storeId);
    const address = store.deletedSlug ?? store.slug;
    if (normalizeSlug(confirmSlug) !== address) {
      throw new BadRequestException({
        message: `Type the store address "${address}" to confirm.`,
        error: 'CONFIRMATION_MISMATCH',
      });
    }

    const counts = await this.prisma.$transaction(
      async (tx) => {
        const storeId = store.id;
        const orders = { order: { storeId } };
        const removed = {
          orders: 0,
          products: 0,
          customers: 0,
          media: 0,
        };
        await tx.couponUsage.deleteMany({ where: { OR: [{ coupon: { storeId } }, orders] } });
        await tx.payment.deleteMany({ where: { storeId } });
        await tx.shipment.deleteMany({ where: { storeId } });
        await tx.orderItem.deleteMany({ where: orders });
        removed.orders = (await tx.order.deleteMany({ where: { storeId } })).count;
        await tx.coupon.deleteMany({ where: { storeId } });
        await tx.inventoryMovement.deleteMany({ where: { storeId } });
        await tx.inventoryItem.deleteMany({ where: { storeId } });
        removed.products = (await tx.product.deleteMany({ where: { storeId } })).count;
        await tx.productVariant.deleteMany({ where: { storeId } });
        // Sub-categories point at their parent; unhook them before deleting.
        await tx.category.updateMany({ where: { storeId }, data: { parentId: null } });
        await tx.category.deleteMany({ where: { storeId } });
        removed.customers = (await tx.customer.deleteMany({ where: { storeId } })).count;
        await tx.shippingMethod.deleteMany({ where: { storeId } });
        await tx.shippingZone.deleteMany({ where: { storeId } });
        // Images live in the database, so this also frees the business's storage.
        removed.media = (await tx.media.deleteMany({ where: { storeId } })).count;
        await tx.domain.deleteMany({ where: { storeId } });
        // Memberships, payment settings, couriers, themes, landing pages and
        // analytics are removed with the store (cascade).
        await tx.store.delete({ where: { id: storeId } });
        return removed;
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    await this.audit.log({
      action: 'STORE_PERMANENTLY_DELETED',
      entityType: 'Store',
      entityId: store.id,
      userId: actingUserId,
      tenantId: store.tenantId,
      metadata: { name: store.name, slug: address, wasSoftDeleted: store.deletedAt !== null, removed: counts },
      req,
    });
    return { success: true as const, data: { id: store.id, deleted: true, removed: counts } };
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: STORE_SELECT });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  private summary(storeId: string) {
    return this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { ...STORE_SELECT, createdAt: true, updatedAt: true },
    });
  }
}
