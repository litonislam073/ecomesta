import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Logger } from 'nestjs-pino';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error({ err: error }, 'Redis client error');
    });

    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.logger.log('Redis disconnected');
    }
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client is not initialized');
    }
    return this.client;
  }

  async isHealthy(): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
    const started = Date.now();
    try {
      const result = await this.getClient().ping();
      if (result !== 'PONG') {
        return {
          ok: false,
          latencyMs: Date.now() - started,
          message: `Unexpected ping response: ${result}`,
        };
      }
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Redis error';
      return { ok: false, latencyMs: Date.now() - started, message };
    }
  }
}
