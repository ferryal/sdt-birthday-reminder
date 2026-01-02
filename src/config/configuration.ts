export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER || 'birthday_user',
    password: process.env.DATABASE_PASSWORD || 'birthday_pass',
    name: process.env.DATABASE_NAME || 'birthday_db',
  },
  rabbitmq: {
    url:
      process.env.RABBITMQ_URL ||
      'amqp://birthday_user:birthday_pass@localhost:5672',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  emailService: {
    url:
      process.env.EMAIL_SERVICE_URL ||
      'https://email-service.digitalenvision.com.au/send-email',
  },
});
