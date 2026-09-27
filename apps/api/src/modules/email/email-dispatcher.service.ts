import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { EmailDeliveryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailComposer } from './email-composer.service';
import { EmailConfigService } from './email.config';
import { EMAIL_PROVIDER, EmailSendError, type EmailProvider } from './providers/email-provider';

const DEFAULT_INTERVAL_MS = 30 * 1000;
const STARTUP_DELAY_MS = 15 * 1000;
const BATCH_SIZE = 20;
export const MAX_EMAIL_ATTEMPTS = 5;
/** A SENDING row older than this was abandoned by a crashed process. */
const STALE_LOCK_MS = 10 * 60 * 1000;
/** Delay before attempt n+1, indexed by attempts already made. */
const BACKOFF_MS = [0, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

/**
 * Delivers the email outbox. Rows are claimed with a conditional update on
 * (status, attempts), so concurrent passes — a kick, the timer, or another API
 * replica — can never send the same row twice. Runs in-process like the
 * subscription scheduler; there is no separate worker container.
 */
@Injectable()
export class EmailDispatcher implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(EmailDispatcher.name);
  private timer: NodeJS.Timeout | null = null;
  private startup: NodeJS.Timeout | null = null;
  private current: Promise<void> | null = null;
  private rerun = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly composer: EmailComposer,
    private readonly config: EmailConfigService,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  onApplicationBootstrap(): void {
    const intervalMs = this.config.dispatchIntervalMs(DEFAULT_INTERVAL_MS);
    if (intervalMs === 0) return;
    this.startup = setTimeout(() => this.kick(), STARTUP_DELAY_MS);
    this.startup.unref();
    this.timer = setInterval(() => this.kick(), intervalMs);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.startup) clearTimeout(this.startup);
    if (this.timer) clearInterval(this.timer);
    this.rerun = false;
    await this.current;
  }

  /** Starts a background pass without blocking the caller. Disabled under NODE_ENV=test. */
  kick(): void {
    if (this.config.isTest()) return;
    if (this.current) {
      this.rerun = true;
      return;
    }
    this.current = this.loop().finally(() => {
      this.current = null;
    });
  }

  private async loop(): Promise<void> {
    do {
      this.rerun = false;
      try {
        await this.processDue();
      } catch (err) {
        this.logger.error({ err }, 'Email outbox pass failed');
      }
    } while (this.rerun);
  }

  /** One pass over due rows. Returns how many rows this pass claimed. */
  async processDue(now = new Date()): Promise<number> {
    const candidates = await this.prisma.emailDelivery.findMany({
      where: {
        OR: [
          { status: EmailDeliveryStatus.PENDING, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
          { status: EmailDeliveryStatus.FAILED, nextAttemptAt: { lte: now } },
          { status: EmailDeliveryStatus.SENDING, lockedAt: { lt: new Date(now.getTime() - STALE_LOCK_MS) } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
      select: { id: true, status: true, attempts: true },
    });

    let claimed = 0;
    for (const candidate of candidates) {
      const claim = await this.prisma.emailDelivery.updateMany({
        where: { id: candidate.id, status: candidate.status, attempts: candidate.attempts },
        data: {
          status: EmailDeliveryStatus.SENDING,
          lockedAt: now,
          attempts: { increment: 1 },
        },
      });
      if (claim.count !== 1) continue;
      claimed += 1;
      await this.deliver(candidate.id, candidate.attempts + 1, now);
    }
    return claimed;
  }

  private async deliver(id: string, attempt: number, claimedAt: Date): Promise<void> {
    const row = await this.prisma.emailDelivery.findUniqueOrThrow({ where: { id } });
    const guard = { id, status: EmailDeliveryStatus.SENDING, lockedAt: claimedAt };
    try {
      const composed = await this.composer.composeOutbox(row);
      const result = await this.provider.sendEmail(composed.message);
      await this.prisma.emailDelivery.updateMany({
        where: guard,
        data: {
          status: result.delivered ? EmailDeliveryStatus.SENT : EmailDeliveryStatus.SKIPPED,
          provider: this.provider.name,
          providerMessageId: result.messageId?.slice(0, 255) ?? null,
          recipientHash: composed.recipientHash,
          sentAt: result.delivered ? new Date() : null,
          errorCategory: null,
          nextAttemptAt: null,
          lockedAt: null,
          payload: Prisma.DbNull,
        },
      });
    } catch (error) {
      const failure = error instanceof EmailSendError ? error : new EmailSendError('unknown', false);
      if (!(error instanceof EmailSendError)) {
        this.logger.error({ err: error, deliveryId: id }, 'Email composition failed');
      }
      const final = failure.permanent || attempt >= MAX_EMAIL_ATTEMPTS;
      const now = new Date();
      await this.prisma.emailDelivery.updateMany({
        where: guard,
        data: {
          status: EmailDeliveryStatus.FAILED,
          provider: this.provider.name,
          errorCategory: failure.category,
          failedAt: now,
          lockedAt: null,
          nextAttemptAt: final ? null : new Date(now.getTime() + (BACKOFF_MS[attempt] ?? BACKOFF_MS.at(-1)!)),
          ...(final ? { payload: Prisma.DbNull } : {}),
        },
      });
      this.logger.warn(
        `Email ${row.eventType} delivery ${id} failed (${failure.category}, attempt ${attempt}${final ? ', giving up' : ', will retry'})`,
      );
    }
  }
}
