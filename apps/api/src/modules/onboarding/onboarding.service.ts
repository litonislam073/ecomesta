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
import { BillingService } from '../billing/billing.service';
import {
  BillingPaymentsService,
  billingPaymentConflict,
  prepareWalletPayment,
} from '../billing/billing-payments.service';
import { EmailService } from '../email/email.service';
import {
  STORE_SLUG_TAKEN_MESSAGE,
  assertStoreSlugAvailable,
  isUniqueConstraintError,
} from '../stores/store-slug';
import { OnboardStoreDto } from './dto/onboard-store.dto';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
    private readonly payments: BillingPaymentsService,
    private readonly email: EmailService,
  ) {}

  async createTenantAndStore(userId: string, dto: OnboardStoreDto, req?: Request) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
      select: { id: true },
    });
    if (existingTenant) {
      throw new ConflictException('Tenant slug is already taken');
    }
    await assertStoreSlugAvailable(this.prisma, dto.storeSlug);
    // Payment is the last step of sign-up: nothing is created unless the
    // plan and the wallet details are valid.
    const plan = await this.billing.requireActivePlan(dto.planSlug);
    const prepared = prepareWalletPayment(dto);

    const result = await this.prisma
      .$transaction(async (tx) => {
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
            currency: dto.currency ?? 'BDT',
            timezone: dto.timezone ?? 'Asia/Dhaka',
            locale: dto.locale ?? 'en-BD',
            // Offline until the first payment is confirmed; the merchant can
            // still set it up in the dashboard meanwhile.
            status: StoreStatus.INACTIVE,
            awaitingFirstPayment: true,
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

        const payment = await this.payments.createPending(tx, {
          tenantId: tenant.id,
          userId,
          plan,
          billingCycle: dto.billingCycle,
          prepared,
        });

        const owner = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { firstName: true },
        });
        await this.email.sendStoreCreated(
          { userId, tenantId: tenant.id, storeId: store.id },
          {
            firstName: owner.firstName,
            storeName: store.name,
            storeSlug: store.slug,
            planName: plan.name,
            billingCycle: dto.billingCycle,
            trialEndsAt: null,
            awaitingPayment: true,
          },
          tx,
        );

        return { tenant, store, payment };
      })
      .catch((error: unknown) => {
        // A reused transaction ID is reported as such, not as a taken slug.
        const paymentConflict = billingPaymentConflict(error);
        if (paymentConflict) throw paymentConflict;
        // A concurrent onboarding claimed the tenant or store slug first.
        if (isUniqueConstraintError(error)) {
          throw new ConflictException(STORE_SLUG_TAKEN_MESSAGE);
        }
        throw error;
      });
    this.email.dispatchPending();

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

    await this.payments.auditSubmitted(result.payment, plan, userId, req);

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
        // The plan starts when the payment is approved.
        subscription: null,
        payment: this.payments.toMerchantDto(result.payment),
      },
    };
  }
}
