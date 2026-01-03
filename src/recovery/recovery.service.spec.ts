import { Test, TestingModule } from '@nestjs/testing';
import { RecoveryService } from './recovery.service';
import { BirthdayService } from '../birthday/birthday.service';
import { BirthdayProducerService } from '../queue/birthday-producer.service';
import { LockService } from '../redis/lock.service';
import {
  BirthdayMessage,
  MessageStatus,
} from '../birthday/entities/birthday-message.entity';
import { User } from '../users/entities/user.entity';

describe('RecoveryService', () => {
  let service: RecoveryService;
  let birthdayService: jest.Mocked<BirthdayService>;
  let birthdayProducer: jest.Mocked<BirthdayProducerService>;
  let lockService: jest.Mocked<LockService>;

  const mockUser: Partial<User> = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  };

  const mockMessage: Partial<BirthdayMessage> = {
    id: 'message-123',
    userId: 'user-123',
    user: mockUser as User,
    status: MessageStatus.PENDING,
    attempts: 0,
  };

  const mockFailedMessage: Partial<BirthdayMessage> = {
    id: 'message-456',
    userId: 'user-456',
    user: { ...mockUser, id: 'user-456', email: 'jane@example.com' } as User,
    status: MessageStatus.FAILED,
    attempts: 2,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecoveryService,
        {
          provide: BirthdayService,
          useValue: {
            getPendingMessagesToQueue: jest.fn(),
            getFailedMessagesForRetry: jest.fn(),
            markAsQueued: jest.fn(),
            resetToPending: jest.fn(),
          },
        },
        {
          provide: BirthdayProducerService,
          useValue: {
            publishBirthdayMessage: jest.fn(),
          },
        },
        {
          provide: LockService,
          useValue: {
            acquireLock: jest.fn(),
            releaseLock: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RecoveryService>(RecoveryService);
    birthdayService = module.get(BirthdayService);
    birthdayProducer = module.get(BirthdayProducerService);
    lockService = module.get(LockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recoverUnsentMessages', () => {
    it('should skip if lock cannot be acquired', async () => {
      lockService.acquireLock.mockResolvedValue(false);

      await service.recoverUnsentMessages();

      expect(birthdayService.getPendingMessagesToQueue).not.toHaveBeenCalled();
    });

    it('should recover pending messages when lock is acquired', async () => {
      lockService.acquireLock.mockResolvedValue(true);
      birthdayService.getPendingMessagesToQueue.mockResolvedValue([
        mockMessage as BirthdayMessage,
      ]);
      birthdayService.getFailedMessagesForRetry.mockResolvedValue([]);
      birthdayProducer.publishBirthdayMessage.mockResolvedValue();
      birthdayService.markAsQueued.mockResolvedValue();

      await service.recoverUnsentMessages();

      expect(birthdayProducer.publishBirthdayMessage).toHaveBeenCalledWith({
        messageId: 'message-123',
        userId: 'user-123',
        email: 'john@example.com',
        fullName: 'John Doe',
      });
      expect(birthdayService.markAsQueued).toHaveBeenCalledWith('message-123');
      expect(lockService.releaseLock).toHaveBeenCalledWith('recovery-job-lock');
    });

    it('should retry failed messages', async () => {
      lockService.acquireLock.mockResolvedValue(true);
      birthdayService.getPendingMessagesToQueue.mockResolvedValue([]);
      birthdayService.getFailedMessagesForRetry.mockResolvedValue([
        mockFailedMessage as BirthdayMessage,
      ]);
      birthdayService.resetToPending.mockResolvedValue();
      birthdayProducer.publishBirthdayMessage.mockResolvedValue();
      birthdayService.markAsQueued.mockResolvedValue();

      await service.recoverUnsentMessages();

      expect(birthdayService.resetToPending).toHaveBeenCalledWith(
        'message-456',
      );
      expect(birthdayProducer.publishBirthdayMessage).toHaveBeenCalledTimes(1);
    });

    it('should skip messages without associated user', async () => {
      const messageWithoutUser: Partial<BirthdayMessage> = {
        id: 'message-789',
        userId: 'user-789',
        user: undefined,
        status: MessageStatus.PENDING,
      };

      lockService.acquireLock.mockResolvedValue(true);
      birthdayService.getPendingMessagesToQueue.mockResolvedValue([
        messageWithoutUser as BirthdayMessage,
      ]);
      birthdayService.getFailedMessagesForRetry.mockResolvedValue([]);

      await service.recoverUnsentMessages();

      expect(birthdayProducer.publishBirthdayMessage).not.toHaveBeenCalled();
    });

    it('should release lock even on error', async () => {
      lockService.acquireLock.mockResolvedValue(true);
      birthdayService.getPendingMessagesToQueue.mockRejectedValue(
        new Error('Database error'),
      );

      await service.recoverUnsentMessages();

      expect(lockService.releaseLock).toHaveBeenCalledWith('recovery-job-lock');
    });
  });
});
