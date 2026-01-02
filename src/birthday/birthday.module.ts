import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BirthdayService } from './birthday.service';
import { BirthdaySchedulerService } from './birthday-scheduler.service';
import { BirthdayMessage } from './entities/birthday-message.entity';
import { UsersModule } from '../users/users.module';
import { QueueModule } from '../queue/queue.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BirthdayMessage]),
    UsersModule,
    forwardRef(() => QueueModule),
    RedisModule,
  ],
  providers: [BirthdayService, BirthdaySchedulerService],
  exports: [BirthdayService],
})
export class BirthdayModule {}
