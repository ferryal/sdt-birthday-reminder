import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { MessageType, getMessageContent } from '../messages/message-type.enum';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.get<string>('emailService.url');

    this.httpClient = axios.create({
      baseURL,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send a birthday email via the external email service
   * API docs: https://email-service.digitalenvision.com.au/api-docs/
   */
  async sendBirthdayEmail(email: string, fullName: string): Promise<void> {
    return this.sendMessage(email, fullName, MessageType.BIRTHDAY);
  }

  /**
   * Send an anniversary email via the external email service
   * This method is ready for future anniversary feature implementation
   */
  async sendAnniversaryEmail(email: string, fullName: string): Promise<void> {
    return this.sendMessage(email, fullName, MessageType.ANNIVERSARY);
  }

  /**
   * Generic method to send any message type
   */
  async sendMessage(
    email: string,
    fullName: string,
    messageType: MessageType,
  ): Promise<void> {
    const message = getMessageContent(messageType, fullName);

    this.logger.log(`Sending ${messageType} email to ${email}`);

    try {
      const response = await this.httpClient.post('', {
        email,
        message,
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.log(`Successfully sent ${messageType} email to ${email}`);
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const responseData = error.response?.data as
          | { message?: string }
          | undefined;
        const errorMessage = responseData?.message || error.message;

        // Log the error with details
        this.logger.error(
          `Failed to send email to ${email}: ${statusCode} - ${errorMessage}`,
        );

        // Check if it's a timeout
        if (error.code === 'ECONNABORTED') {
          throw new Error('Email service timeout');
        }

        // Re-throw with meaningful message
        throw new Error(`Email service error: ${statusCode} - ${errorMessage}`);
      }

      throw error;
    }
  }
}
