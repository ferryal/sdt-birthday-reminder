import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LockService } from '../redis/lock.service';

export interface ComponentHealth {
  status: 'healthy' | 'unhealthy';
  message?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime: number;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly lockService: LockService,
  ) {
    this.startTime = Date.now();
  }

  async check(): Promise<HealthStatus> {
    const [databaseHealth, redisHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const isHealthy =
      databaseHealth.status === 'healthy' && redisHealth.status === 'healthy';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      components: {
        database: databaseHealth,
        redis: redisHealth,
      },
    };
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'healthy' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Database health check failed: ${message}`);
      return { status: 'unhealthy', message };
    }
  }

  private async checkRedis(): Promise<ComponentHealth> {
    try {
      // Use the lock service to verify Redis connectivity
      const testKey = 'health-check-test';
      await this.lockService.set(testKey, 'ok', 5);
      const value = await this.lockService.get(testKey);
      if (value === 'ok') {
        return { status: 'healthy' };
      }
      return { status: 'unhealthy', message: 'Redis read/write failed' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Redis health check failed: ${message}`);
      return { status: 'unhealthy', message };
    }
  }
}
