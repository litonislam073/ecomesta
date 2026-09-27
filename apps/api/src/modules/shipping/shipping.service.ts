import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ShippingMethodType,
  ShippingProvider,
  StoreRole,
  type ShippingMethod,
} from '@prisma/client';
import type { Request } from 'express';
import {
  moneyToString,
  normalizePagination,
  pageMeta,
  parseMoney,
} from '../../common/utils/catalog.util';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateShippingMethodDto,
  ListShippingMethodsQueryDto,
  UpdateShippingMethodDto,
} from './dto/shipping-method.dto';
import { ShippingCalculationService } from './shipping-calculation.service';

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly calculation: ShippingCalculationService,
  ) {}

  async create(
    userId: string,
    storeId: string,
    dto: CreateShippingMethodDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const zoneId = await this.resolveZoneId(storeId, dto.zoneId);

    const type = dto.type;
    const price =
      type === ShippingMethodType.FREE
        ? new Prisma.Decimal(0)
        : parseMoney(dto.price ?? '0', 'price');

    const freeShippingThreshold =
      dto.freeShippingThreshold === undefined ||
      dto.freeShippingThreshold === null ||
      dto.freeShippingThreshold === ''
        ? null
        : parseMoney(dto.freeShippingThreshold, 'freeShippingThreshold');

    const method = await this.prisma.shippingMethod.create({
      data: {
        storeId,
        name: dto.name.trim(),
        type,
        provider: dto.provider ?? ShippingProvider.MANUAL,
        price,
        active: dto.active ?? true,
        configuration:
          dto.configuration === undefined
            ? undefined
            : (dto.configuration as Prisma.InputJsonValue),
        zoneId,
        freeShippingThreshold,
        codAllowed: dto.codAllowed ?? true,
        estimatedDelivery: dto.estimatedDelivery?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.audit.log({
      action: 'SHIPPING_METHOD_CREATED',
      entityType: 'ShippingMethod',
      entityId: method.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        name: method.name,
        type: method.type,
        price: moneyToString(method.price),
        zoneId: method.zoneId,
        codAllowed: method.codAllowed,
        freeShippingThreshold: moneyToString(method.freeShippingThreshold),
      },
      req,
    });

    return { success: true as const, data: this.toMerchantDto(method) };
  }

  async list(
    userId: string,
    storeId: string,
    query: ListShippingMethodsQueryDto,
  ) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireStore(storeId);

    const { page, limit, skip } = normalizePagination(query);
    const where: Prisma.ShippingMethodWhereInput = { storeId };
    if (query.active !== undefined) {
      where.active = query.active;
    }
    if (query.search?.trim()) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }
    if (query.zoneId === 'null') {
      where.zoneId = null;
    } else if (query.zoneId) {
      where.zoneId = query.zoneId;
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.shippingMethod.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.shippingMethod.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: items.map((item) => this.toMerchantDto(item)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getOne(userId: string, storeId: string, shippingMethodId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const method = await this.requireMethod(storeId, shippingMethodId);
    return { success: true as const, data: this.toMerchantDto(method) };
  }

  async update(
    userId: string,
    storeId: string,
    shippingMethodId: string,
    dto: UpdateShippingMethodDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireMethod(storeId, shippingMethodId);

    const nextType = dto.type ?? existing.type;
    let nextPrice = existing.price;
    if (nextType === ShippingMethodType.FREE) {
      nextPrice = new Prisma.Decimal(0);
    } else if (dto.price !== undefined) {
      nextPrice = parseMoney(dto.price, 'price');
    }

    let nextZoneId = existing.zoneId;
    if (dto.zoneId !== undefined) {
      nextZoneId = await this.resolveZoneId(storeId, dto.zoneId);
    }

    let nextThreshold = existing.freeShippingThreshold;
    if (dto.freeShippingThreshold !== undefined) {
      nextThreshold =
        dto.freeShippingThreshold === null || dto.freeShippingThreshold === ''
          ? null
          : parseMoney(dto.freeShippingThreshold, 'freeShippingThreshold');
    }

    const method = await this.prisma.shippingMethod.update({
      where: { id: existing.id },
      data: {
        name: dto.name?.trim(),
        type: dto.type,
        provider: dto.provider,
        price: nextPrice,
        active: dto.active,
        configuration:
          dto.configuration === undefined
            ? undefined
            : (dto.configuration as Prisma.InputJsonValue),
        zoneId: nextZoneId,
        freeShippingThreshold: nextThreshold,
        codAllowed: dto.codAllowed,
        estimatedDelivery:
          dto.estimatedDelivery === undefined
            ? undefined
            : dto.estimatedDelivery?.trim() || null,
        sortOrder: dto.sortOrder,
      },
    });

    await this.audit.log({
      action: 'SHIPPING_METHOD_UPDATED',
      entityType: 'ShippingMethod',
      entityId: method.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        name: method.name,
        type: method.type,
        price: moneyToString(method.price),
        active: method.active,
        zoneId: method.zoneId,
        codAllowed: method.codAllowed,
        freeShippingThreshold: moneyToString(method.freeShippingThreshold),
      },
      req,
    });

    return { success: true as const, data: this.toMerchantDto(method) };
  }

  async remove(
    userId: string,
    storeId: string,
    shippingMethodId: string,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireMethod(storeId, shippingMethodId);

    await this.prisma.shippingMethod.delete({ where: { id: existing.id } });

    await this.audit.log({
      action: 'SHIPPING_METHOD_DELETED',
      entityType: 'ShippingMethod',
      entityId: existing.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { name: existing.name, type: existing.type },
      req,
    });

    return { success: true as const, data: { id: existing.id } };
  }

  /** Public storefront — active methods only, customer-safe fields. */
  async listPublic(storeId: string, zoneId?: string) {
    const where: Prisma.ShippingMethodWhereInput = { storeId, active: true };
    if (zoneId === 'null') {
      where.zoneId = null;
    } else if (zoneId) {
      where.zoneId = zoneId;
    }

    const items = await this.prisma.shippingMethod.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
    });
    return {
      success: true as const,
      data: items.map((item) => this.toPublicDto(item)),
    };
  }

  private async resolveZoneId(
    storeId: string,
    zoneId: string | null | undefined,
  ): Promise<string | null> {
    if (zoneId === undefined) {
      return null;
    }
    if (zoneId === null) {
      return null;
    }
    const zone = await this.prisma.shippingZone.findFirst({
      where: { id: zoneId, storeId },
      select: { id: true },
    });
    if (!zone) {
      throw new NotFoundException('Shipping zone not found in this store');
    }
    return zone.id;
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, tenantId: true },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }

  private async requireMethod(storeId: string, shippingMethodId: string) {
    const method = await this.prisma.shippingMethod.findFirst({
      where: { id: shippingMethodId, storeId },
    });
    if (!method) {
      throw new NotFoundException('Shipping method not found');
    }
    return method;
  }

  private toMerchantDto(method: ShippingMethod) {
    return {
      id: method.id,
      storeId: method.storeId,
      name: method.name,
      type: method.type,
      provider: method.provider,
      price: moneyToString(method.price)!,
      active: method.active,
      configuration: method.configuration,
      zoneId: method.zoneId,
      freeShippingThreshold: moneyToString(method.freeShippingThreshold),
      codAllowed: method.codAllowed,
      estimatedDelivery: method.estimatedDelivery,
      sortOrder: method.sortOrder,
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    };
  }

  private toPublicDto(method: ShippingMethod) {
    const config = method.configuration as Record<string, unknown> | null;
    const description =
      typeof config?.description === 'string' ? config.description : null;
    return {
      id: method.id,
      name: method.name,
      type: method.type,
      price: moneyToString(
        this.calculation.amountForType(method.type, method.price),
      )!,
      description,
      zoneId: method.zoneId,
      freeShippingThreshold: moneyToString(method.freeShippingThreshold),
      codAllowed: method.codAllowed,
      estimatedDelivery: method.estimatedDelivery,
      sortOrder: method.sortOrder,
    };
  }
}
