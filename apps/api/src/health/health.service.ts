import { Injectable } from '@nestjs/common';
import type { HealthStatus, ServiceHealth } from '@ecomesta/types';
import { toIsoTimestamp } from '@ecomesta/utils';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getStatus(): Promise<HealthStatus> {
    const [database, redis] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.isHealthy(),
    ]);

    const databaseHealth: ServiceHealth = {
      status: database.ok ? 'up' : 'down',
      latencyMs: database.latencyMs,
      ...(database.message ? { message: database.message } : {}),
    };

    const redisHealth: ServiceHealth = {
      status: redis.ok ? 'up' : 'down',
      latencyMs: redis.latencyMs,
      ...(redis.message ? { message: redis.message } : {}),
    };

    const allUp = database.ok && redis.ok;
    const anyUp = database.ok || redis.ok;

    return {
      status: allUp ? 'ok' : anyUp ? 'degraded' : 'error',
      timestamp: toIsoTimestamp(),
      version: process.env.npm_package_version ?? '0.1.0',
      services: {
        database: databaseHealth,
        redis: redisHealth,
      },
    };
  }
}
