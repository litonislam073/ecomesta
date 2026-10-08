import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentProvider,
  Prisma,
  StoreRole,
  type PaymentProviderConfig,
} from '@prisma/client';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MANUAL_PAYMENT_SELECT, assertStoreKeepsAPaymentOption } from './manual-payments';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { PaymentSecretsCryptoService } from './crypto/payment-secrets-crypto.service';
import {
  ONLINE_PAYMENT_PROVIDERS,
  PaymentProviderRegistry,
} from './providers/payment-provider.registry';
import { SslCommerzPaymentProvider } from './providers/sslcommerz/sslcommerz-payment.provider';
import { StripePaymentProvider } from './providers/stripe/stripe-payment.provider';
import {
  UpdatePaymentProviderConfigDto,
  UpsertPaymentProviderConfigDto,
} from './dto/payment-provider.dto';

@Injectable()
export class PaymentProviderConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly crypto: PaymentSecretsCryptoService,
    private readonly registry: PaymentProviderRegistry,
    private readonly stripeProvider: StripePaymentProvider,
    private readonly sslCommerzProvider: SslCommerzPaymentProvider,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  /** Turning on SSLCommerz or Stripe needs a plan that includes it; turning off never does. */
  private async assertPlanAllowsEnabling(storeId: string, provider: PaymentProvider, enabled?: boolean) {
    const feature = PlanEntitlementsService.featureForProvider(provider);
    if (enabled === true && feature) {
      await this.entitlements.assertFeature(storeId, feature);
    }
  }

  async list(userId: string, storeId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireStore(storeId);

    const rows = await this.prisma.paymentProviderConfig.findMany({
      where: { storeId },
      orderBy: { provider: 'asc' },
    });

    const implemented = this.registry.listImplementedOnline();
    const byProvider = new Map(rows.map((r) => [r.provider, r]));

    const items = ONLINE_PAYMENT_PROVIDERS.map((provider) => {
      const row = byProvider.get(provider);
      return row
        ? this.toSafeDto(row)
        : {
            provider,
            enabled: false,
            mode: 'test' as const,
            configured: false,
            hasSecrets: false,
            publicConfig: null,
            implemented: implemented.includes(provider),
            createdAt: null,
            updatedAt: null,
          };
    });

    return { success: true as const, data: items };
  }

  async upsert(
    userId: string,
    storeId: string,
    dto: UpsertPaymentProviderConfigDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    this.assertConfigurable(dto.provider);
    await this.assertPlanAllowsEnabling(storeId, dto.provider, dto.enabled);
    if (dto.enabled === false) {
      const manual = await this.prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: MANUAL_PAYMENT_SELECT });
      await assertStoreKeepsAPaymentOption(this.prisma, this.entitlements, storeId, { manual, disablingProvider: dto.provider });
    }

    if (dto.secrets) {
      this.assertSecretsShape(dto.provider, dto.secrets);
    }

    const encryptedSecrets =
      dto.secrets !== undefined
        ? this.crypto.encryptJson(dto.secrets)
        : undefined;

    const row = await this.prisma.paymentProviderConfig.upsert({
      where: {
        storeId_provider: { storeId, provider: dto.provider },
      },
      create: {
        storeId,
        provider: dto.provider,
        enabled: dto.enabled ?? false,
        mode: dto.mode ?? 'test',
        publicConfig:
          dto.publicConfig === undefined
            ? undefined
            : (dto.publicConfig as Prisma.InputJsonValue),
        encryptedSecrets: encryptedSecrets ?? null,
      },
      update: {
        enabled: dto.enabled,
        mode: dto.mode,
        publicConfig:
          dto.publicConfig === undefined
            ? undefined
            : (dto.publicConfig as Prisma.InputJsonValue),
        ...(encryptedSecrets !== undefined
          ? { encryptedSecrets }
          : {}),
      },
    });

    await this.audit.log({
      action: 'PAYMENT_PROVIDER_CREATED',
      entityType: 'PaymentProviderConfig',
      entityId: row.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        provider: row.provider,
        enabled: row.enabled,
        mode: row.mode,
        hasSecrets: Boolean(row.encryptedSecrets),
      },
      req,
    });

    return { success: true as const, data: this.toSafeDto(row) };
  }

  async update(
    userId: string,
    storeId: string,
    provider: PaymentProvider,
    dto: UpdatePaymentProviderConfigDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    this.assertConfigurable(provider);
    await this.assertPlanAllowsEnabling(storeId, provider, dto.enabled);

    const existing = await this.prisma.paymentProviderConfig.findUnique({
      where: { storeId_provider: { storeId, provider } },
    });
    if (!existing) {
      throw new NotFoundException('Payment provider config not found');
    }

    if (dto.secrets) {
      this.assertSecretsShape(provider, dto.secrets);
    }

    const row = await this.prisma.paymentProviderConfig.update({
      where: { id: existing.id },
      data: {
        enabled: dto.enabled,
        mode: dto.mode,
        publicConfig:
          dto.publicConfig === undefined
            ? undefined
            : (dto.publicConfig as Prisma.InputJsonValue),
        ...(dto.secrets !== undefined
          ? { encryptedSecrets: this.crypto.encryptJson(dto.secrets) }
          : {}),
      },
    });

    await this.audit.log({
      action: row.enabled
        ? 'PAYMENT_PROVIDER_UPDATED'
        : 'PAYMENT_PROVIDER_DISABLED',
      entityType: 'PaymentProviderConfig',
      entityId: row.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        provider: row.provider,
        enabled: row.enabled,
        mode: row.mode,
        hasSecrets: Boolean(row.encryptedSecrets),
      },
      req,
    });

    return { success: true as const, data: this.toSafeDto(row) };
  }

  async remove(
    userId: string,
    storeId: string,
    provider: PaymentProvider,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.prisma.paymentProviderConfig.findUnique({
      where: { storeId_provider: { storeId, provider } },
    });
    if (!existing) {
      throw new NotFoundException('Payment provider config not found');
    }

    await this.prisma.paymentProviderConfig.delete({ where: { id: existing.id } });

    await this.audit.log({
      action: 'PAYMENT_PROVIDER_DISABLED',
      entityType: 'PaymentProviderConfig',
      entityId: existing.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { provider, deleted: true },
      req,
    });

    return { success: true as const, data: { provider } };
  }

  /**
   * Optional connectivity check for configured secrets (no charge).
   * STRIPE: balance.retrieve. SSL_COMMERZ: session init with 10.00 BDT.
   */
  async validate(
    userId: string,
    storeId: string,
    provider: PaymentProvider,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    this.assertConfigurable(provider);

    const row = await this.prisma.paymentProviderConfig.findUnique({
      where: { storeId_provider: { storeId, provider } },
    });
    if (!row?.encryptedSecrets) {
      throw new BadRequestException(
        `Payment provider ${provider} secrets are not configured`,
      );
    }

    const secrets = this.crypto.decryptJson(row.encryptedSecrets);
    const mode = (row.mode === 'live' ? 'live' : 'test') as 'test' | 'live';

    if (provider === PaymentProvider.STRIPE) {
      await this.stripeProvider.validateConfig(secrets);
      return {
        success: true as const,
        data: { provider, ok: true as const },
      };
    }

    if (provider === PaymentProvider.SSL_COMMERZ) {
      await this.sslCommerzProvider.validateConfig(secrets, mode);
      return {
        success: true as const,
        data: { provider, ok: true as const },
      };
    }

    if (provider === PaymentProvider.TEST) {
      this.assertSecretsShape(provider, secrets);
      return {
        success: true as const,
        data: { provider, ok: true as const },
      };
    }

    throw new BadRequestException(
      `Validate is not supported for provider ${provider}`,
    );
  }

  /** Internal: load enabled config + decrypt secrets (never log/return secrets). */
  async requireEnabledConfig(storeId: string, provider: PaymentProvider) {
    const row = await this.prisma.paymentProviderConfig.findUnique({
      where: { storeId_provider: { storeId, provider } },
    });
    if (!row || !row.enabled) {
      throw new BadRequestException(
        `Payment provider ${provider} is not enabled for this store`,
      );
    }
    if (!this.registry.isOnline(provider)) {
      throw new BadRequestException(
        `Payment provider ${provider} does not support online initiation`,
      );
    }
    const secrets = row.encryptedSecrets
      ? this.crypto.decryptJson(row.encryptedSecrets)
      : {};
    return {
      config: row,
      publicConfig: (row.publicConfig as Record<string, unknown>) ?? {},
      secrets,
      mode: (row.mode === 'live' ? 'live' : 'test') as 'test' | 'live',
    };
  }

  async listPublicEnabled(storeId: string) {
    const rows = await this.prisma.paymentProviderConfig.findMany({
      where: { storeId, enabled: true, provider: { in: ONLINE_PAYMENT_PROVIDERS } },
    });
    return rows.map((row) => ({
      provider: row.provider,
      mode: row.mode,
      publicConfig: (row.publicConfig as Record<string, unknown>) ?? {},
    }));
  }

  private assertConfigurable(provider: PaymentProvider) {
    if (!ONLINE_PAYMENT_PROVIDERS.includes(provider)) {
      throw new BadRequestException(
        `Provider ${provider} cannot be configured (offline or unimplemented)`,
      );
    }
    if (!this.registry.listImplementedOnline().includes(provider)) {
      throw new BadRequestException(
        `Provider ${provider} is not implemented yet`,
      );
    }
  }

  private assertSecretsShape(
    provider: PaymentProvider,
    secrets: Record<string, unknown>,
  ) {
    if (provider === PaymentProvider.TEST) {
      if (typeof secrets.webhookSecret !== 'string' || !secrets.webhookSecret) {
        throw new BadRequestException(
          'TEST provider secrets.webhookSecret is required',
        );
      }
      return;
    }
    if (provider === PaymentProvider.STRIPE) {
      if (typeof secrets.secretKey !== 'string' || !secrets.secretKey) {
        throw new BadRequestException(
          'STRIPE provider secrets.secretKey is required',
        );
      }
      if (typeof secrets.webhookSecret !== 'string' || !secrets.webhookSecret) {
        throw new BadRequestException(
          'STRIPE provider secrets.webhookSecret is required',
        );
      }
      return;
    }
    if (provider === PaymentProvider.SSL_COMMERZ) {
      if (typeof secrets.storeId !== 'string' || !secrets.storeId) {
        throw new BadRequestException(
          'SSL_COMMERZ provider secrets.storeId is required',
        );
      }
      if (
        typeof secrets.storePassword !== 'string' ||
        !secrets.storePassword
      ) {
        throw new BadRequestException(
          'SSL_COMMERZ provider secrets.storePassword is required',
        );
      }
    }
  }

  private toSafeDto(row: PaymentProviderConfig) {
    return {
      id: row.id,
      provider: row.provider,
      enabled: row.enabled,
      mode: row.mode,
      configured: true,
      hasSecrets: Boolean(row.encryptedSecrets),
      publicConfig: row.publicConfig,
      implemented: this.registry.listImplementedOnline().includes(row.provider),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, tenantId: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }
}
