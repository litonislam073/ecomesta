import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AuthTokenPurpose, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { clientIp } from '../../common/utils/request-host.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthTokenService, type TokenInspection } from '../auth-tokens/auth-token.service';
import {
  EMAIL_VERIFICATION_TTL_HOURS,
  PASSWORD_RESET_TTL_MINUTES,
  recipientHash,
} from '../email/email-composer.service';
import { EmailService } from '../email/email.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { EMAIL_RATE_LIMITS, type RateLimitRule } from './email-rate-limits';
import { PasswordService } from './password.service';

export const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for that email, you will receive password reset instructions.';

const TOKEN_ERRORS = {
  reset: {
    invalid: ['RESET_TOKEN_INVALID', 'This password reset link is invalid. Request a new one.'],
    expired: ['RESET_TOKEN_EXPIRED', 'This password reset link has expired. Request a new one.'],
    used: ['RESET_TOKEN_USED', 'This password reset link has already been used. Request a new one if needed.'],
  },
  verify: {
    invalid: ['VERIFICATION_TOKEN_INVALID', 'This verification link is invalid. Request a new one.'],
    expired: ['VERIFICATION_TOKEN_EXPIRED', 'This verification link has expired. Request a new one.'],
    used: ['VERIFICATION_TOKEN_USED', 'This verification link has already been used.'],
  },
} as const;

/** Forgot/reset password and email verification. */
@Injectable()
export class AccountRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: AuthTokenService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  /** Always answers the same way so the response never reveals whether an account exists. */
  async forgotPassword(rawEmail: string, req: Request) {
    const ip = this.ip(req);
    const email = rawEmail.trim().toLowerCase();
    await this.limit(`forgot:ip:${ip}`, EMAIL_RATE_LIMITS.forgotPasswordPerIp);
    await this.limit(`forgot:email:${recipientHash(email)}`, EMAIL_RATE_LIMITS.forgotPasswordPerEmail);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, status: true },
    });

    if (user && user.status === UserStatus.ACTIVE) {
      const issued = await this.tokens.issue(
        user.id,
        AuthTokenPurpose.PASSWORD_RESET,
        PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
        ip,
      );
      this.email.sendPasswordReset(user, issued.token);
      await this.audit.log({
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'User',
        entityId: user.id,
        userId: user.id,
        req,
      });
    }

    return { success: true as const, data: { message: FORGOT_PASSWORD_MESSAGE } };
  }

  async validateResetToken(token: string, req: Request) {
    await this.limit(`reset:ip:${this.ip(req)}`, EMAIL_RATE_LIMITS.resetPasswordPerIp);
    const inspection = await this.tokens.inspect(token, AuthTokenPurpose.PASSWORD_RESET);
    this.assertValid(inspection, 'reset');
    return { success: true as const, data: { valid: true } };
  }

  /**
   * Sets the new password, burns the token and revokes every refresh session in
   * one transaction. The user signs in again through the normal login flow.
   */
  async resetPassword(token: string, password: string, req: Request) {
    await this.limit(`reset:ip:${this.ip(req)}`, EMAIL_RATE_LIMITS.resetPasswordPerIp);
    const inspection = await this.tokens.inspect(token, AuthTokenPurpose.PASSWORD_RESET);
    const record = this.assertValid(inspection, 'reset');

    const passwordHash = await this.passwords.hash(password);
    const now = new Date();

    const { user, sessionsRevoked } = await this.prisma.$transaction(async (tx) => {
      if (!(await this.tokens.consume(tx, record.id, now))) {
        this.throwTokenError('reset', 'used');
      }
      const current = await tx.user.findUniqueOrThrow({
        where: { id: record.userId },
        select: { id: true, firstName: true, emailVerifiedAt: true },
      });
      await tx.user.update({
        where: { id: current.id },
        // Opening the emailed link proves control of the mailbox.
        data: { passwordHash, emailVerifiedAt: current.emailVerifiedAt ?? now },
      });
      const revoked = await tx.authSession.updateMany({
        where: { userId: current.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.authToken.deleteMany({
        where: { userId: current.id, purpose: AuthTokenPurpose.PASSWORD_RESET, usedAt: null },
      });
      await this.email.sendPasswordChanged(
        current.id,
        { firstName: current.firstName, changedAt: now.toISOString() },
        record.id,
        tx,
      );
      return { user: current, sessionsRevoked: revoked.count };
    });
    this.email.dispatchPending();

    await this.audit.log({
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      metadata: { sessionsRevoked },
      req,
    });

    return { success: true as const, data: { passwordReset: true } };
  }

  async requestEmailVerification(userId: string, req: Request) {
    await this.limit(`verify-send:user:${userId}`, EMAIL_RATE_LIMITS.verificationEmailPerUser);
    await this.limit(`verify-send:ip:${this.ip(req)}`, EMAIL_RATE_LIMITS.verificationEmailPerIp);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, emailVerifiedAt: true },
    });
    if (user.emailVerifiedAt) {
      return { success: true as const, data: { alreadyVerified: true, sent: false } };
    }
    const issued = await this.tokens.issue(
      user.id,
      AuthTokenPurpose.EMAIL_VERIFICATION,
      EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
      this.ip(req),
    );
    this.email.sendEmailVerification(user, issued.token);
    return { success: true as const, data: { alreadyVerified: false, sent: true } };
  }

  async confirmEmailVerification(token: string, req: Request) {
    await this.limit(`verify:ip:${this.ip(req)}`, EMAIL_RATE_LIMITS.verifyEmailPerIp);
    const inspection = await this.tokens.inspect(token, AuthTokenPurpose.EMAIL_VERIFICATION);
    const record = this.assertValid(inspection, 'verify');
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (!(await this.tokens.consume(tx, record.id, now))) {
        this.throwTokenError('verify', 'used');
      }
      await tx.user.updateMany({
        where: { id: record.userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      });
    });

    await this.audit.log({
      action: 'EMAIL_VERIFIED',
      entityType: 'User',
      entityId: record.userId,
      userId: record.userId,
      req,
    });
    return { success: true as const, data: { verified: true } };
  }

  private assertValid(inspection: TokenInspection, kind: keyof typeof TOKEN_ERRORS) {
    if (inspection.status !== 'valid') this.throwTokenError(kind, inspection.status);
    return inspection.token;
  }

  private throwTokenError(kind: keyof typeof TOKEN_ERRORS, status: 'invalid' | 'expired' | 'used'): never {
    const [code, message] = TOKEN_ERRORS[kind][status];
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
