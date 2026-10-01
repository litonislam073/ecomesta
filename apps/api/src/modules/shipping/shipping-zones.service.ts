import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StoreRole } from '@prisma/client';
import type { Request } from 'express';
import {
  normalizePagination,
  pageMeta,
} from '../../common/utils/catalog.util';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import {
  CreateShippingZoneDto,
  ListShippingZonesQueryDto,
  UpdateShippingZoneDto,
  ZoneLocationInputDto,
} from './dto/shipping-zone.dto';

@Injectable()
export class ShippingZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  async create(
    userId: string,
    storeId: string,
    dto: CreateShippingZoneDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    await this.entitlements.assertFeature(storeId, 'deliveryZones');
    const locations = await this.normalizeLocations(dto.locations);

    const zone = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shippingZone.create({
        data: {
          storeId,
          name: dto.name.trim(),
          active: dto.active ?? true,
          priority: dto.priority ?? 0,
        },
      });
      await tx.shippingZoneLocation.createMany({
        data: locations.map((loc) => ({
          zoneId: created.id,
          storeId,
          divisionId: loc.divisionId,
          districtId: loc.districtId,
          upazilaId: loc.upazilaId,
        })),
      });
      return tx.shippingZone.findFirstOrThrow({
        where: { id: created.id },
        include: {
          locations: {
            include: {
              division: { select: { id: true, name: true, code: true } },
              district: { select: { id: true, name: true, code: true } },
              upazila: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });
    });

    await this.audit.log({
      action: 'ZONE_CREATED',
      entityType: 'ShippingZone',
      entityId: zone.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        name: zone.name,
        priority: zone.priority,
        locationCount: zone.locations.length,
      },
      req,
    });

    return { success: true as const, data: this.toDto(zone) };
  }

  async list(
    userId: string,
    storeId: string,
    query: ListShippingZonesQueryDto,
  ) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireStore(storeId);

    const { page, limit, skip } = normalizePagination(query);
    const where: Prisma.ShippingZoneWhereInput = { storeId };
    if (query.active !== undefined) {
      where.active = query.active;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.shippingZone.findMany({
        where,
        include: {
          locations: {
            include: {
              division: { select: { id: true, name: true, code: true } },
              district: { select: { id: true, name: true, code: true } },
              upazila: { select: { id: true, name: true, code: true } },
            },
          },
          _count: { select: { methods: true } },
        },
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.shippingZone.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: items.map((item) => this.toDto(item)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getOne(userId: string, storeId: string, zoneId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const zone = await this.requireZone(storeId, zoneId);
    return { success: true as const, data: this.toDto(zone) };
  }

  async update(
    userId: string,
    storeId: string,
    zoneId: string,
    dto: UpdateShippingZoneDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    await this.requireZone(storeId, zoneId);

    const locations =
      dto.locations !== undefined
        ? await this.normalizeLocations(dto.locations)
        : null;

    const zone = await this.prisma.$transaction(async (tx) => {
      await tx.shippingZone.update({
        where: { id: zoneId },
        data: {
          name: dto.name?.trim(),
          active: dto.active,
          priority: dto.priority,
        },
      });

      if (locations) {
        await tx.shippingZoneLocation.deleteMany({ where: { zoneId, storeId } });
        if (locations.length > 0) {
          await tx.shippingZoneLocation.createMany({
            data: locations.map((loc) => ({
              zoneId,
              storeId,
              divisionId: loc.divisionId,
              districtId: loc.districtId,
              upazilaId: loc.upazilaId,
            })),
          });
        }
      }

      return tx.shippingZone.findFirstOrThrow({
        where: { id: zoneId, storeId },
        include: {
          locations: {
            include: {
              division: { select: { id: true, name: true, code: true } },
              district: { select: { id: true, name: true, code: true } },
              upazila: { select: { id: true, name: true, code: true } },
            },
          },
          _count: { select: { methods: true } },
        },
      });
    });

    await this.audit.log({
      action: 'ZONE_UPDATED',
      entityType: 'ShippingZone',
      entityId: zone.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        name: zone.name,
        priority: zone.priority,
        active: zone.active,
        locationCount: zone.locations.length,
      },
      req,
    });

    return { success: true as const, data: this.toDto(zone) };
  }

  async remove(
    userId: string,
    storeId: string,
    zoneId: string,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireZone(storeId, zoneId);

    await this.prisma.$transaction(async (tx) => {
      await tx.shippingMethod.updateMany({
        where: { storeId, zoneId },
        data: { zoneId: null },
      });
      await tx.shippingZone.delete({ where: { id: zoneId } });
    });

    await this.audit.log({
      action: 'ZONE_DELETED',
      entityType: 'ShippingZone',
      entityId: existing.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { name: existing.name, priority: existing.priority },
      req,
    });

    return { success: true as const, data: { id: existing.id } };
  }

  private async normalizeLocations(locations: ZoneLocationInputDto[]) {
    if (!locations.length) {
      throw new BadRequestException('At least one location mapping is required');
    }

    const normalized: {
      divisionId: string | null;
      districtId: string | null;
      upazilaId: string | null;
    }[] = [];

    for (const loc of locations) {
      let divisionId = loc.divisionId ?? null;
      let districtId = loc.districtId ?? null;
      const upazilaId = loc.upazilaId ?? null;

      if (upazilaId) {
        const upazila = await this.prisma.bdUpazila.findFirst({
          where: { id: upazilaId, active: true },
          select: {
            id: true,
            districtId: true,
            district: { select: { id: true, divisionId: true } },
          },
        });
        if (!upazila) {
          throw new BadRequestException(`Unknown upazilaId: ${upazilaId}`);
        }
        districtId = upazila.districtId;
        divisionId = upazila.district.divisionId;
        // Keep only upazila-level specificity for matching semantics.
        normalized.push({
          divisionId: null,
          districtId: null,
          upazilaId: upazila.id,
        });
        continue;
      }

      if (districtId) {
        const district = await this.prisma.bdDistrict.findFirst({
          where: { id: districtId, active: true },
          select: { id: true, divisionId: true },
        });
        if (!district) {
          throw new BadRequestException(`Unknown districtId: ${districtId}`);
        }
        if (divisionId && divisionId !== district.divisionId) {
          throw new BadRequestException(
            'districtId does not belong to divisionId',
          );
        }
        normalized.push({
          divisionId: null,
          districtId: district.id,
          upazilaId: null,
        });
        continue;
      }

      if (divisionId) {
        const division = await this.prisma.bdDivision.findFirst({
          where: { id: divisionId, active: true },
          select: { id: true },
        });
        if (!division) {
          throw new BadRequestException(`Unknown divisionId: ${divisionId}`);
        }
        normalized.push({
          divisionId: division.id,
          districtId: null,
          upazilaId: null,
        });
        continue;
      }

      throw new BadRequestException(
        'At least one of divisionId, districtId, or upazilaId is required',
      );
    }

    return normalized;
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

  private async requireZone(storeId: string, zoneId: string) {
    const zone = await this.prisma.shippingZone.findFirst({
      where: { id: zoneId, storeId },
      include: {
        locations: {
          include: {
            division: { select: { id: true, name: true, code: true } },
            district: { select: { id: true, name: true, code: true } },
            upazila: { select: { id: true, name: true, code: true } },
          },
        },
        _count: { select: { methods: true } },
      },
    });
    if (!zone) {
      throw new NotFoundException('Shipping zone not found');
    }
    return zone;
  }

  private toDto(
    zone: {
      id: string;
      storeId: string;
      name: string;
      active: boolean;
      priority: number;
      createdAt: Date;
      updatedAt: Date;
      locations: {
        id: string;
        divisionId: string | null;
        districtId: string | null;
        upazilaId: string | null;
        division: { id: string; name: string; code: string } | null;
        district: { id: string; name: string; code: string } | null;
        upazila: { id: string; name: string; code: string } | null;
      }[];
      _count?: { methods: number };
    },
  ) {
    return {
      id: zone.id,
      storeId: zone.storeId,
      name: zone.name,
      active: zone.active,
      priority: zone.priority,
      methodCount: zone._count?.methods ?? undefined,
      locations: zone.locations.map((loc) => ({
        id: loc.id,
        divisionId: loc.divisionId,
        districtId: loc.districtId,
        upazilaId: loc.upazilaId,
        division: loc.division,
        district: loc.district,
        upazila: loc.upazila,
      })),
      createdAt: zone.createdAt,
      updatedAt: zone.updatedAt,
    };
  }
}
