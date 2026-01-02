import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { UsersModule } from './users/users.module';
import { BirthdayModule } from './birthday/birthday.module';
import { QueueModule } from './queue/queue.module';
import { EmailModule } from './email/email.module';
import { RecoveryModule } from './recovery/recovery.module';
import { RedisModule } from './redis/redis.module';
import { User } from './users/entities/user.entity';
import { BirthdayMessage } from './birthday/entities/birthday-message.entity';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        entities: [User, BirthdayMessage],
        synchronize: configService.get<string>('nodeEnv') === 'development', // Only in dev
        logging: configService.get<string>('nodeEnv') === 'development',
      }),
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Application modules
    RedisModule,
    UsersModule,
    EmailModule,
    BirthdayModule,
    QueueModule,
    RecoveryModule,
  ],
})
export class AppModule {}
