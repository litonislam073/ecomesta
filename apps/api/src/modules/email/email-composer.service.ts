import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AuthTokenPurpose } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTokenService } from '../auth-tokens/auth-token.service';
import { EmailConfigService } from './email.config';
import {
  EMAIL_EVENTS,
  type BillingPaymentParams,
  type MerchantWelcomeParams,
  type OutboxEmail,
  type PasswordChangedParams,
  type StoreCreatedParams,
  type SupportRequestParams,
} from './email.events';
import type { EmailMessage } from './providers/email-provider';
import { EmailSendError } from './providers/email-provider';
import type { EmailBrand } from './templates/layout';
import {
  billingPaymentApprovedEmail,
  billingPaymentRejectedEmail,
  billingPaymentSubmittedEmail,
  emailVerificationEmail,
  passwordChangedEmail,
  passwordResetEmail,
  storeCreatedEmail,
  supportRequestEmail,
  welcomeEmail,
} from './templates/templates';

export const PASSWORD_RESET_TTL_MINUTES = 60;
export const EMAIL_VERIFICATION_TTL_HOURS = 48;

/** Safe reference to a recipient for delivery logs (never the address itself). */
export function recipientHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export interface ComposedEmail {
  message: EmailMessage;
  recipientHash: string;
}

interface OutboxRow {
  eventType: string;
  payload: unknown;
  userId: string | null;
  tenantId: string | null;
  storeId: string | null;
}

