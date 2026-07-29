import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController } from './activity-log.controller';

// @Global để mọi module khác dùng ActivityLogService mà không cần import lại
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  providers: [ActivityLogService],
  controllers: [ActivityLogController],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}