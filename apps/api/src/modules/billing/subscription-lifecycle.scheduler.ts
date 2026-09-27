import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const STARTUP_DELAY_MS = 30 * 1000;

/**
 * In-process timer for subscription evaluation (the API has no job queue).
 * Every pass is idempotent and uses conditional updates, so several API
 * replicas running it at once cannot double-apply a transition.
 * `SUBSCRIPTION_EVALUATION_INTERVAL_MS=0` disables it; it never runs under NODE_ENV=test.
 */
@Injectable()
export class SubscriptionLifecycleScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SubscriptionLifecycleScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private startup: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly lifecycle: SubscriptionLifecycleService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    const intervalMs = this.intervalMs();
    if (intervalMs === 0) {
      this.logger.log('Subscription evaluation scheduler disabled');
      return;
    }
    this.startup = setTimeout(() => void this.runOnce(), STARTUP_DELAY_MS);
    this.startup.unref();
    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.startup) clearTimeout(this.startup);
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.lifecycle.evaluateDue(now);
      if (result.movedToGrace || result.suspended) {
        this.logger.log(
          `Subscription evaluation: ${result.movedToGrace} entered grace, ${result.suspended} suspended (${result.storesSuspended} stores)`,
        );
      }
    } catch (err) {
      this.logger.error({ err }, 'Subscription evaluation failed');
    } finally {
      this.running = false;
    }
  }

  private intervalMs(): number {
    if (this.config.get<string>('NODE_ENV') === 'test') return 0;
    const raw = this.config.get<string>('SUBSCRIPTION_EVALUATION_INTERVAL_MS');
    if (raw === undefined || raw.trim() === '') return DEFAULT_INTERVAL_MS;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_INTERVAL_MS;
  }
}
