import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StoreRole,
  type Customer,
  type CustomerAddress,
} from '@prisma/client';
import type { Request } from 'express';
import {
  normalizePagination,
  pageMeta,
} from '../../common/utils/catalog.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  CreateCustomerAddressDto,
  CreateCustomerDto,
  ListCustomersQueryDto,
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async create(
    userId: string,
    storeId: string,
    dto: CreateCustomerDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);

    try {
      const customer = await this.prisma.customer.create({
        data: {
          storeId,
          email: dto.email || null,
          phone: dto.phone || null,
          firstName: dto.firstName,
          lastName: dto.lastName,
          notes: dto.notes,
        },
      });

      await this.audit.log({
        action: 'CUSTOMER_CREATED',
        entityType: 'Customer',
        entityId: customer.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { email: customer.email, phone: customer.phone },
        req,
      });

      return { success: true as const, data: this.toCustomerDto(customer) };
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async list(userId: string, storeId: string, query: ListCustomersQueryDto) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireStore(storeId);

    const { page, limit, skip } = normalizePagination(query);
    const where = this.buildWhere(storeId, query);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: items.map((item) => this.toCustomerDto(item)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getOne(userId: string, storeId: string, customerId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const customer = await this.requireCustomer(storeId, customerId, true);
    return {
      success: true as const,
      data: {
        ...this.toCustomerDto(customer),
        addresses: customer.addresses.map((address) =>
          this.toAddressDto(address),
        ),
      },
    };
  }

  async update(
    userId: string,
    storeId: string,
    customerId: string,
    dto: UpdateCustomerDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireCustomer(storeId, customerId);

    try {
      const customer = await this.prisma.customer.update({
        where: { id: existing.id },
        data: {
          ...(dto.email !== undefined ? { email: dto.email || null } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
          ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });

      await this.audit.log({
        action: 'CUSTOMER_UPDATED',
        entityType: 'Customer',
        entityId: customer.id,
        userId,
        tenantId: store.tenantId,
        storeId,
        metadata: { changes: Object.keys(dto) },
        req,
      });

      return { success: true as const, data: this.toCustomerDto(customer) };
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  /**
   * Hard-delete only when the customer has no order/coupon history.
   * Schema has no archive status; do not invent soft-delete columns in this phase.
   */
  async remove(
    userId: string,
    storeId: string,
    customerId: string,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireCustomer(storeId, customerId);

    const [orderCount, couponUsageCount] = await this.prisma.$transaction([
      this.prisma.order.count({ where: { customerId, storeId } }),
      this.prisma.couponUsage.count({ where: { customerId } }),
    ]);

    if (orderCount > 0 || couponUsageCount > 0) {
      throw new ConflictException(
        'Cannot delete customer with order or coupon history; retain the record for audit integrity',
      );
    }

    await this.prisma.customer.delete({ where: { id: existing.id } });

    await this.audit.log({
      action: 'CUSTOMER_DELETED',
      entityType: 'Customer',
      entityId: existing.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { email: existing.email, phone: existing.phone },
      req,
    });

    return {
      success: true as const,
      data: { id: existing.id, deleted: true },
    };
  }

  // ---------------------------------------------------------------------------
  // Addresses
  // ---------------------------------------------------------------------------

  async createAddress(
    userId: string,
    storeId: string,
    customerId: string,
    dto: CreateCustomerAddressDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    await this.requireCustomer(storeId, customerId);

    const address = await this.prisma.customerAddress.create({
      data: {
        customerId,
        type: dto.type,
        firstName: dto.firstName,
        lastName: dto.lastName,
        company: dto.company,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        phone: dto.phone,
      },
    });

    await this.audit.log({
      action: 'CUSTOMER_ADDRESS_CREATED',
      entityType: 'CustomerAddress',
      entityId: address.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { customerId, type: address.type },
      req,
    });

    return { success: true as const, data: this.toAddressDto(address) };
  }

  async listAddresses(userId: string, storeId: string, customerId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireCustomer(storeId, customerId);

    const addresses = await this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true as const,
      data: addresses.map((address) => this.toAddressDto(address)),
    };
  }

  async getAddress(
    userId: string,
    storeId: string,
    customerId: string,
    addressId: string,
  ) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const address = await this.requireAddress(storeId, customerId, addressId);
    return { success: true as const, data: this.toAddressDto(address) };
  }

  async updateAddress(
    userId: string,
    storeId: string,
    customerId: string,
    addressId: string,
    dto: UpdateCustomerAddressDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireAddress(storeId, customerId, addressId);

    const address = await this.prisma.customerAddress.update({
      where: { id: existing.id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.company !== undefined ? { company: dto.company } : {}),
        ...(dto.addressLine1 !== undefined
          ? { addressLine1: dto.addressLine1 }
          : {}),
        ...(dto.addressLine2 !== undefined
          ? { addressLine2: dto.addressLine2 }
          : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
    });

    await this.audit.log({
      action: 'CUSTOMER_ADDRESS_UPDATED',
      entityType: 'CustomerAddress',
      entityId: address.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { customerId, changes: Object.keys(dto) },
      req,
    });

    return { success: true as const, data: this.toAddressDto(address) };
  }

  async deleteAddress(
    userId: string,
    storeId: string,
    customerId: string,
    addressId: string,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);
    const existing = await this.requireAddress(storeId, customerId, addressId);

    await this.prisma.customerAddress.delete({ where: { id: existing.id } });

    await this.audit.log({
      action: 'CUSTOMER_ADDRESS_DELETED',
      entityType: 'CustomerAddress',
      entityId: existing.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: { customerId, type: existing.type },
      req,
    });

    return {
      success: true as const,
      data: { id: existing.id, deleted: true },
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildWhere(
    storeId: string,
    query: ListCustomersQueryDto,
  ): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = { storeId };

    if (query.email) {
      where.email = query.email;
    }
    if (query.phone) {
      where.phone = query.phone;
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) {
        where.createdAt.gte = new Date(query.createdFrom);
      }
      if (query.createdTo) {
        where.createdAt.lte = new Date(query.createdTo);
      }
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    return where;
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

  private async requireCustomer(
    storeId: string,
    customerId: string,
    withAddresses = false,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, storeId },
      include: withAddresses
        ? { addresses: { orderBy: { createdAt: 'desc' } } }
        : undefined,
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer as Customer & { addresses: CustomerAddress[] };
  }

  private async requireAddress(
    storeId: string,
    customerId: string,
    addressId: string,
  ) {
    await this.requireCustomer(storeId, customerId);
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return address;
  }

  private rethrowUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(',')
        : String(error.meta?.target ?? '');
      if (target.includes('email')) {
        throw new ConflictException(
          'A customer with this email already exists in this store',
        );
      }
      if (target.includes('phone')) {
        throw new ConflictException(
          'A customer with this phone already exists in this store',
        );
      }
      throw new ConflictException('Unique constraint violation');
    }
    throw error;
  }

  private toCustomerDto(customer: Customer) {
    return {
      id: customer.id,
      storeId: customer.storeId,
      email: customer.email,
      phone: customer.phone,
      firstName: customer.firstName,
      lastName: customer.lastName,
      notes: customer.notes,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  private toAddressDto(address: CustomerAddress) {
    return {
      id: address.id,
      customerId: address.customerId,
      type: address.type,
      firstName: address.firstName,
      lastName: address.lastName,
      company: address.company,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}
