import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Logger } from 'nestjs-pino';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly logger: Logger) {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from PostgreSQL');
  }

  async isHealthy(): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
    const started = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      return { ok: false, latencyMs: Date.now() - started, message };
    }
  }
}