@Injectable()
export class EmailComposer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: EmailConfigService,
    private readonly authTokens: AuthTokenService,
  ) {}

  brand(): EmailBrand {
    return {
      logoUrl: this.config.logoUrl(),
      appUrl: this.config.appPublicUrl(),
      merchantUrl: this.config.merchantUrl(),
      supportEmail: this.config.supportEmail(),
    };
  }

  /** Link to the merchant app; the token rides in the fragment so it never reaches server or proxy logs. */
  tokenUrl(path: '/reset-password' | '/verify-email', token: string): string {
    return `${this.config.merchantUrl()}${path}#token=${token}`;
  }

  passwordReset(user: { email: string; firstName: string | null }, token: string): ComposedEmail {
    const rendered = passwordResetEmail(
      {
        firstName: user.firstName,
        resetUrl: this.tokenUrl('/reset-password', token),
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      },
      this.brand(),
    );
    return this.toMessage(EMAIL_EVENTS.PASSWORD_RESET, user.email, rendered);
  }

  emailVerification(user: { email: string; firstName: string | null }, token: string): ComposedEmail {
    const rendered = emailVerificationEmail(
      {
        firstName: user.firstName,
        verifyUrl: this.tokenUrl('/verify-email', token),
        expiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
      },
      this.brand(),
    );
    return this.toMessage(EMAIL_EVENTS.EMAIL_VERIFICATION, user.email, rendered);
  }

  /** Renders a queued outbox row. Throws EmailSendError when it can never be sent. */
  async composeOutbox(row: OutboxRow): Promise<ComposedEmail> {
    if (row.payload === null || typeof row.payload !== 'object') {
      throw new EmailSendError('configuration', true);
    }
    const email = { event: row.eventType, params: row.payload } as OutboxEmail;
    const brand = this.brand();

    if (email.event === EMAIL_EVENTS.SUPPORT_REQUEST) {
      return this.composeSupport(email.params, row, brand);
    }
    if (email.event === EMAIL_EVENTS.BILLING_PAYMENT_SUBMITTED) {
      return this.composeBillingPaymentSubmitted(email.params, row, brand);
    }

    const user = row.userId
      ? await this.prisma.user.findUnique({
          where: { id: row.userId },
          select: { id: true, email: true, emailVerifiedAt: true },
        })
      : null;
    if (!user) throw new EmailSendError('configuration', true);

    switch (email.event) {
      case EMAIL_EVENTS.MERCHANT_WELCOME:
        return this.toMessage(
          email.event,
          user.email,
          welcomeEmail(email.params as MerchantWelcomeParams, brand, await this.verificationLink(user)),
        );
      case EMAIL_EVENTS.STORE_CREATED: {
        const params = email.params as StoreCreatedParams;
        return this.toMessage(
          email.event,
          user.email,
          storeCreatedEmail(params, brand, this.config.storeUrl(params.storeSlug)),
        );
      }
      case EMAIL_EVENTS.PASSWORD_CHANGED:
        return this.toMessage(email.event, user.email, passwordChangedEmail(email.params as PasswordChangedParams, brand));
      case EMAIL_EVENTS.BILLING_PAYMENT_APPROVED:
      case EMAIL_EVENTS.BILLING_PAYMENT_REJECTED: {
        const profile = await this.prisma.user.findUnique({
          where: { id: user.id },
          select: { firstName: true },
        });
        const render =
          email.event === EMAIL_EVENTS.BILLING_PAYMENT_APPROVED
            ? billingPaymentApprovedEmail
            : billingPaymentRejectedEmail;
        return this.toMessage(
          email.event,
          user.email,
          render(
            email.params as BillingPaymentParams,
            brand,
            profile?.firstName ?? null,
            `${this.config.merchantUrl()}/dashboard/billing`,
          ),
        );
      }
      default:
        throw new EmailSendError('configuration', true);
    }
  }

  /** Fresh verification link for unverified users; issuing replaces any older unused link. */
  private async verificationLink(user: { id: string; emailVerifiedAt: Date | null }) {
    if (user.emailVerifiedAt) return null;
    const issued = await this.authTokens.issue(
      user.id,
      AuthTokenPurpose.EMAIL_VERIFICATION,
      EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
    );
    return { url: this.tokenUrl('/verify-email', issued.token), expiresInHours: EMAIL_VERIFICATION_TTL_HOURS };
  }

  private async composeSupport(
    params: SupportRequestParams,
    row: OutboxRow,
    brand: EmailBrand,
  ): Promise<ComposedEmail> {
    const supportEmail = this.config.supportEmail();
    if (!supportEmail || !row.userId) throw new EmailSendError('configuration', true);
    const sender = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!sender) throw new EmailSendError('configuration', true);
    const name = [sender.firstName, sender.lastName].filter(Boolean).join(' ') || sender.email;
    const rendered = supportRequestEmail(params, brand, {
      name,
      email: sender.email,
      userId: sender.id,
      tenantId: row.tenantId,
      storeId: row.storeId,
    });
    const composed = this.toMessage(EMAIL_EVENTS.SUPPORT_REQUEST, supportEmail, rendered);
    composed.message.replyTo = sender.email;
    return composed;
  }

  /** To Ecomesta's billing inbox; replies go to the merchant who paid. */
  private async composeBillingPaymentSubmitted(
    params: BillingPaymentParams,
    row: OutboxRow,
    brand: EmailBrand,
  ): Promise<ComposedEmail> {
    if (!row.userId) throw new EmailSendError('configuration', true);
    const sender = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { email: true, firstName: true, lastName: true },
    });
    if (!sender) throw new EmailSendError('configuration', true);
    const name = [sender.firstName, sender.lastName].filter(Boolean).join(' ') || sender.email;
    const rendered = billingPaymentSubmittedEmail(
      params,
      brand,
      { name, email: sender.email },
      `${this.config.adminUrl()}/dashboard/payments`,
    );
    const composed = this.toMessage(
      EMAIL_EVENTS.BILLING_PAYMENT_SUBMITTED,
      this.config.billingNotificationEmail(),
      rendered,
    );
    composed.message.replyTo = sender.email;
    return composed;
  }

  private toMessage(
    event: string,
    to: string,
    rendered: { subject: string; html: string; text: string },
  ): ComposedEmail {
    return {
      message: { to, event, subject: rendered.subject, html: rendered.html, text: rendered.text },
      recipientHash: recipientHash(to),
    };
  }
}
