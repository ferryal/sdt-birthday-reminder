import { Module } from '@nestjs/common';
import { RecoveryService } from './recovery.service';
import { BirthdayModule } from '../birthday/birthday.module';
import { QueueModule } from '../queue/queue.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [BirthdayModule, QueueModule, RedisModule],
  providers: [RecoveryService],
})
export class RecoveryModule {}
