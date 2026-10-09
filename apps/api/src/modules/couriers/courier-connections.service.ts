import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StoreRole, type CourierConnection } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PaymentSecretsCryptoService } from '../payments/crypto/payment-secrets-crypto.service';
import type { CourierCredentials, CourierProvider } from './courier-provider';
import { CourierProviderRegistry } from './courier-provider.registry';
import { CourierLocationOptionsDto, UpsertCourierConnectionDto } from './dto/courier.dto';

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

  /** Choices for one of the courier's booking location steps (asked from the courier). */
  async locationOptions(userId: string, storeId: string, providerCode: string, dto: CourierLocationOptionsDto) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const provider = this.registry.get(providerCode);
    if (!provider.locationSteps.some((step) => step.key === dto.step) || !provider.locationOptions) {
      throw new BadRequestException(`${provider.displayName} has no location step "${dto.step.slice(0, 40)}"`);
    }
    const connection = await this.credentialsFor(storeId, provider);
    if (!connection) throw new BadRequestException(`Connect ${provider.displayName} in Settings → Couriers first`);
    const picked = cleanValues(dto.picked, provider.locationSteps.map((step) => step.key), 120);
    const options = await provider.locationOptions(connection.credentials, dto.step, picked);
    return { success: true as const, data: options.slice(0, 2000) };
  }

  async upsert(userId: string, storeId: string, providerCode: string, dto: UpsertCourierConnectionDto, req?: Request) {
    await this.authorization.assertStoreRole(userId, storeId, [StoreRole.STORE_MANAGER]);
    const provider = this.registry.get(providerCode);
    const store = await this.requireStore(storeId);
    const existing = await this.prisma.courierConnection.findUnique({
      where: { storeId_provider: { storeId, provider: provider.code } },
    });

    // Steadfast's original fields (`apiKey`, `secretKey`) are still accepted beside `credentials`, as a pair.
    if ((dto.apiKey !== undefined) !== (dto.secretKey !== undefined)) {
      throw new BadRequestException('Enter both the API key and the secret key');
    }
    const given = cleanValues(
      { ...dto.credentials, ...(dto.apiKey !== undefined ? { apiKey: dto.apiKey } : {}), ...(dto.secretKey !== undefined ? { secretKey: dto.secretKey } : {}) },
      provider.fields.map((field) => field.key),
      300,
    );
    const keysGiven = Object.keys(given).length > 0;
    if (!existing && !keysGiven) {
      throw new BadRequestException(`Enter your ${provider.displayName} details to connect`);
    }
    const saved0 = existing ? (this.crypto.decryptJson(existing.encryptedCredentials) as CourierCredentials) : {};
    // A secret left empty keeps its saved value; a plain field sent empty is cleared.
    const merged: CourierCredentials = { ...saved0 };
    for (const field of provider.fields) {
      if (!(field.key in given)) continue;
      if (given[field.key]) merged[field.key] = given[field.key]!;
      else if (!field.secret) delete merged[field.key];
    }
    const missing = provider.fields.filter((field) => field.required && !merged[field.key]);
    if (missing.length > 0) {
      throw new BadRequestException(`Enter the ${missing.map((field) => field.label).join(', ')} for ${provider.displayName}`);
    }

    let encryptedCredentials = existing?.encryptedCredentials;
    if (keysGiven) {
      const checked = await provider.validateCredentials(merged);
      encryptedCredentials = this.crypto.encryptJson(checked ?? merged);
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
    let settings: Record<string, string> = {};
    if (row) {
      try {
        const saved = this.crypto.decryptJson(row.encryptedCredentials) as CourierCredentials;
        // Only non-secret values (store ID, user name, pickup thana…) ever leave the API.
        settings = Object.fromEntries(
          provider.fields.filter((field) => !field.secret && saved[field.key]).map((field) => [field.key, saved[field.key]!]),
        );
      } catch {
        settings = {};
      }
    }
    return {
      provider: provider.code,
      name: provider.displayName,
      status: row ? ('CONNECTED' as const) : ('NOT_CONNECTED' as const),
      supportsCancellation: provider.supportsCancellation,
      credentialsSaved: Boolean(row),
      fields: provider.fields.map((field) => ({ ...field })),
      connectHelp: provider.connectHelp,
      locationSteps: provider.locationSteps.map((step) => ({ ...step })),
      settings,
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

/**
 * String values for the allowed keys only, trimmed and length-capped; anything
 * else (unknown keys, non-strings, line breaks) is dropped or rejected.
 */
export function cleanValues(input: unknown, allowed: string[], max: number): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!allowed.includes(key)) continue;
    if (typeof value !== 'string') throw new BadRequestException(`${key} must be text`);
    const text = value.trim();
    if (text.length > max || /[\r\n]/.test(text)) throw new BadRequestException(`${key} is not valid`);
    out[key] = text;
  }
  return out;
}
