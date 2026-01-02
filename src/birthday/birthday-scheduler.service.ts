import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as moment from 'moment-timezone';
import { UsersService } from '../users/users.service';
import { BirthdayService } from './birthday.service';
import { BirthdayProducerService } from '../queue/birthday-producer.service';
import { LockService } from '../redis/lock.service';

@Injectable()
export class BirthdaySchedulerService {
  private readonly logger = new Logger(BirthdaySchedulerService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly birthdayService: BirthdayService,
    private readonly birthdayProducer: BirthdayProducerService,
    private readonly lockService: LockService,
  ) {}

  /**
   * Cron job running every minute to check for birthdays
   * Finds users where it's currently 9:00 AM in their timezone
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkBirthdays(): Promise<void> {
    const lockKey = 'birthday-scheduler-lock';
    const lockAcquired = await this.lockService.acquireLock(lockKey, 55); // 55 seconds TTL

    if (!lockAcquired) {
      this.logger.debug('Another instance is already running the scheduler');
      return;
    }

    try {
      this.logger.debug('Running birthday check...');

      // Get current UTC time
      const nowUtc = moment.utc();

      // TEST_MODE: Use current time instead of 9 AM for testing
      const isTestMode = process.env.TEST_MODE === 'true';
      let targetHour = 9;
      let targetMinute = 0;

      if (isTestMode) {
        // Use current time for testing (in local timezone)
        const nowLocal = moment.tz(moment.tz.guess());
        targetHour = nowLocal.hour();
        targetMinute = nowLocal.minute();
        this.logger.log(
          `🧪 TEST MODE: Looking for timezones at ${targetHour}:${String(targetMinute).padStart(2, '0')}`,
        );
      }

      // Find all timezones where it's currently the target hour:minute
      const timezonesAt9AM = this.getTimezonesAtTime(
        nowUtc,
        targetHour,
        targetMinute,
      );

      if (timezonesAt9AM.length === 0) {
        this.logger.debug(
          `No timezones at ${targetHour}:${String(targetMinute).padStart(2, '0')} right now`,
        );
        return;
      }

      this.logger.debug(
        `Found ${timezonesAt9AM.length} timezone(s) at 9:00 AM: ${timezonesAt9AM.join(', ')}`,
      );

      // Get today's date in each timezone and find users with birthdays
      for (const timezone of timezonesAt9AM) {
        await this.processBirthdaysForTimezone(timezone);
      }
    } catch (error) {
      this.logger.error(
        `Error in birthday scheduler: ${error.message}`,
        error.stack,
      );
    } finally {
      await this.lockService.releaseLock(lockKey);
    }
  }

  /**
   * Process birthdays for a specific timezone
   */
  private async processBirthdaysForTimezone(timezone: string): Promise<void> {
    try {
      const nowInTimezone = moment.tz(timezone);
      const month = nowInTimezone.month() + 1; // moment months are 0-indexed
      const day = nowInTimezone.date();

      this.logger.debug(
        `Checking birthdays for ${timezone} on ${month}/${day}`,
      );

      // Find users with birthdays today in this timezone
      const users = await this.usersService.findUsersWithBirthdayInTimezones(
        month,
        day,
        [timezone],
      );

      this.logger.log(
        `Found ${users.length} user(s) with birthday in ${timezone}`,
      );

      for (const user of users) {
        await this.createAndQueueBirthdayMessage(user, timezone);
      }
    } catch (error) {
      this.logger.error(
        `Error processing birthdays for ${timezone}: ${error.message}`,
      );
    }
  }

  /**
   * Create a birthday message and queue it for sending
   */
  private async createAndQueueBirthdayMessage(
    user: any,
    timezone: string,
  ): Promise<void> {
    // Acquire a lock for this specific user to prevent duplicate processing
    const userLockKey = `birthday-user-${user.id}-${new Date().getFullYear()}`;
    const userLockAcquired = await this.lockService.acquireLock(
      userLockKey,
      300,
    ); // 5 min TTL

    if (!userLockAcquired) {
      this.logger.debug(
        `Lock not acquired for user ${user.id}, likely already processing`,
      );
      return;
    }

    try {
      // Calculate the scheduled time (9 AM in user's timezone)
      const scheduledFor = moment
        .tz(timezone)
        .hour(9)
        .minute(0)
        .second(0)
        .toDate();

      // Create the birthday message record
      const message = await this.birthdayService.createBirthdayMessage(
        user,
        scheduledFor,
      );

      if (message) {
        // Queue the message for sending
        await this.birthdayProducer.publishBirthdayMessage({
          messageId: message.id,
          userId: user.id,
          email: user.email,
          fullName: `${user.firstName} ${user.lastName}`,
        });

        await this.birthdayService.markAsQueued(message.id);
        this.logger.log(`Queued birthday message for user ${user.id}`);
      }
    } finally {
      // Keep the lock to prevent duplicate processing within the same minute
      // It will auto-expire after 5 minutes
    }
  }

  /**
   * Get all IANA timezones where it's currently the target hour:minute
   */
  private getTimezonesAtTime(
    utcMoment: moment.Moment,
    targetHour: number,
    targetMinute: number,
  ): string[] {
    const allTimezones = moment.tz.names();
    const matchingTimezones: string[] = [];

    for (const tz of allTimezones) {
      const timeInTz = utcMoment.clone().tz(tz);
      if (
        timeInTz.hour() === targetHour &&
        timeInTz.minute() === targetMinute
      ) {
        matchingTimezones.push(tz);
      }
    }

    return matchingTimezones;
  }
}
