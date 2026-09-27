import { Injectable } from '@nestjs/common';
import { EmailDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailConfigService } from './email.config';

const RECENT_LIMIT = 25;

/** Super Admin view of email configuration and delivery health. */
@Injectable()
export class EmailStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: EmailConfigService,
  ) {}

  async overview() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [grouped, recent] = await Promise.all([
      this.prisma.emailDelivery.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.emailDelivery.findMany({
        orderBy: { createdAt: 'desc' },
        take: RECENT_LIMIT,
        select: {
          id: true,
          eventType: true,
          status: true,
          provider: true,
          attempts: true,
          errorCategory: true,
          userId: true,
          tenantId: true,
          storeId: true,
          createdAt: true,
          sentAt: true,
          failedAt: true,
          nextAttemptAt: true,
        },
      }),
    ]);

    const last7Days = Object.fromEntries(
      Object.values(EmailDeliveryStatus).map((status) => [status, 0]),
    ) as Record<EmailDeliveryStatus, number>;
    for (const row of grouped) last7Days[row.status] = row._count._all;

    return {
      success: true as const,
      data: {
        config: this.config.status(),
        last7Days,
        recent,
      },
    };
  }
}
