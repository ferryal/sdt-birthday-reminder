import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  BirthdayMessage,
  MessageStatus,
} from './entities/birthday-message.entity';
import { User } from '../users/entities/user.entity';
import * as moment from 'moment-timezone';

@Injectable()
export class BirthdayService {
  private readonly logger = new Logger(BirthdayService.name);

  constructor(
    @InjectRepository(BirthdayMessage)
    private readonly messageRepository: Repository<BirthdayMessage>,
  ) {}

  /**
   * Create a birthday message record for a user
   * Uses database unique constraint to prevent duplicates
   */
  async createBirthdayMessage(
    user: User,
    scheduledFor: Date,
  ): Promise<BirthdayMessage | null> {
    const year = scheduledFor.getFullYear();

    try {
      // Check if message already exists for this user and year
      const existing = await this.messageRepository.findOne({
        where: { userId: user.id, year },
      });

      if (existing) {
        this.logger.debug(
          `Birthday message already exists for user ${user.id} in year ${year}`,
        );
        return null;
      }

      const message = this.messageRepository.create({
        userId: user.id,
        year,
        scheduledFor,
        status: MessageStatus.PENDING,
      });

      const saved = await this.messageRepository.save(message);
      this.logger.log(
        `Created birthday message ${saved.id} for user ${user.id}`,
      );
      return saved;
    } catch (error) {
      // Handle unique constraint violation (race condition protection)
      if (error.code === '23505') {
        this.logger.debug(
          `Duplicate message prevented for user ${user.id} in year ${year}`,
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * Mark a message as queued
   */
  async markAsQueued(messageId: string): Promise<void> {
    await this.messageRepository.update(messageId, {
      status: MessageStatus.QUEUED,
    });
  }

  /**
   * Mark a message as sent
   */
  async markAsSent(messageId: string): Promise<void> {
    await this.messageRepository.update(messageId, {
      status: MessageStatus.SENT,
      sentAt: new Date(),
    });
    this.logger.log(`Message ${messageId} marked as sent`);
  }

  /**
   * Mark a message as failed and record the error
   */
  async markAsFailed(messageId: string, error: string): Promise<void> {
    await this.messageRepository.increment({ id: messageId }, 'attempts', 1);
    await this.messageRepository.update(messageId, {
      status: MessageStatus.FAILED,
      lastError: error,
    });
    this.logger.warn(`Message ${messageId} marked as failed: ${error}`);
  }

  /**
   * Get pending messages that should have been sent (for recovery)
   */
  async getUnsentMessages(limit: number = 100): Promise<BirthdayMessage[]> {
    const now = new Date();

    return this.messageRepository.find({
      where: [
        { status: MessageStatus.PENDING, scheduledFor: now },
        { status: MessageStatus.FAILED },
      ],
      relations: ['user'],
      take: limit,
      order: { scheduledFor: 'ASC' },
    });
  }

  /**
   * Get pending messages that need to be queued
   */
  async getPendingMessagesToQueue(): Promise<BirthdayMessage[]> {
    return this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.user', 'user')
      .where('message.status = :status', { status: MessageStatus.PENDING })
      .andWhere('message.scheduledFor <= :now', { now: new Date() })
      .getMany();
  }

  /**
   * Get failed messages for retry (with attempt limit)
   */
  async getFailedMessagesForRetry(
    maxAttempts: number = 5,
    limit: number = 100,
  ): Promise<BirthdayMessage[]> {
    return this.messageRepository
      .find({
        where: {
          status: MessageStatus.FAILED,
        },
        relations: ['user'],
        take: limit,
        order: { updatedAt: 'ASC' },
      })
      .then((messages) => messages.filter((m) => m.attempts < maxAttempts));
  }

  /**
   * Reset message status to pending for retry
   */
  async resetToPending(messageId: string): Promise<void> {
    await this.messageRepository.update(messageId, {
      status: MessageStatus.PENDING,
    });
  }

  /**
   * Find message by ID with user relation
   */
  async findById(messageId: string): Promise<BirthdayMessage | null> {
    return this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['user'],
    });
  }
}
