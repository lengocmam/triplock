import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityAction } from './entities/activity-log.entity';

@Injectable()
export class ActivityLogService {
  private logger = new Logger('ActivityLog');

  constructor(
    @InjectRepository(ActivityLog)
    private activityLogRepository: Repository<ActivityLog>,
  ) {}

  // Ghi log không được làm gián đoạn luồng chính -> nuốt lỗi, chỉ log ra console nếu ghi thất bại
  async log(
    userId: string,
    action: ActivityAction,
    description?: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
  ): Promise<void> {
    try {
      const entry = this.activityLogRepository.create({
        user: { id: userId },
        action,
        description,
        metadata,
        ipAddress,
      });
      await this.activityLogRepository.save(entry);
    } catch (error) {
      this.logger.warn(`Không thể ghi activity log: ${error.message}`);
    }
  }

  async findByUser(userId: string, limit = 50): Promise<ActivityLog[]> {
    return this.activityLogRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
