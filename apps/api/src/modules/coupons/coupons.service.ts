import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CouponType, Prisma, StoreRole, type Coupon } from '@prisma/client';
import type { Request } from 'express';
import {
  moneyToString,
  normalizePagination,
  pageMeta,
  parseMoney,
  parseOptionalMoney,
} from '../../common/utils/catalog.util';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  isSupportedCouponType,
  normalizeCouponCode,
} from './coupon-math';
import {
  CreateCouponDto,
  ListCouponsQueryDto,
  UpdateCouponDto,
} from './dto/coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async create(
    userId: string,
    storeId: string,
    dto: CreateCouponDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const data = this.toCreateData(storeId, dto);

    let coupon: Coupon;
    try {
      coupon = await this.prisma.coupon.create({ data });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A coupon with this code already exists');
      }
      throw err;
    }

    await this.audit.log({
      action: 'COUPON_CREATED',
      entityType: 'Coupon',
      entityId: coupon.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        code: coupon.code,
        type: coupon.type,
        value: moneyToString(coupon.value),
      },
      req,
    });

    return { success: true as const, data: this.toDto(coupon) };
  }

  async list(userId: string, storeId: string, query: ListCouponsQueryDto) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireStore(storeId);

    const { page, limit, skip } = normalizePagination(query);
    const where: Prisma.CouponWhereInput = { storeId };
    if (query.active !== undefined) where.active = query.active;
    if (query.type) where.type = query.type;
    if (query.search?.trim()) {
      where.code = {
        contains: normalizeCouponCode(query.search),
        mode: 'insensitive',
      };
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: items.map((c) => this.toDto(c)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getOne(userId: string, storeId: string, couponId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const coupon = await this.requireCoupon(storeId, couponId);
    return { success: true as const, data: this.toDto(coupon) };
  }

  async update(
    userId: string,
    storeId: string,
    couponId: string,
    dto: UpdateCouponDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireCoupon(storeId, couponId);
    const data = this.toUpdateData(dto);

    let coupon: Coupon;
    try {
      coupon = await this.prisma.coupon.update({
        where: { id: existing.id },
        data,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A coupon with this code already exists');
      }
      throw err;
    }

    const deactivated = existing.active && coupon.active === false;
    await this.audit.log({
      action: deactivated ? 'COUPON_DEACTIVATED' : 'COUPON_UPDATED',
      entityType: 'Coupon',
      entityId: coupon.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        code: coupon.code,
        type: coupon.type,
        active: coupon.active,
      },
      req,
    });

    return { success: true as const, data: this.toDto(coupon) };
  }

  /**
   * Prefer soft deactivation. Hard delete only when unused.
   */
  async remove(
    userId: string,
    storeId: string,
    couponId: string,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const coupon = await this.requireCoupon(storeId, couponId);

    const usageCount = await this.prisma.couponUsage.count({
      where: { couponId: coupon.id },
    });
    if (usageCount > 0 || coupon.usageCount > 0) {
      const deactivated = await this.prisma.coupon.update({
        where: { id: coupon.id },
        data: { active: false },
      });
      await this.audit.log({
        action: 'COUPON_DEACTIVATED',
        entityType: 'Coupon',
        entityId: coupon.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { code: coupon.code, reason: 'delete_with_history' },
        req,
      });
      return {
        success: true as const,
        data: this.toDto(deactivated),
        meta: { deactivated: true as const },
      };
    }

    await this.prisma.coupon.delete({ where: { id: coupon.id } });
    await this.audit.log({
      action: 'COUPON_DELETED',
      entityType: 'Coupon',
      entityId: coupon.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { code: coupon.code },
      req,
    });

    return {
      success: true as const,
      data: { id: coupon.id },
      meta: { deleted: true as const },
    };
  }

  private toCreateData(
    storeId: string,
    dto: CreateCouponDto,
  ): Prisma.CouponCreateInput {
    const code = normalizeCouponCode(dto.code);
    if (!code) {
      throw new BadRequestException('code is required');
    }
    if (!isSupportedCouponType(dto.type)) {
      throw new BadRequestException('Unsupported coupon type');
    }
    const value = this.parseValue(dto.type, dto.value);
    const startsAt = this.parseDate(dto.startsAt, 'startsAt');
    const expiresAt = this.parseDate(dto.expiresAt, 'expiresAt');
    if (startsAt && expiresAt && expiresAt < startsAt) {
      throw new BadRequestException('expiresAt must be after startsAt');
    }

    return {
      store: { connect: { id: storeId } },
      code,
      type: dto.type,
      value,
      active: dto.active ?? true,
      startsAt: startsAt ?? null,
      expiresAt: expiresAt ?? null,
      usageLimit: dto.usageLimit === undefined ? null : dto.usageLimit,
      perCustomerLimit:
        dto.perCustomerLimit === undefined ? null : dto.perCustomerLimit,
      minimumOrderAmount:
        parseOptionalMoney(dto.minimumOrderAmount, 'minimumOrderAmount') ??
        null,
      maximumDiscountAmount:
        parseOptionalMoney(
          dto.maximumDiscountAmount,
          'maximumDiscountAmount',
        ) ?? null,
    };
  }

  private toUpdateData(dto: UpdateCouponDto): Prisma.CouponUpdateInput {
    const data: Prisma.CouponUpdateInput = {};
    if (dto.code !== undefined) {
      const code = normalizeCouponCode(dto.code);
      if (!code) throw new BadRequestException('code is required');
      data.code = code;
    }
    if (dto.type !== undefined) {
      if (!isSupportedCouponType(dto.type)) {
        throw new BadRequestException('Unsupported coupon type');
      }
      data.type = dto.type;
    }
    if (dto.value !== undefined) {
      const type = dto.type;
      // value validation needs type — use existing if not changing
      if (type) {
        data.value = this.parseValue(type, dto.value);
      } else {
        // defer strict type check to runtime: percentage max 100 checked if type known later
        const asMoney = parseMoney(dto.value, 'value');
        data.value = asMoney;
      }
    }
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.startsAt !== undefined) {
      data.startsAt = this.parseDate(dto.startsAt, 'startsAt');
    }
    if (dto.expiresAt !== undefined) {
      data.expiresAt = this.parseDate(dto.expiresAt, 'expiresAt');
    }
    if (dto.usageLimit !== undefined) data.usageLimit = dto.usageLimit;
    if (dto.perCustomerLimit !== undefined) {
      data.perCustomerLimit = dto.perCustomerLimit;
    }
    if (dto.minimumOrderAmount !== undefined) {
      data.minimumOrderAmount =
        parseOptionalMoney(dto.minimumOrderAmount, 'minimumOrderAmount') ??
        null;
    }
    if (dto.maximumDiscountAmount !== undefined) {
      data.maximumDiscountAmount =
        parseOptionalMoney(
          dto.maximumDiscountAmount,
          'maximumDiscountAmount',
        ) ?? null;
    }
    return data;
  }

  private parseValue(type: CouponType, raw: string | number): Prisma.Decimal {
    const value = parseMoney(raw, 'value');
    if (value.lte(0)) {
      throw new BadRequestException('value must be greater than zero');
    }
    if (type === CouponType.PERCENTAGE && value.gt(100)) {
      throw new BadRequestException('percentage value cannot exceed 100');
    }
    return value;
  }

  private parseDate(
    value: string | null | undefined,
    field: string,
  ): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return date;
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, tenantId: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  private async requireCoupon(storeId: string, couponId: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: couponId, storeId },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  toDto(coupon: Coupon) {
    return {
      id: coupon.id,
      storeId: coupon.storeId,
      code: coupon.code,
      type: coupon.type,
      value: moneyToString(coupon.value)!,
      minimumOrderAmount: moneyToString(coupon.minimumOrderAmount),
      maximumDiscountAmount: moneyToString(coupon.maximumDiscountAmount),
      usageLimit: coupon.usageLimit,
      usageCount: coupon.usageCount,
      perCustomerLimit: coupon.perCustomerLimit,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
      active: coupon.active,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    };
  }
}
