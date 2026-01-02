import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class LockService implements OnModuleDestroy {
  private readonly logger = new Logger(LockService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });
  }

  /**
   * Acquire a distributed lock
   * @param key Lock key
   * @param ttlSeconds Time to live in seconds
   * @returns true if lock acquired, false otherwise
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const lockValue = `${process.pid}:${Date.now()}`;

    // SET key value NX EX ttl
    const result = await this.redis.set(
      lockKey,
      lockValue,
      'EX',
      ttlSeconds,
      'NX',
    );

    if (result === 'OK') {
      this.logger.debug(`Lock acquired: ${key}`);
      return true;
    }

    return false;
  }

  /**
   * Release a distributed lock
   * @param key Lock key
   */
  async releaseLock(key: string): Promise<void> {
    const lockKey = `lock:${key}`;
    await this.redis.del(lockKey);
    this.logger.debug(`Lock released: ${key}`);
  }

  /**
   * Check if a lock exists
   * @param key Lock key
   */
  async isLocked(key: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const exists = await this.redis.exists(lockKey);
    return exists === 1;
  }

  /**
   * Set a value in Redis with optional TTL
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  /**
   * Delete a key from Redis
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  onModuleDestroy() {
    this.redis.disconnect();
    this.logger.log('Disconnected from Redis');
  }
}
