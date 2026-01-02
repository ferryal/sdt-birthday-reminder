import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BirthdayService } from '../birthday/birthday.service';
import { BirthdayProducerService } from '../queue/birthday-producer.service';
import { LockService } from '../redis/lock.service';

const RECOVERY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 5;

@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    private readonly birthdayService: BirthdayService,
    private readonly birthdayProducer: BirthdayProducerService,
    private readonly lockService: LockService,
  ) {}

  /**
   * Recovery job running every 5 minutes
   * Picks up pending and failed messages that should have been sent
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async recoverUnsentMessages(): Promise<void> {
    const lockKey = 'recovery-job-lock';
    const lockAcquired = await this.lockService.acquireLock(lockKey, 240); // 4 min TTL

    if (!lockAcquired) {
      this.logger.debug('Another instance is running the recovery job');
      return;
    }

    try {
      this.logger.log('Starting message recovery job...');

      // Recover pending messages that should have been queued
      await this.recoverPendingMessages();

      // Retry failed messages that haven't exceeded max attempts
      await this.retryFailedMessages();

      this.logger.log('Recovery job completed');
    } catch (error) {
      this.logger.error(`Recovery job error: ${error.message}`, error.stack);
    } finally {
      await this.lockService.releaseLock(lockKey);
    }
  }

  /**
   * Recover pending messages that should have been sent
   * This handles the case where the service was down during the scheduled time
   */
  private async recoverPendingMessages(): Promise<void> {
    const pendingMessages =
      await this.birthdayService.getPendingMessagesToQueue();

    if (pendingMessages.length === 0) {
      this.logger.debug('No pending messages to recover');
      return;
    }

    this.logger.log(
      `Found ${pendingMessages.length} pending message(s) to recover`,
    );

    for (const message of pendingMessages) {
      if (!message.user) {
        this.logger.warn(
          `Message ${message.id} has no associated user, skipping`,
        );
        continue;
      }

      try {
        await this.birthdayProducer.publishBirthdayMessage({
          messageId: message.id,
          userId: message.userId,
          email: message.user.email,
          fullName: `${message.user.firstName} ${message.user.lastName}`,
        });

        await this.birthdayService.markAsQueued(message.id);
        this.logger.log(`Recovered and queued message ${message.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to recover message ${message.id}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Retry failed messages that haven't exceeded max retry attempts
   */
  private async retryFailedMessages(): Promise<void> {
    const failedMessages =
      await this.birthdayService.getFailedMessagesForRetry(MAX_RETRY_ATTEMPTS);

    if (failedMessages.length === 0) {
      this.logger.debug('No failed messages to retry');
      return;
    }

    this.logger.log(
      `Found ${failedMessages.length} failed message(s) to retry`,
    );

    for (const message of failedMessages) {
      if (!message.user) {
        this.logger.warn(
          `Message ${message.id} has no associated user, skipping`,
        );
        continue;
      }

      try {
        // Reset status to pending and re-queue
        await this.birthdayService.resetToPending(message.id);

        await this.birthdayProducer.publishBirthdayMessage({
          messageId: message.id,
          userId: message.userId,
          email: message.user.email,
          fullName: `${message.user.firstName} ${message.user.lastName}`,
        });

        await this.birthdayService.markAsQueued(message.id);
        this.logger.log(`Retrying failed message ${message.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to retry message ${message.id}: ${error.message}`,
        );
      }
    }
  }
}
