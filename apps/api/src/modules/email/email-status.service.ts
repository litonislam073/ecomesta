import { Injectable, NotFoundException } from '@nestjs/common';
import { EmailDeliveryStatus, Prisma } from '@prisma/client';
import {
  normalizePagination,
  pageMeta,
} from '../../common/utils/catalog.util';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailConfigService } from './email.config';
import { ListEmailDeliveriesQueryDto } from './dto/admin-email.dto';

const EVENT_SUBJECT: Record<string, string> = {
  WELCOME: 'Welcome to Ecomesta',
  EMAIL_VERIFICATION: 'Confirm your Ecomesta email address',
  EMAIL_CHANGE_CONFIRM: 'Confirm your new Ecomesta email address',
  EMAIL_CHANGE_NOTICE: 'A change of your Ecomesta email address was requested',
  PASSWORD_RESET: 'Reset your Ecomesta password',
  PASSWORD_CHANGED: 'Your Ecomesta password was changed',
  SUPPORT_REQUEST: 'Support request',
  BILLING_PAYMENT_RECEIVED: 'Payment notification',
  BILLING_PAYMENT_APPROVED: 'Payment confirmed',
  BILLING_PAYMENT_REJECTED: 'Payment could not be confirmed',
  AI_SUPPORT_HANDOFF: 'Website chat handoff',
  AFFILIATE_APPROVED: 'You are now an Ecomesta affiliate',
  AFFILIATE_COMMISSION: 'Affiliate commission',
  AFFILIATE_PAYOUT: 'Affiliate withdrawal',
};

function subjectFor(eventType: string, payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.subject === 'string' && record.subject.trim()) {
      return record.subject.trim();
    }
  }
  return EVENT_SUBJECT[eventType] ?? eventType.replace(/_/g, ' ').toLowerCase();
}

function errorMessageFor(
  errorCategory: string | null,
  payload: unknown,
): string | null {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['errorMessage', 'error', 'message', 'lastError'] as const) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return errorCategory;
}

/** Super Admin view of email configuration and delivery health. */
@Injectable()
export class EmailStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: EmailConfigService,
  ) {}

  async overview() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.emailDelivery.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });

    const last7Days = Object.fromEntries(
      Object.values(EmailDeliveryStatus).map((status) => [status, 0]),
    ) as Record<EmailDeliveryStatus, number>;
    for (const row of grouped) last7Days[row.status] = row._count._all;

    return {
      success: true as const,
      data: {
        config: this.config.status(),
        last7Days,
      },
    };
  }

  async listDeliveries(query: ListEmailDeliveriesQueryDto) {
    const { page, limit, skip } = normalizePagination(query);
    const where: Prisma.EmailDeliveryWhereInput = {};
    if (query.status) where.status = query.status;
    const eventType = query.eventType?.trim();
    if (eventType) {
      where.eventType = { contains: eventType, mode: 'insensitive' };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.emailDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          eventType: true,
          status: true,
          provider: true,
          attempts: true,
          errorCategory: true,
          payload: true,
          createdAt: true,
          sentAt: true,
          failedAt: true,
          nextAttemptAt: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.emailDelivery.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        items: rows.map((row) => this.toListItem(row)),
        meta: pageMeta(total, page, limit),
      },
    };
  }

  async getDelivery(id: string) {
    const row = await this.prisma.emailDelivery.findUnique({
      where: { id },
      select: {
        id: true,
        eventType: true,
        status: true,
        provider: true,
        attempts: true,
        errorCategory: true,
        payload: true,
        providerMessageId: true,
        createdAt: true,
        sentAt: true,
        failedAt: true,
        nextAttemptAt: true,
        userId: true,
        tenantId: true,
        storeId: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!row) throw new NotFoundException('Email delivery not found');

    return {
      success: true as const,
      data: {
        ...this.toListItem(row),
        providerMessageId: row.providerMessageId,
        userId: row.userId,
        tenantId: row.tenantId,
        storeId: row.storeId,
        failedAt: row.failedAt,
        payload: this.safePayload(row.payload),
      },
    };
  }

  private toListItem(row: {
    id: string;
    eventType: string;
    status: EmailDeliveryStatus;
    provider: string | null;
    attempts: number;
    errorCategory: string | null;
    payload: unknown;
    createdAt: Date;
    sentAt: Date | null;
    nextAttemptAt: Date | null;
    user: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  }) {
    return {
      id: row.id,
      eventType: row.eventType,
      status: row.status,
      provider: row.provider,
      attempts: row.attempts,
      errorCategory: row.errorCategory,
      errorMessage: errorMessageFor(row.errorCategory, row.payload),
      subject: subjectFor(row.eventType, row.payload),
      recipient: row.user?.email ?? null,
      recipientName: row.user
        ? [row.user.firstName, row.user.lastName].filter(Boolean).join(' ') || null
        : null,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
      nextAttemptAt: row.nextAttemptAt,
    };
  }

  private safePayload(payload: unknown): Record<string, unknown> | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (/token|password|secret|hash|credential/i.test(key)) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        out[key] = value;
      }
    }
    return Object.keys(out).length ? out : null;
  }
}
