import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App E2E Tests', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/health (GET)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('uptime');
          expect(res.body).toHaveProperty('components');
        });
    });
  });

  describe('/user (POST)', () => {
    it('should create a new user', () => {
      const createUserDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: `test-${Date.now()}@example.com`,
        birthday: '1990-05-15',
        timezone: 'America/New_York',
      };

      return request(app.getHttpServer())
        .post('/user')
        .send(createUserDto)
        .expect(201)
        .expect((res) => {
          const body = res.body as Record<string, unknown>;
          expect(body).toHaveProperty('id');
          expect(body.firstName).toBe(createUserDto.firstName);
          expect(body.lastName).toBe(createUserDto.lastName);
          expect(body.email).toBe(createUserDto.email);
          expect(body.timezone).toBe(createUserDto.timezone);
        });
    });

    it('should reject invalid timezone', () => {
      const createUserDto = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: `invalid-tz-${Date.now()}@example.com`,
        birthday: '1990-05-15',
        timezone: 'Invalid/Timezone',
      };

      return request(app.getHttpServer())
        .post('/user')
        .send(createUserDto)
        .expect(400);
    });

    it('should reject missing required fields', () => {
      return request(app.getHttpServer()).post('/user').send({}).expect(400);
    });
  });

  describe('/user (GET)', () => {
    it('should return list of users', () => {
      return request(app.getHttpServer())
        .get('/user')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });
});
