import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthService } from './health.service';
import { LockService } from '../redis/lock.service';

describe('HealthService', () => {
  let service: HealthService;
  let mockDataSource: { query: jest.Mock };
  let mockLockService: { set: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn(),
    };

    mockLockService = {
      set: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        {
          provide: LockService,
          useValue: mockLockService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('check', () => {
    it('should return healthy status when all components are healthy', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      mockLockService.set.mockResolvedValue(undefined);
      mockLockService.get.mockResolvedValue('ok');

      const result = await service.check();

      expect(result.status).toBe('healthy');
      expect(result.components.database.status).toBe('healthy');
      expect(result.components.redis.status).toBe('healthy');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should return unhealthy status when database is down', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Connection refused'));
      mockLockService.set.mockResolvedValue(undefined);
      mockLockService.get.mockResolvedValue('ok');

      const result = await service.check();

      expect(result.status).toBe('unhealthy');
      expect(result.components.database.status).toBe('unhealthy');
      expect(result.components.database.message).toBe('Connection refused');
      expect(result.components.redis.status).toBe('healthy');
    });

    it('should return unhealthy status when Redis is down', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      mockLockService.set.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      const result = await service.check();

      expect(result.status).toBe('unhealthy');
      expect(result.components.database.status).toBe('healthy');
      expect(result.components.redis.status).toBe('unhealthy');
      expect(result.components.redis.message).toBe('Redis connection failed');
    });

    it('should return unhealthy status when Redis read fails', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      mockLockService.set.mockResolvedValue(undefined);
      mockLockService.get.mockResolvedValue(null);

      const result = await service.check();

      expect(result.status).toBe('unhealthy');
      expect(result.components.redis.status).toBe('unhealthy');
      expect(result.components.redis.message).toBe('Redis read/write failed');
    });

    it('should return unhealthy status when both components are down', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Database error'));
      mockLockService.set.mockRejectedValue(new Error('Redis error'));

      const result = await service.check();

      expect(result.status).toBe('unhealthy');
      expect(result.components.database.status).toBe('unhealthy');
      expect(result.components.redis.status).toBe('unhealthy');
    });
  });
});
