import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class AuthRateLimitService implements OnModuleDestroy {
  private readonly memoryCounters = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly redis: RedisService) {}

  onModuleDestroy(): void {
    this.memoryCounters.clear();
  }

  async consume(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    try {
      const redisKey = `auth:rl:${key}`;
      const count = await this.redis.getClient().incr(redisKey);
      if (count === 1) {
        await this.redis.getClient().expire(redisKey, windowSeconds);
      }
      return count <= limit;
    } catch {
      return this.consumeMemory(key, limit, windowSeconds);
    }
  }

  private consumeMemory(key: string, limit: number, windowSeconds: number): boolean {
    const now = Date.now();
    const existing = this.memoryCounters.get(key);
    if (!existing || existing.resetAt <= now) {
      this.memoryCounters.set(key, {
        count: 1,
        resetAt: now + windowSeconds * 1000,
      });
      return true;
    }

    existing.count += 1;
    this.memoryCounters.set(key, existing);
    return existing.count <= limit;
  }
}
