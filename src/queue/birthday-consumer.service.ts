import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import {
  BirthdayMessagePayload,
  BIRTHDAY_QUEUE,
  BIRTHDAY_DLQ,
} from './birthday-producer.service';
import { BirthdayService } from '../birthday/birthday.service';
import { EmailService } from '../email/email.service';
import { LockService } from '../redis/lock.service';

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000]; // Exponential backoff

@Injectable()
export class BirthdayConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BirthdayConsumerService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly birthdayService: BirthdayService,
    private readonly emailService: EmailService,
    private readonly lockService: LockService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
    await this.startConsuming();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      const url =
        this.configService.get<string>('rabbitmq.url') || 'amqp://localhost';
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      // Set prefetch to process one message at a time
      await this.channel.prefetch(1);

      // Ensure dead letter queue exists
      await this.channel.assertQueue(BIRTHDAY_DLQ, {
        durable: true,
      });

      // Ensure main queue exists with dead letter exchange
      await this.channel.assertQueue(BIRTHDAY_QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': BIRTHDAY_DLQ,
        },
      });

      this.logger.log('Consumer connected to RabbitMQ');
    } catch (error) {
      this.logger.error(
        `Failed to connect to RabbitMQ: ${(error as Error).message}`,
      );
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.log('Consumer disconnected from RabbitMQ');
    } catch (error) {
      this.logger.error(`Error disconnecting: ${(error as Error).message}`);
    }
  }

  /**
   * Start consuming messages from the birthday queue
   */
  private async startConsuming(): Promise<void> {
    if (!this.channel) {
      this.logger.error('Channel not initialized, cannot start consuming');
      return;
    }

    this.channel.consume(BIRTHDAY_QUEUE, async (msg) => {
      if (!msg) return;

      const payload: BirthdayMessagePayload = JSON.parse(
        msg.content.toString(),
      );
      this.logger.log(`Received birthday message: ${payload.messageId}`);

      try {
        await this.processMessage(payload);
        this.channel!.ack(msg);
      } catch (error) {
        this.logger.error(
          `Failed to process message ${payload.messageId}: ${(error as Error).message}`,
        );
        await this.handleFailure(msg, payload, error as Error);
      }
    });

    this.logger.log('Started consuming birthday messages');
  }

  /**
   * Process a single birthday message
   */
  private async processMessage(payload: BirthdayMessagePayload): Promise<void> {
    // Acquire a processing lock to prevent duplicate sends
    const lockKey = `process-${payload.messageId}`;
    const lockAcquired = await this.lockService.acquireLock(lockKey, 120); // 2 min TTL

    if (!lockAcquired) {
      this.logger.warn(
        `Could not acquire lock for message ${payload.messageId}`,
      );
      throw new Error('Could not acquire processing lock');
    }

    try {
      // Check if message was already sent
      const message = await this.birthdayService.findById(payload.messageId);
      if (!message) {
        this.logger.warn(`Message ${payload.messageId} not found in database`);
        return;
      }

      if (message.status === 'sent') {
        this.logger.debug(
          `Message ${payload.messageId} already sent, skipping`,
        );
        return;
      }

      // Send the email
      await this.emailService.sendBirthdayEmail(
        payload.email,
        payload.fullName,
      );

      // Mark as sent
      await this.birthdayService.markAsSent(payload.messageId);
      this.logger.log(`Successfully sent birthday message to ${payload.email}`);
    } finally {
      await this.lockService.releaseLock(lockKey);
    }
  }

  /**
   * Handle message processing failure with retry logic
   */
  private async handleFailure(
    msg: amqp.ConsumeMessage,
    payload: BirthdayMessagePayload,
    error: Error,
  ): Promise<void> {
    // Get the message from database to check attempt count
    const message = await this.birthdayService.findById(payload.messageId);
    const attempts = message?.attempts || 0;

    if (attempts >= MAX_RETRY_ATTEMPTS) {
      // Max retries reached, reject and move to DLQ
      this.logger.error(
        `Max retries reached for message ${payload.messageId}, moving to DLQ`,
      );
      await this.birthdayService.markAsFailed(payload.messageId, error.message);
      this.channel!.reject(msg, false); // requeue: false -> goes to DLQ
    } else {
      // Mark as failed and requeue with delay
      await this.birthdayService.markAsFailed(payload.messageId, error.message);

      // Wait before requeuing (exponential backoff)
      const delay =
        RETRY_DELAYS[attempts] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      this.logger.log(
        `Retrying message ${payload.messageId} in ${delay}ms (attempt ${attempts + 1})`,
      );

      setTimeout(() => {
        this.channel!.nack(msg, false, true); // requeue: true
      }, delay);
    }
  }
}
