import { randomUUID } from 'crypto';
import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';
import { RedisRateLimitService } from '../../common/rate-limit/redis-rate-limit.service';
import { clientIp } from '../../common/utils/request-host.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EMAIL_RATE_LIMITS, type RateLimitRule } from '../auth/email-rate-limits';
import { AuthorizationService } from '../authorization/authorization.service';
import { EmailService } from '../email/email.service';
import type { CreateSupportRequestDto } from './dto/support-request.dto';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly rateLimit: RedisRateLimitService,
  ) {}

  contact() {
    const supportEmail = this.email.supportEmail();
    return { success: true as const, data: { supportEmail, requestsEnabled: supportEmail !== null } };
  }

  /** Queues the request to SUPPORT_EMAIL with the merchant as Reply-To. */
  async createRequest(userId: string, dto: CreateSupportRequestDto, req: Request) {
    if (!this.email.supportEmail()) {
      throw new ServiceUnavailableException('Support requests are not available right now.');
    }
    await this.limit(`support:user:${userId}`, EMAIL_RATE_LIMITS.supportPerUser);
    await this.limit(`support:ip:${clientIp(req) ?? 'unknown'}`, EMAIL_RATE_LIMITS.supportPerIp);

    let store: { id: string; name: string; tenantId: string } | null = null;
    if (dto.storeId) {
      await this.authorization.assertStoreAccess(userId, dto.storeId);
      store = await this.prisma.store.findUnique({
        where: { id: dto.storeId },
        select: { id: true, name: true, tenantId: true },
      });
    }

    const requestId = dto.requestId ?? randomUUID();
    await this.email.sendSupportRequest(
      { userId, tenantId: store?.tenantId ?? null, storeId: store?.id ?? null },
      {
        category: dto.category,
        subject: dto.subject,
        message: dto.message,
        storeName: store?.name ?? null,
      },
      requestId,
    );

    await this.audit.log({
      action: 'SUPPORT_REQUEST_SUBMITTED',
      entityType: 'SupportRequest',
      entityId: requestId,
      userId,
      tenantId: store?.tenantId,
      storeId: store?.id,
      metadata: { category: dto.category },
      req,
    });

    return { success: true as const, data: { submitted: true, requestId } };
  }

  private async limit(key: string, rule: RateLimitRule): Promise<void> {
    if (!(await this.rateLimit.consume(key, rule.limit, rule.windowSeconds))) {
      throw new HttpException(
        { message: 'Too many requests. Please try again later.', error: 'TOO_MANY_REQUESTS' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
