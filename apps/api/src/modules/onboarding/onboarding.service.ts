import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import {
  MembershipStatus,
  StoreRole,
  StoreStatus,
  SubscriptionStatus,
  TenantRole,
  TenantStatus,
} from '@prisma/client';
import { trialEndDate } from '@ecomesta/utils';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { readPlanLimits, readPlanSettings } from '../billing/plan-catalog';
import { createDefaultShipping } from '../shipping/default-shipping';
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
    private readonly affiliates: AffiliatesService,
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
    // plan and the wallet details are valid. A plan with a free trial can be
    // started without paying instead.
    const plan = await this.billing.requireActivePlan(dto.planSlug);
    const trial = dto.startTrial === true ? await this.trialFor(userId, plan) : null;
    const prepared = trial ? null : prepareWalletPayment(dto);
    const startedAt = new Date();

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
        // A referred user's first business is the one the affiliate is paid for.
        await this.affiliates.attachTenant(userId, tenant.id, tx);

        const store = await tx.store.create({
          data: {
            tenantId: tenant.id,
            name: dto.storeName,
            slug: dto.storeSlug,
            currency: dto.currency ?? 'BDT',
            timezone: dto.timezone ?? 'Asia/Dhaka',
            locale: dto.locale ?? 'en-BD',
            // A paid sign-up stays offline until the first payment is
            // confirmed (the merchant can set it up meanwhile); a free trial
            // goes live straight away.
            status: trial ? StoreStatus.ACTIVE : StoreStatus.INACTIVE,
            awaitingFirstPayment: !trial,
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

        // Ready-made delivery charges the merchant can edit or delete.
        await createDefaultShipping(tx, store.id, {
          zones: readPlanLimits(plan.configuration)?.deliveryZones ?? false,
        });

        const payment = prepared
          ? await this.payments.createPending(tx, {
              tenantId: tenant.id,
              userId,
              plan,
              billingCycle: dto.billingCycle,
              prepared,
              couponCode: dto.couponCode,
            })
          : null;
        // The trial runs on the chosen plan; paying during it starts the paid
        // period when the trial ends, so no trial days are lost.
        const subscription = trial
          ? await tx.subscription.create({
              data: {
                tenantId: tenant.id,
                planId: plan.id,
                billingCycle: dto.billingCycle,
                status: SubscriptionStatus.TRIALING,
                startsAt: startedAt,
                trialEndsAt: trialEndDate(startedAt, trial.days),
              },
            })
          : null;

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
            trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
            awaitingPayment: !subscription,
          },
          tx,
        );

        return { tenant, store, payment, subscription };
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

    if (result.payment) {
      await this.payments.auditSubmitted(result.payment, plan, userId, req);
    }
    if (result.subscription) {
      await this.audit.log({
        action: 'SUBSCRIPTION_TRIAL_STARTED',
        entityType: 'Subscription',
        entityId: result.subscription.id,
        userId,
        tenantId: result.tenant.id,
        metadata: {
          planSlug: plan.slug,
          billingCycle: result.subscription.billingCycle,
          trialDays: trial?.days ?? 0,
          trialEndsAt: result.subscription.trialEndsAt?.toISOString() ?? null,
        },
        req,
      });
    }

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
        // A paid sign-up's plan starts when the payment is approved; a trial
        // has started already.
        subscription: result.subscription
          ? {
              id: result.subscription.id,
              status: result.subscription.status,
              planSlug: plan.slug,
              billingCycle: result.subscription.billingCycle,
              trialEndsAt: result.subscription.trialEndsAt,
            }
          : null,
        payment: result.payment ? this.payments.toMerchantDto(result.payment) : null,
      },
    };
  }

  /**
   * The free trial a sign-up may start: the plan must offer one, and each
   * person gets one trial — someone who already owns a business pays instead.
   */
  private async trialFor(userId: string, plan: { configuration: Parameters<typeof readPlanSettings>[0]; name: string }) {
    const days = readPlanSettings(plan.configuration).trialDays;
    if (days <= 0) {
      throw new UnprocessableEntityException(`${plan.name} has no free trial. Pay for the plan to create your store.`);
    }
    const ownsBusiness = await this.prisma.tenantUser.count({
      where: { userId, role: TenantRole.OWNER },
    });
    if (ownsBusiness > 0) {
      throw new ConflictException('The free trial is for your first store. Pay for the plan to create another store.');
    }
    return { days };
  }
}
