import { ConflictException, Injectable } from '@nestjs/common';
import {
  BillingCycle,
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
import { SubscriptionLifecycleService } from '../billing/subscription-lifecycle.service';
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
    private readonly lifecycle: SubscriptionLifecycleService,
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
    const plan = dto.planSlug ? await this.billing.requireActivePlan(dto.planSlug) : null;

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
            status: StoreStatus.ACTIVE,
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

        const subscription = plan
          ? await this.lifecycle.startTrial(tx, {
              tenantId: tenant.id,
              plan,
              billingCycle: dto.billingCycle ?? BillingCycle.MONTHLY,
            })
          : null;

        return { tenant, store, subscription };
      })
      .catch((error: unknown) => {
        // A concurrent onboarding claimed the tenant or store slug first.
        if (isUniqueConstraintError(error)) {
          throw new ConflictException(STORE_SLUG_TAKEN_MESSAGE);
        }
        throw error;
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

    if (result.subscription && plan) {
      await this.audit.log({
        action: 'SUBSCRIPTION_TRIAL_STARTED',
        entityType: 'Subscription',
        entityId: result.subscription.id,
        userId,
        tenantId: result.tenant.id,
        metadata: {
          planSlug: plan.slug,
          billingCycle: result.subscription.billingCycle,
          trialEndsAt: result.subscription.trialEndsAt?.toISOString() ?? null,
          via: 'onboarding',
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
        subscription:
          result.subscription && plan
            ? {
                status: result.subscription.status,
                billingCycle: result.subscription.billingCycle,
                startsAt: result.subscription.startsAt,
                trialEndsAt: result.subscription.trialEndsAt,
                plan: { name: plan.name, slug: plan.slug },
              }
            : null,
      },
    };
  }
}
