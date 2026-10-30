import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthTokenPurpose, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { clientIp } from '../../common/utils/request-host.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthTokenService } from '../auth-tokens/auth-token.service';
import { EMAIL_CHANGE_TTL_HOURS, EMAIL_VERIFICATION_TTL_HOURS } from '../email/email-composer.service';
import { EmailService } from '../email/email.service';
import { maskEmail } from '../email/templates/templates';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { EMAIL_RATE_LIMITS, type RateLimitRule } from './email-rate-limits';
import { PasswordService } from './password.service';

const EMAIL_TAKEN = {
  message: 'Another Ecomesta account already uses this email address.',
  error: 'EMAIL_TAKEN',
};

const LINK_ERRORS = {
  invalid: ['EMAIL_CHANGE_TOKEN_INVALID', 'This link is not valid. Ask for a new one from your account page.'],
  expired: ['EMAIL_CHANGE_TOKEN_EXPIRED', 'This link has expired. Ask for a new one from your account page.'],
  used: ['EMAIL_CHANGE_TOKEN_USED', 'This link was already used. Your email address may already be changed.'],
} as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Changing the email a merchant signs in with. Merchants confirm the new address
 * by opening a link sent to it (the old address only gets a heads-up), so a typo
 * can never lock them out. Super Admins can also set it directly for support cases.
 */
@Injectable()
export class AccountEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: AuthTokenService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  async requestChange(userId: string, rawEmail: string, currentPassword: string, req: Request) {
    await this.limit(`email-change:user:${userId}`, EMAIL_RATE_LIMITS.emailChangePerUser);
    await this.limit(`email-change:ip:${this.ip(req)}`, EMAIL_RATE_LIMITS.emailChangePerIp);

