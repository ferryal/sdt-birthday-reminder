import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BirthdayService } from './birthday.service';
import {
  BirthdayMessage,
  MessageStatus,
} from './entities/birthday-message.entity';
import { User } from '../users/entities/user.entity';

describe('BirthdayService', () => {
  let service: BirthdayService;
  let repository: jest.Mocked<Repository<BirthdayMessage>>;

  const mockUser: Partial<User> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    timezone: 'America/New_York',
  };

  const mockMessage: Partial<BirthdayMessage> = {
    id: 'message-123',
    userId: mockUser.id,
    year: 2024,
    status: MessageStatus.PENDING,
    scheduledFor: new Date('2024-05-15T09:00:00'),
    attempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BirthdayService,
        {
          provide: getRepositoryToken(BirthdayMessage),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BirthdayService>(BirthdayService);
    repository = module.get(getRepositoryToken(BirthdayMessage));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBirthdayMessage', () => {
    it('should create a new birthday message', async () => {
      const scheduledFor = new Date('2024-05-15T09:00:00');
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockMessage);
      mockRepository.save.mockResolvedValue(mockMessage);

      const result = await service.createBirthdayMessage(
        mockUser as User,
        scheduledFor,
      );

      expect(result).toEqual(mockMessage);
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        year: 2024,
        scheduledFor,
        status: MessageStatus.PENDING,
      });
    });

    it('should return null if message already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockMessage);

      const result = await service.createBirthdayMessage(
        mockUser as User,
        new Date('2024-05-15T09:00:00'),
      );

      expect(result).toBeNull();
    });

    it('should handle duplicate key error gracefully', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockMessage);
      mockRepository.save.mockRejectedValue({ code: '23505' });

      const result = await service.createBirthdayMessage(
        mockUser as User,
        new Date('2024-05-15T09:00:00'),
      );

      expect(result).toBeNull();
    });
  });

  describe('markAsQueued', () => {
    it('should update message status to queued', async () => {
      await service.markAsQueued('message-123');

      expect(mockRepository.update).toHaveBeenCalledWith('message-123', {
        status: MessageStatus.QUEUED,
      });
    });
  });

  describe('markAsSent', () => {
    it('should update message status to sent', async () => {
      await service.markAsSent('message-123');

      expect(mockRepository.update).toHaveBeenCalledWith('message-123', {
        status: MessageStatus.SENT,
        sentAt: expect.any(Date),
      });
    });
  });

  describe('markAsFailed', () => {
    it('should increment attempts and update status to failed', async () => {
      await service.markAsFailed('message-123', 'API timeout');

      expect(mockRepository.increment).toHaveBeenCalledWith(
        { id: 'message-123' },
        'attempts',
        1,
      );
      expect(mockRepository.update).toHaveBeenCalledWith('message-123', {
        status: MessageStatus.FAILED,
        lastError: 'API timeout',
      });
    });
  });

  describe('getFailedMessagesForRetry', () => {
    it('should return failed messages under max attempts', async () => {
      const failedMessages = [
        { ...mockMessage, status: MessageStatus.FAILED, attempts: 2 },
        { ...mockMessage, status: MessageStatus.FAILED, attempts: 6 },
      ];
      mockRepository.find.mockResolvedValue(
        failedMessages as BirthdayMessage[],
      );

      const result = await service.getFailedMessagesForRetry(5);

      expect(result).toHaveLength(1);
      expect(result[0].attempts).toBe(2);
    });
  });

  describe('findById', () => {
    it('should return message with user relation', async () => {
      const messageWithUser = { ...mockMessage, user: mockUser };
      mockRepository.findOne.mockResolvedValue(
        messageWithUser as BirthdayMessage,
      );

      const result = await service.findById('message-123');

      expect(result).toEqual(messageWithUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'message-123' },
        relations: ['user'],
      });
    });
  });
});
