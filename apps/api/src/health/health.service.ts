import { Injectable } from '@nestjs/common';
import type { HealthStatus, ServiceHealth } from '@ecomesta/types';
import { toIsoTimestamp } from '@ecomesta/utils';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type ProbeResult = { ok: boolean; latencyMs: number; message?: string };

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly logger: Logger,
  ) {}

  async getStatus(): Promise<HealthStatus> {
    const [database, redis] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.isHealthy(),
    ]);

    const allUp = database.ok && redis.ok;
    const anyUp = database.ok || redis.ok;

    return {
      status: allUp ? 'ok' : anyUp ? 'degraded' : 'error',
      timestamp: toIsoTimestamp(),
      version: process.env.npm_package_version ?? '0.1.0',
      services: {
        database: this.toServiceHealth('database', database),
        redis: this.toServiceHealth('redis', redis),
      },
    };
  }

  /**
   * The health endpoint is public; driver error text (hostnames, users,
   * connection strings) is logged but only returned outside production.
   */
  private toServiceHealth(name: string, probe: ProbeResult): ServiceHealth {
    if (!probe.ok && probe.message) {
      this.logger.warn({ service: name, reason: probe.message }, 'Health probe failed');
    }
    const exposeMessage = process.env.NODE_ENV !== 'production';
    return {
      status: probe.ok ? 'up' : 'down',
      latencyMs: probe.latencyMs,
      ...(probe.message && exposeMessage ? { message: probe.message } : {}),
    };
  }
}
