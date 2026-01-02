import { Module, Global } from '@nestjs/common';
import { LockService } from './lock.service';

@Global()
@Module({
  providers: [LockService],
  exports: [LockService],
})
export class RedisModule {}
