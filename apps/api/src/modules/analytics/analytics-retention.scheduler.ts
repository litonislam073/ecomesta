import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

const INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 90 * 1000;
/** Reports go back a year; a little more is kept for the year-on-year comparison. */
export const ANALYTICS_RETENTION_DAYS = 400;

/**
 * Deletes storefront analytics events older than 400 days. An in-process
 * timer like the other schedulers; every run is idempotent. Never runs under
 * NODE_ENV=test.
 */
@Injectable()
export class AnalyticsRetentionScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AnalyticsRetentionScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private startup: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.startup = setTimeout(() => void this.runOnce(), STARTUP_DELAY_MS);
    this.startup.unref();
    this.timer = setInterval(() => void this.runOnce(), INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.startup) clearTimeout(this.startup);
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(now: Date = new Date()): Promise<number | null> {
    if (this.running) return null;
    this.running = true;
    try {
      const cutoff = new Date(now.getTime() - ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const { count } = await this.prisma.storeAnalyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
      if (count > 0) this.logger.log({ events: count }, 'Analytics retention: old events deleted');
      return count;
    } catch (err) {
      this.logger.error({ error: err instanceof Error ? err.name : 'unknown' }, 'Analytics retention cleanup failed');
      return null;
    } finally {
      this.running = false;
    }
  }
}
