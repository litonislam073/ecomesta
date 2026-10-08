import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StoreRole, type CourierConnection } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PaymentSecretsCryptoService } from '../payments/crypto/payment-secrets-crypto.service';
import type { CourierCredentials, CourierProvider } from './courier-provider';
import { CourierProviderRegistry } from './courier-provider.registry';
import { UpsertCourierConnectionDto } from './dto/courier.dto';

/** Settings safe to show the merchant; the keys themselves are never returned. */
export interface CourierPublicConfig {
  pickupName?: string | null;
  pickupPhone?: string | null;
  pickupAddress?: string | null;
  defaultWeightKg?: number | null;
}

/**
 * A store's courier accounts. Credentials are encrypted at rest with the same
 * AES-256-GCM service as payment provider secrets, checked with a read-only
 * courier call before saving, and never leave the API.
 */
@Injectable()
export class CourierConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly crypto: PaymentSecretsCryptoService,
    private readonly registry: CourierProviderRegistry,
  ) {}

  async list(userId: string, storeId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const rows = await this.prisma.courierConnection.findMany({ where: { storeId } });
    return {
      success: true as const,
      data: this.registry.list().map((provider) =>
        this.toDto(provider, rows.find((row) => row.provider === provider.code) ?? null),
      ),
    };
  }

  async upsert(userId: string, storeId: string, providerCode: string, dto: UpsertCourierConnectionDto, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const provider = this.registry.get(providerCode);
    const store = await this.requireStore(storeId);
    const existing = await this.prisma.courierConnection.findUnique({
      where: { storeId_provider: { storeId, provider: provider.code } },
    });

    const keysGiven = dto.apiKey !== undefined || dto.secretKey !== undefined;
    if (keysGiven && (!dto.apiKey || !dto.secretKey)) {
      throw new BadRequestException('Enter both the API key and the secret key');
    }
    if (!existing && !keysGiven) {
      throw new BadRequestException('Enter the API key and secret key to connect');
    }

    let encryptedCredentials = existing?.encryptedCredentials;
    if (keysGiven) {
      const credentials: CourierCredentials = { apiKey: dto.apiKey!.trim(), secretKey: dto.secretKey!.trim() };
      await provider.validateCredentials(credentials);
      encryptedCredentials = this.crypto.encryptJson(credentials);
    }

    const previous = (existing?.publicConfig ?? {}) as CourierPublicConfig;
    const publicConfig: CourierPublicConfig = {
      pickupName: dto.pickupName !== undefined ? dto.pickupName.trim() || null : (previous.pickupName ?? null),
      pickupPhone: dto.pickupPhone !== undefined ? dto.pickupPhone.trim() || null : (previous.pickupPhone ?? null),
      pickupAddress: dto.pickupAddress !== undefined ? dto.pickupAddress.trim() || null : (previous.pickupAddress ?? null),
      defaultWeightKg: dto.defaultWeightKg !== undefined ? dto.defaultWeightKg : (previous.defaultWeightKg ?? null),
    };

    const saved = await this.prisma.courierConnection.upsert({
      where: { storeId_provider: { storeId, provider: provider.code } },
      create: {
        storeId,
        provider: provider.code,
        encryptedCredentials: encryptedCredentials!,
        publicConfig: publicConfig as Prisma.InputJsonObject,
      },
      update: { encryptedCredentials: encryptedCredentials!, publicConfig: publicConfig as Prisma.InputJsonObject },
    });

    await this.audit.log({
      action: existing ? 'COURIER_CONNECTION_UPDATED' : 'COURIER_CONNECTED',
      entityType: 'CourierConnection',
      entityId: saved.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      // Never the keys: only which settings changed.
      metadata: { provider: provider.code, credentialsChanged: keysGiven },
      req,
    });

    return { success: true as const, data: this.toDto(provider, saved) };
  }

  async disconnect(userId: string, storeId: string, providerCode: string, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const provider = this.registry.get(providerCode);
    const store = await this.requireStore(storeId);
    const existing = await this.prisma.courierConnection.findUnique({
      where: { storeId_provider: { storeId, provider: provider.code } },
    });
    if (!existing) throw new NotFoundException(`${provider.displayName} is not connected`);
    // Deleting the row removes the stored credentials; booked shipments keep their history.
    await this.prisma.courierConnection.delete({ where: { id: existing.id } });
    await this.audit.log({
      action: 'COURIER_DISCONNECTED',
      entityType: 'CourierConnection',
      entityId: existing.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { provider: provider.code },
      req,
    });
    return { success: true as const, data: this.toDto(provider, null) };
  }

  /** Decrypted credentials for a server-side courier call; null when not connected. */
  async credentialsFor(storeId: string, provider: CourierProvider): Promise<{ credentials: CourierCredentials; publicConfig: CourierPublicConfig } | null> {
    const row = await this.prisma.courierConnection.findUnique({
      where: { storeId_provider: { storeId, provider: provider.code } },
    });
    if (!row) return null;
    return {
      credentials: this.crypto.decryptJson(row.encryptedCredentials) as CourierCredentials,
      publicConfig: (row.publicConfig ?? {}) as CourierPublicConfig,
    };
  }

  private toDto(provider: CourierProvider, row: CourierConnection | null) {
    const config = (row?.publicConfig ?? {}) as CourierPublicConfig;
    return {
      provider: provider.code,
      name: provider.displayName,
      status: row ? ('CONNECTED' as const) : ('NOT_CONNECTED' as const),
      supportsCancellation: provider.supportsCancellation,
      credentialsSaved: Boolean(row),
      pickupName: config.pickupName ?? null,
      pickupPhone: config.pickupPhone ?? null,
      pickupAddress: config.pickupAddress ?? null,
      defaultWeightKg: config.defaultWeightKg ?? null,
      connectedAt: row?.createdAt ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { id: true, tenantId: true } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }
}
