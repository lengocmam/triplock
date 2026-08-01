import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { BookingsService } from './bookings.service';

@Injectable()
export class BookingsCleanupService {
  private logger = new Logger('BookingsCleanup');

  constructor(
    @InjectRepository(Booking)
    private bookingsRepository: Repository<Booking>,
    private bookingsService: BookingsService,
  ) {}

  // Chạy mỗi 30 giây — quét các booking PENDING đã quá hạn giữ chỗ nhưng
  // chưa được ai chủ động hủy (vd: người dùng đóng tab, mất mạng giữa chừng)
  @Cron(CronExpression.EVERY_30_SECONDS)
  async releaseExpiredLocks() {
    const expired = await this.bookingsRepository.find({
      where: {
        status: BookingStatus.PENDING,
        lockExpiresAt: LessThan(new Date()),
      },
    });

    if (expired.length === 0) return;

    this.logger.log(
      `Phát hiện ${expired.length} ghế hết hạn giữ chỗ — đang giải phóng...`,
    );

    for (const booking of expired) {
      await this.bookingsService.releaseSeat(booking.id);
    }
  }
}
