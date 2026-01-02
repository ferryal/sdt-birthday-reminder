import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface BirthdayMessagePayload {
  messageId: string;
  userId: string;
  email: string;
  fullName: string;
}

export const BIRTHDAY_QUEUE = 'birthday-messages';
export const BIRTHDAY_DLQ = 'birthday-messages-dlq';

@Injectable()
export class BirthdayProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BirthdayProducerService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
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

      // Declare dead letter queue
      await this.channel.assertQueue(BIRTHDAY_DLQ, {
        durable: true,
      });

      // Declare main queue with dead letter exchange
      await this.channel.assertQueue(BIRTHDAY_QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': BIRTHDAY_DLQ,
        },
      });

      this.logger.log('Connected to RabbitMQ');
    } catch (error) {
      this.logger.error(
        `Failed to connect to RabbitMQ: ${(error as Error).message}`,
      );
      // Retry connection after delay
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
      this.logger.log('Disconnected from RabbitMQ');
    } catch (error) {
      this.logger.error(
        `Error disconnecting from RabbitMQ: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Publish a birthday message to the queue
   */
  async publishBirthdayMessage(payload: BirthdayMessagePayload): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const message = Buffer.from(JSON.stringify(payload));

    this.channel.sendToQueue(BIRTHDAY_QUEUE, message, {
      persistent: true,
      messageId: payload.messageId,
    });

    this.logger.log(`Published birthday message for user ${payload.userId}`);
  }

  /**
   * Publish multiple messages in batch
   */
  async publishBatch(payloads: BirthdayMessagePayload[]): Promise<void> {
    for (const payload of payloads) {
      await this.publishBirthdayMessage(payload);
    }
  }
}
