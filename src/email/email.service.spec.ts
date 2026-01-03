import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EmailService } from './email.service';
import { MessageType } from '../messages/message-type.enum';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('EmailService', () => {
  let service: EmailService;

  const mockConfigService = {
    get: jest
      .fn()
      .mockReturnValue(
        'https://email-service.digitalenvision.com.au/send-email',
      ),
  };

  const mockAxiosInstance = {
    post: jest.fn(),
  };

  beforeEach(async () => {
    mockedAxios.create.mockReturnValue(
      mockAxiosInstance as unknown as ReturnType<typeof axios.create>,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendBirthdayEmail', () => {
    it('should send birthday email successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ status: 200 });

      await service.sendBirthdayEmail('john@example.com', 'John Doe');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('', {
        email: 'john@example.com',
        message: "Hey, John Doe it's your birthday",
      });
    });

    it('should throw error on non-2xx status', async () => {
      mockAxiosInstance.post.mockResolvedValue({ status: 500 });

      await expect(
        service.sendBirthdayEmail('john@example.com', 'John Doe'),
      ).rejects.toThrow('Unexpected status code: 500');
    });
  });

  describe('sendAnniversaryEmail', () => {
    it('should send anniversary email successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ status: 200 });

      await service.sendAnniversaryEmail('jane@example.com', 'Jane Doe');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('', {
        email: 'jane@example.com',
        message: 'Hey, Jane Doe happy work anniversary!',
      });
    });
  });

  describe('sendMessage', () => {
    it('should handle axios timeout error', async () => {
      const axiosError = {
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout',
        response: undefined,
      };
      mockAxiosInstance.post.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(
        service.sendMessage(
          'john@example.com',
          'John Doe',
          MessageType.BIRTHDAY,
        ),
      ).rejects.toThrow('Email service timeout');
    });

    it('should handle axios error with status code', async () => {
      const axiosError = {
        isAxiosError: true,
        code: 'OTHER',
        message: 'error',
        response: {
          status: 500,
          data: { message: 'Internal Server Error' },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(
        service.sendMessage(
          'john@example.com',
          'John Doe',
          MessageType.BIRTHDAY,
        ),
      ).rejects.toThrow('Email service error: 500 - Internal Server Error');
    });

    it('should re-throw non-axios errors', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.post.mockRejectedValue(error);
      mockedAxios.isAxiosError.mockReturnValue(false);

      await expect(
        service.sendMessage(
          'john@example.com',
          'John Doe',
          MessageType.BIRTHDAY,
        ),
      ).rejects.toThrow('Network error');
    });
  });
});
