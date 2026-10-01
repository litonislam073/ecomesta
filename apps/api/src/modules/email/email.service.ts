import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { EmailDeliveryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailComposer, type ComposedEmail } from './email-composer.service';
import { EmailDispatcher } from './email-dispatcher.service';
import { EmailConfigService } from './email.config';
import {
  EMAIL_EVENTS,
  type AiSupportHandoffParams,
  type BillingPaymentParams,
  type OutboxEmail,
  type PasswordChangedParams,
  type StoreCreatedParams,
  type SupportRequestParams,
} from './email.events';
import { EMAIL_PROVIDER, EmailSendError, type EmailProvider } from './providers/email-provider';

/** In-process attempts for token-bearing emails, which are never persisted for later retry. */
const DIRECT_RETRY_DELAYS_MS = [2_000, 8_000];

interface DeliveryTarget {
  userId: string | null;
  tenantId?: string | null;
  storeId?: string | null;
}

/**
 * The one entry point for transactional email.
 *
 * - Outbox emails (welcome, store created, password changed, support) are
 *   written to `email_deliveries` — inside the caller's transaction when one
 *   is passed — and delivered by EmailDispatcher with retries. A unique
 *   idempotency key per business event makes duplicates impossible.
 * - Token-bearing emails (password reset, verification) are rendered and sent
 *   in the background immediately; the raw token is never stored, so a failed
 *   delivery is logged and the user simply requests a new link.
 */
