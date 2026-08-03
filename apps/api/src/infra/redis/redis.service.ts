import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Cliente Redis para cache de agregações e pub/sub (BLUEPRINT seção 5.3).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(
      config.get('REDIS_URL', 'redis://localhost:6379'),
      { maxRetriesPerRequest: null },
    );
  }

  async cacheGet<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async cacheSet(key: string, value: unknown, ttlSec = 60): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSec);
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    const keys = await this.client.keys(`${prefix}*`);
    if (keys.length) await this.client.del(keys);
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    await this.client.publish(channel, JSON.stringify(payload));
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