    const newEmail = normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, passwordHash: true },
    });
    if (!(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw new BadRequestException({
        message: 'Your current password is not correct.',
        error: 'CURRENT_PASSWORD_INCORRECT',
      });
    }
    if (newEmail === user.email) {
      throw new BadRequestException({ message: 'This is already your email address.', error: 'SAME_EMAIL' });
    }
    await this.assertEmailFree(newEmail);

    await this.prisma.user.update({ where: { id: user.id }, data: { pendingEmail: newEmail } });
    const issued = await this.tokens.issue(
      user.id,
      AuthTokenPurpose.EMAIL_CHANGE,
      EMAIL_CHANGE_TTL_HOURS * 60 * 60 * 1000,
      this.ip(req),
    );
    this.email.sendEmailChangeRequest(user, newEmail, issued.token);

    await this.audit.log({
      action: 'EMAIL_CHANGE_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      metadata: { newEmail: maskEmail(newEmail) },
      req,
    });
    return {
      success: true as const,
      data: { pendingEmail: newEmail, expiresInHours: EMAIL_CHANGE_TTL_HOURS },
    };
  }

  /** Opening the emailed link proves the merchant controls the new address. */
  async confirmChange(token: string, req: Request) {
    await this.limit(`email-change-confirm:ip:${this.ip(req)}`, EMAIL_RATE_LIMITS.verifyEmailPerIp);
    const inspection = await this.tokens.inspect(token, AuthTokenPurpose.EMAIL_CHANGE);
    if (inspection.status !== 'valid') this.throwLinkError(inspection.status);
    const record = inspection.token;
    const now = new Date();

    const { previousEmail, email } = await this.prisma.$transaction(async (tx) => {
      if (!(await this.tokens.consume(tx, record.id, now))) this.throwLinkError('used');
      const user = await tx.user.findUniqueOrThrow({
        where: { id: record.userId },
        select: { id: true, email: true, pendingEmail: true },
      });
      // The merchant cancelled the change after the link was sent.
      if (!user.pendingEmail) this.throwLinkError('invalid');
      await this.updateEmail(tx, user.id, {
        email: user.pendingEmail,
        pendingEmail: null,
        emailVerifiedAt: now,
      });
      await tx.authToken.deleteMany({
        where: {
          userId: user.id,
          purpose: { in: [AuthTokenPurpose.EMAIL_CHANGE, AuthTokenPurpose.EMAIL_VERIFICATION] },
          usedAt: null,
        },
      });
      return { previousEmail: user.email, email: user.pendingEmail };
    });

    await this.audit.log({
      action: 'EMAIL_CHANGED',
      entityType: 'User',
      entityId: record.userId,
      userId: record.userId,
      metadata: { previousEmail: maskEmail(previousEmail), email: maskEmail(email) },
      req,
    });
    return { success: true as const, data: { email } };
  }

  async cancelChange(userId: string, req: Request) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, pendingEmail: true },
    });
    if (!user.pendingEmail) return { success: true as const, data: { cancelled: false } };
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { pendingEmail: null } }),
      this.prisma.authToken.deleteMany({
        where: { userId: user.id, purpose: AuthTokenPurpose.EMAIL_CHANGE, usedAt: null },
      }),
    ]);
    await this.audit.log({
      action: 'EMAIL_CHANGE_CANCELLED',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      req,
    });
    return { success: true as const, data: { cancelled: true } };
  }

  /**
   * Support fix by a Super Admin (e.g. a typo at sign-up). The new address is
   * marked unconfirmed and gets a confirmation link; the old one gets nothing,
   * since it may belong to someone else.
   */
  async setByAdmin(actingUserId: string, targetUserId: string, rawEmail: string, req?: Request) {
    const newEmail = normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, firstName: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (newEmail === user.email) {
      throw new BadRequestException({ message: 'The user already has this email address.', error: 'SAME_EMAIL' });
    }
    await this.assertEmailFree(newEmail);

    await this.prisma.$transaction(async (tx) => {
      await this.updateEmail(tx, user.id, { email: newEmail, pendingEmail: null, emailVerifiedAt: null });
      await tx.authToken.deleteMany({
        where: {
          userId: user.id,
          purpose: { in: [AuthTokenPurpose.EMAIL_CHANGE, AuthTokenPurpose.EMAIL_VERIFICATION] },
          usedAt: null,
        },
      });
    });
    const issued = await this.tokens.issue(
      user.id,
      AuthTokenPurpose.EMAIL_VERIFICATION,
      EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
      req ? this.ip(req) : null,
    );
    this.email.sendEmailVerification({ id: user.id, email: newEmail, firstName: user.firstName }, issued.token);

    await this.audit.log({
      action: 'USER_EMAIL_CHANGED_BY_ADMIN',
      entityType: 'User',
      entityId: user.id,
      userId: actingUserId,
      metadata: { targetUserId: user.id, previousEmail: user.email, email: newEmail },
      req,
    });
  }

  private async assertEmailFree(email: string): Promise<void> {
    const taken = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken) throw new ConflictException(EMAIL_TAKEN);
  }

  /** Another account may have taken the address since it was checked. */
  private async updateEmail(
    tx: Prisma.TransactionClient,
    userId: string,
    data: { email: string; pendingEmail: null; emailVerifiedAt: Date | null },
  ): Promise<void> {
    try {
      await tx.user.update({ where: { id: userId }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(EMAIL_TAKEN);
      }
      throw err;
    }
  }

  private throwLinkError(status: keyof typeof LINK_ERRORS): never {
    const [code, message] = LINK_ERRORS[status];
    throw new BadRequestException({ message, error: code });
  }

  private async limit(key: string, rule: RateLimitRule): Promise<void> {
    if (!(await this.rateLimit.consume(key, rule.limit, rule.windowSeconds))) {
      throw new HttpException(
        { message: 'Too many requests. Please try again later.', error: 'TOO_MANY_REQUESTS' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private ip(req: Request): string {
    return clientIp(req) ?? 'unknown';
  }
}