@Injectable()
export class EmailService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly composer: EmailComposer,
    private readonly dispatcher: EmailDispatcher,
    private readonly config: EmailConfigService,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  supportEmail(): string | null {
    return this.config.supportEmail();
  }

  /** Queues a templated email. With `tx`, call `dispatchPending()` after the transaction commits. */
  async sendTemplate(
    email: OutboxEmail,
    target: DeliveryTarget & { idempotencyKey: string },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).emailDelivery.createMany({
      data: [
        {
          eventType: email.event,
          idempotencyKey: target.idempotencyKey,
          userId: target.userId,
          tenantId: target.tenantId ?? null,
          storeId: target.storeId ?? null,
          payload: email.params as unknown as Prisma.InputJsonValue,
        },
      ],
      skipDuplicates: true,
    });
    if (!tx) this.dispatchPending();
  }

  /** Nudges the outbox after a committed transaction; the timer would pick rows up anyway. */
  dispatchPending(): void {
    this.dispatcher.kick();
  }

  sendWelcomeEmail(user: { id: string; firstName: string | null }, tx?: Prisma.TransactionClient) {
    return this.sendTemplate(
      { event: EMAIL_EVENTS.MERCHANT_WELCOME, params: { firstName: user.firstName } },
      { userId: user.id, idempotencyKey: `${EMAIL_EVENTS.MERCHANT_WELCOME}:${user.id}` },
      tx,
    );
  }

  sendStoreCreated(
    target: { userId: string; tenantId: string; storeId: string },
    params: StoreCreatedParams,
    tx?: Prisma.TransactionClient,
  ) {
    return this.sendTemplate(
      { event: EMAIL_EVENTS.STORE_CREATED, params },
      { ...target, idempotencyKey: `${EMAIL_EVENTS.STORE_CREATED}:${target.storeId}` },
      tx,
    );
  }

  sendPasswordChanged(
    userId: string,
    params: PasswordChangedParams,
    eventId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.sendTemplate(
      { event: EMAIL_EVENTS.PASSWORD_CHANGED, params },
      { userId, idempotencyKey: `${EMAIL_EVENTS.PASSWORD_CHANGED}:${eventId}` },
      tx,
    );
  }

  sendSupportRequest(
    target: { userId: string; tenantId: string | null; storeId: string | null },
    params: SupportRequestParams,
    requestId: string,
  ) {
    return this.sendTemplate(
      { event: EMAIL_EVENTS.SUPPORT_REQUEST, params },
      { ...target, idempotencyKey: `${EMAIL_EVENTS.SUPPORT_REQUEST}:${target.userId}:${requestId}` },
    );
  }

  /**
   * Queues a manual-payment email in the caller's transaction. SUBMITTED goes to
   * Ecomesta's billing inbox (replies reach `userId`); APPROVED and REJECTED go
   * to `userId`. One email per payment and event.
   */
  sendBillingPayment(
    event:
      | typeof EMAIL_EVENTS.BILLING_PAYMENT_SUBMITTED
      | typeof EMAIL_EVENTS.BILLING_PAYMENT_APPROVED
      | typeof EMAIL_EVENTS.BILLING_PAYMENT_REJECTED,
    target: { userId: string; tenantId: string },
    params: BillingPaymentParams,
    tx?: Prisma.TransactionClient,
  ) {
    return this.sendTemplate(
      { event, params },
      { ...target, storeId: null, idempotencyKey: `${event}:${params.paymentId}` },
      tx,
    );
  }

  /** Queues a website visitor's request for a person to the support inbox (no user account involved). */
  sendAiSupportHandoff(params: AiSupportHandoffParams) {
    return this.sendTemplate(
      { event: EMAIL_EVENTS.AI_SUPPORT_HANDOFF, params },
      { userId: null, tenantId: null, storeId: null, idempotencyKey: `${EMAIL_EVENTS.AI_SUPPORT_HANDOFF}:${params.reference}` },
    );
  }

  sendPasswordReset(user: { id: string; email: string; firstName: string | null }, token: string): void {
    this.background(async () => this.send(this.composer.passwordReset(user, token), { userId: user.id }));
  }

  sendEmailVerification(user: { id: string; email: string; firstName: string | null }, token: string): void {
    this.background(async () => this.send(this.composer.emailVerification(user, token), { userId: user.id }));
  }

  /**
   * Sends one composed email now, with short in-process retries, and records
   * the outcome in the delivery log (without payload). Never throws.
   */
  async send(composed: ComposedEmail, target: DeliveryTarget): Promise<EmailDeliveryStatus> {
    const row = await this.prisma.emailDelivery.create({
      data: {
        eventType: composed.message.event,
        status: EmailDeliveryStatus.SENDING,
        userId: target.userId,
        tenantId: target.tenantId ?? null,
        storeId: target.storeId ?? null,
        recipientHash: composed.recipientHash,
        provider: this.provider.name,
        lockedAt: new Date(),
      },
      select: { id: true },
    });

    for (let attempt = 1; ; attempt += 1) {
      try {
        const result = await this.provider.sendEmail(composed.message);
        const status = result.delivered ? EmailDeliveryStatus.SENT : EmailDeliveryStatus.SKIPPED;
        await this.prisma.emailDelivery.update({
          where: { id: row.id },
          data: {
            status,
            attempts: attempt,
            sentAt: result.delivered ? new Date() : null,
            providerMessageId: result.messageId?.slice(0, 255) ?? null,
            lockedAt: null,
          },
        });
        return status;
      } catch (error) {
        const failure = error instanceof EmailSendError ? error : new EmailSendError('unknown', false);
        const delay = DIRECT_RETRY_DELAYS_MS[attempt - 1];
        if (failure.permanent || delay === undefined) {
          await this.prisma.emailDelivery.update({
            where: { id: row.id },
            data: {
              status: EmailDeliveryStatus.FAILED,
              attempts: attempt,
              errorCategory: failure.category,
              failedAt: new Date(),
              lockedAt: null,
            },
          });
          this.logger.warn(`Email ${composed.message.event} delivery ${row.id} failed (${failure.category})`);
          return EmailDeliveryStatus.FAILED;
        }
        await sleep(this.config.isTest() ? 0 : delay);
      }
    }
  }

  /** Resolves once background sends have finished (tests and graceful shutdown). */
  async whenIdle(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.allSettled([...this.inFlight]);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.whenIdle();
  }

  private background(work: () => Promise<unknown>): void {
    const tracked = Promise.resolve()
      .then(work)
      .then(() => undefined)
      .catch((err: unknown) => {
        this.logger.error({ err: err instanceof Error ? err.name : 'unknown' }, 'Background email send failed');
      })
      .finally(() => {
        this.inFlight.delete(tracked);
      });
    this.inFlight.add(tracked);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
