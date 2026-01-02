import { Module, forwardRef } from '@nestjs/common';
import { BirthdayProducerService } from './birthday-producer.service';
import { BirthdayConsumerService } from './birthday-consumer.service';
import { BirthdayModule } from '../birthday/birthday.module';
import { EmailModule } from '../email/email.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [forwardRef(() => BirthdayModule), EmailModule, RedisModule],
  providers: [BirthdayProducerService, BirthdayConsumerService],
  exports: [BirthdayProducerService],
})
export class QueueModule {}
