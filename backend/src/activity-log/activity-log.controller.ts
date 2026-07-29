import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivityLogService } from './activity-log.service';

@Controller('activity-logs')
@UseGuards(JwtAuthGuard)
export class ActivityLogController {
  constructor(private activityLogService: ActivityLogService) {}

  @Get('my-logs')
  myLogs(@Request() req: any) {
    return this.activityLogService.findByUser(req.user.userId);
  }
}