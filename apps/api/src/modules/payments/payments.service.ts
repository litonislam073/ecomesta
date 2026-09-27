import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  StoreRole,
  type Payment,
} from '@prisma/client';
import type { Request } from 'express';
import {
  moneyToString,
  normalizePagination,
  pageMeta,
} from '../../common/utils/catalog.util';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import { generatePaymentInternalReference } from './payment-reference.util';
import { assertPaymentRecordStatusTransition } from './payment-transitions';
import {
  ListPaymentsQueryDto,
  UpdatePaymentStatusDto,
} from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create a payment row linked to an order (internal / transactional use).
   * Does not accept client-supplied amounts for public flows.
   */
  async createPaymentRecord(
    tx: Prisma.TransactionClient,
    input: {
      storeId: string;
      orderId: string;
      amount: Prisma.Decimal;
      currency: string;
      provider: PaymentProvider;
      method: PaymentMethod;
      status?: PaymentStatus;
      metadata?: Prisma.InputJsonValue;
      attemptNumber?: number;
      internalReference?: string;
    },
  ) {
    return tx.payment.create({
      data: {
        storeId: input.storeId,
        orderId: input.orderId,
        amount: input.amount,
        currency: input.currency,
        provider: input.provider,
        method: input.method,
        status: input.status ?? PaymentStatus.PENDING,
        metadata: input.metadata,
        attemptNumber: input.attemptNumber ?? 1,
        internalReference:
          input.internalReference ?? generatePaymentInternalReference(),
      },
    });
  }

  async list(userId: string, storeId: string, query: ListPaymentsQueryDto) {
    await this.authorization.assertStoreAccess(userId, storeId);
    await this.requireStore(storeId);

    const { page, limit, skip } = normalizePagination(query);
    const where: Prisma.PaymentWhereInput = { storeId };
    if (query.status) where.status = query.status;
    if (query.provider) where.provider = query.provider;
    if (query.orderId) where.orderId = query.orderId;
    if (query.method) {
      where.method = query.method as PaymentMethod;
    }
    if (query.search?.trim()) {
      where.order = {
        orderNumber: {
          contains: query.search.trim(),
          mode: 'insensitive',
        },
      };
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              publicReference: true,
              status: true,
              paymentStatus: true,
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: items.map((item) => this.toListDto(item)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getOne(userId: string, storeId: string, paymentId: string) {
    await this.authorization.assertStoreAccess(userId, storeId);
    const payment = await this.requirePayment(storeId, paymentId);
    return { success: true as const, data: this.toDetailDto(payment) };
  }

  async updateStatus(
    userId: string,
    storeId: string,
    paymentId: string,
    dto: UpdatePaymentStatusDto,
    req?: Request,
  ) {
    await this.authorization.assertStoreRole(userId, storeId, [
      StoreRole.STORE_MANAGER,
    ]);
    const store = await this.requireStore(storeId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        {
          id: string;
          status: PaymentStatus;
          order_id: string;
          amount: Prisma.Decimal;
        }[]
      >`
        SELECT id, status, order_id, amount
        FROM payments
        WHERE id = ${paymentId}::uuid AND store_id = ${storeId}::uuid
        FOR UPDATE
      `;
      const row = locked[0];
      if (!row) {
        throw new NotFoundException('Payment not found');
      }

      assertPaymentRecordStatusTransition(row.status, dto.status);

      const order = await tx.order.findFirst({
        where: { id: row.order_id, storeId },
        select: { id: true, status: true, orderNumber: true },
      });
      if (!order) {
        throw new NotFoundException('Order not found for payment');
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new UnprocessableEntityException(
          'Cannot update payment on a cancelled order',
        );
      }

      const payment = await tx.payment.update({
        where: { id: row.id },
        data: { status: dto.status },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              publicReference: true,
              status: true,
              paymentStatus: true,
            },
          },
        },
      });

      // Keep order.paymentStatus in sync with the latest payment row.
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: dto.status },
      });

      return payment;
    });

    await this.audit.log({
      action: 'PAYMENT_STATUS_CHANGED',
      entityType: 'Payment',
      entityId: updated.id,
      userId,
      tenantId: store.tenantId,
      storeId,
      metadata: {
        from: undefined,
        to: dto.status,
        orderId: updated.orderId,
        orderNumber: updated.order.orderNumber,
      },
      req,
    });

    return { success: true as const, data: this.toDetailDto(updated) };
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

  private async requirePayment(storeId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, storeId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            publicReference: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  private toListDto(
    payment: Payment & {
      order: {
        id: string;
        orderNumber: string;
        publicReference: string | null;
        status: OrderStatus;
        paymentStatus: PaymentStatus;
      };
    },
  ) {
    return {
      id: payment.id,
      storeId: payment.storeId,
      orderId: payment.orderId,
      orderNumber: payment.order.orderNumber,
      publicReference: payment.order.publicReference,
      internalReference: payment.internalReference,
      attemptNumber: payment.attemptNumber,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      method: payment.method,
      status: payment.status,
      amount: moneyToString(payment.amount)!,
      currency: payment.currency,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  private toDetailDto(
    payment: Payment & {
      order: {
        id: string;
        orderNumber: string;
        publicReference: string | null;
        status: OrderStatus;
        paymentStatus: PaymentStatus;
      };
    },
  ) {
    return {
      ...this.toListDto(payment),
      metadata: payment.metadata,
      order: {
        id: payment.order.id,
        orderNumber: payment.order.orderNumber,
        publicReference: payment.order.publicReference,
        status: payment.order.status,
        paymentStatus: payment.order.paymentStatus,
      },
    };
  }
}
