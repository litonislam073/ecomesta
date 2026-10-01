import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  deleteExpiredConversations,
  retentionCutoff,
  retentionDays,
  type RetentionResult,
} from './ai-support-retention';

const INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 60 * 1000;

/**
 * Deletes website support chats older than AI_SUPPORT_RETENTION_DAYS (default
 * 365) after their last activity. Like the subscription scheduler it is an
 * in-process timer (the API has no job queue): every run is idempotent, so
 * several API replicas running it at once are harmless. Never runs under
 * NODE_ENV=test. Expired chats are hidden from every endpoint even before a
 * run deletes them. Manual run: `node dist/cli/ai-support-retention.js`.
 */
@Injectable()
export class AiSupportRetentionScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AiSupportRetentionScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private startup: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.logger.log(`Support chat retention: ${this.days()} days, cleanup every 6 hours`);
    this.startup = setTimeout(() => void this.runOnce(), STARTUP_DELAY_MS);
    this.startup.unref();
    this.timer = setInterval(() => void this.runOnce(), INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.startup) clearTimeout(this.startup);
    if (this.timer) clearInterval(this.timer);
  }

  days(): number {
    return retentionDays(this.config.get<unknown>('AI_SUPPORT_RETENTION_DAYS'));
  }

  /** Returns null when a run is already in progress in this process or it failed. */
  async runOnce(now: Date = new Date()): Promise<RetentionResult | null> {
    if (this.running) return null;
    this.running = true;
    const days = this.days();
    try {
      const result = await deleteExpiredConversations(this.prisma, retentionCutoff(days, now));
      // Counts only: never chat content or visitor contact details.
      if (result.conversations > 0) {
        this.logger.log(
          { retentionDays: days, conversations: result.conversations, messages: result.messages },
          'Support chat retention: expired chats deleted',
        );
      }
      return result;
    } catch (err) {
      this.logger.error(
        {
          retentionDays: days,
          // Name and Prisma code only: driver messages can include query values.
          error: err instanceof Error ? err.name : 'unknown',
          code: (err as { code?: unknown } | null)?.code,
        },
        'Support chat retention cleanup failed',
      );
      return null;
    } finally {
      this.running = false;
    }
  }
}
