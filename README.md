# Birthday Reminder System

A NestJS application that sends birthday messages to users at exactly 9 AM in their local timezone.

## Features

- **User Management API**: Create, read, update, and delete users with their birthday and timezone information
- **Timezone-Aware Scheduling**: Sends birthday messages at exactly 9 AM in each user's local timezone
- **Message Queuing**: Uses RabbitMQ for reliable message delivery with retry logic
- **Distributed Locking**: Uses Redis to prevent duplicate messages in multi-instance deployments
- **Recovery System**: Automatically recovers and resends unsent messages after downtime
- **Scalable Architecture**: Designed to handle thousands of birthdays per day

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm

## Quick Start

### 1. Clone and install dependencies

```bash
npm install
```

### 2. Start infrastructure services

```bash
docker-compose up -d
```

This starts:

- PostgreSQL (port 5432)
- RabbitMQ (port 5672, management UI on 15672)
- Redis (port 6379)

### 3. Start the application

```bash
npm run start:dev
```

The API will be available at http://localhost:3000

## API Endpoints

### Create User

```bash
POST /user
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "birthday": "1990-05-15",
  "timezone": "America/New_York"
}
```

### Get All Users

```bash
GET /user
```

### Get User by ID

```bash
GET /user/:id
```

### Update User

```bash
PUT /user/:id
Content-Type: application/json

{
  "firstName": "Jane"
}
```

### Delete User

```bash
DELETE /user/:id
```

## Configuration

Environment variables (see `.env.example`):

| Variable          | Description             | Default                                                 |
| ----------------- | ----------------------- | ------------------------------------------------------- |
| PORT              | Application port        | 3000                                                    |
| DATABASE_HOST     | PostgreSQL host         | localhost                                               |
| DATABASE_PORT     | PostgreSQL port         | 5432                                                    |
| DATABASE_USER     | Database user           | birthday_user                                           |
| DATABASE_PASSWORD | Database password       | birthday_pass                                           |
| DATABASE_NAME     | Database name           | birthday_db                                             |
| RABBITMQ_URL      | RabbitMQ connection URL | amqp://birthday_user:birthday_pass@localhost:5672       |
| REDIS_HOST        | Redis host              | localhost                                               |
| REDIS_PORT        | Redis port              | 6379                                                    |
| EMAIL_SERVICE_URL | External email API URL  | https://email-service.digitalenvision.com.au/send-email |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Cron Job      │────▶│   RabbitMQ       │────▶│  Email Service  │
│  (Every Minute) │     │   Queue          │     │  (External API) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                        │
        ▼                       ▼                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   PostgreSQL    │     │   Redis          │     │  Recovery Job   │
│   (Users +      │     │   (Dist. Locks)  │     │  (Every 5 min)  │
│    Messages)    │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Key Design Decisions

1. **Birthday Cron Job**: Runs every minute to check all timezones where it's currently 9:00 AM
2. **Duplicate Prevention**: Uses Redis distributed locks + database unique constraints
3. **Retry Logic**: Exponential backoff with max 5 attempts before moving to dead letter queue
4. **Recovery**: Separate job runs every 5 minutes to handle pending/failed messages

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Project Structure

```
src/
├── config/           # Configuration module
├── users/            # User CRUD module
├── birthday/         # Birthday message scheduling
├── queue/            # RabbitMQ producer/consumer
├── email/            # External email service client
├── recovery/         # Message recovery system
└── redis/            # Redis lock service
```

## Scalability Considerations

- **Database Indexing**: Composite index on `(birthday_month, birthday_day, timezone)` for fast lookups
- **Horizontal Scaling**: Redis locks ensure only one instance processes each message
- **Queue Throughput**: RabbitMQ handles high message volume with multiple consumers
- **Batch Processing**: Users are processed in batches to handle thousands of birthdays

## License

MIT
