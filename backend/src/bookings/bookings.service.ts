import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Booking, BookingStatus } from './entities/booking.entity';
import { FlightsService } from '../flights/flights.service';
import { UsersService } from '../users/users.service';
import { SeatStatus } from '../flights/entities/seat.entity';
import { REDIS_CLIENT } from '../redis/redis.module';
import { BookingsGateway } from './bookings.gateway';

const LOCK_TTL_SECONDS = 300;

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingsRepository: Repository<Booking>,
    private flightsService: FlightsService,
    private usersService: UsersService,
    @Inject(REDIS_CLIENT) private redis: Redis,
    private bookingsGateway: BookingsGateway,
  ) {}

  private getLockKey(seatId: string): string {
    return `seat:lock:${seatId}`;
  }

  async lockSeat(seatId: string, fareClassId: string, userId: string): Promise<Booking> {
    const user = await this.usersService.findById(userId);
    if (!user.isVerified) {
      throw new ForbiddenException('Tài khoản chưa xác thực, vui lòng verify OTP trước');
    }

    const seat = await this.flightsService.getSeatById(seatId);
    if (seat.status !== SeatStatus.AVAILABLE) {
      throw new BadRequestException('Ghế đã được đặt hoặc đang bị giữ');
    }

    const fareClass = await this.flightsService.getFareClassById(fareClassId);

    const lockKey = this.getLockKey(seatId);
    const result = await this.redis.set(lockKey, userId, 'EX', LOCK_TTL_SECONDS, 'NX');

    if (result !== 'OK') {
      throw new BadRequestException('Ghế vừa bị người khác giữ, vui lòng chọn ghế khác');
    }

    try {
      await this.flightsService.updateSeatStatus(seatId, SeatStatus.LOCKED);

      const lockExpiresAt = new Date(Date.now() + LOCK_TTL_SECONDS * 1000);

      const booking = this.bookingsRepository.create({
        user: { id: userId } as any,
        seat: { id: seatId } as any,
        fareClass: { id: fareClassId } as any,
        status: BookingStatus.PENDING,
        lockExpiresAt,
      });

      const saved = await this.bookingsRepository.save(booking);
      this.bookingsGateway.notifySeatLocked(seat.flight.id, seatId, seat.seatNumber);
      return saved;
    } catch (error) {
      await this.redis.del(lockKey);
      throw error;
    }
  }

  // Xác nhận NHIỀU booking (nhiều ghế) cùng lúc trong 1 giao dịch mua
  // Dùng transaction để đảm bảo: hoặc TẤT CẢ ghế được confirm, hoặc KHÔNG ghế nào -
  // tránh tình trạng "mua 3 ghế nhưng chỉ 2 ghế thành công" nếu có lỗi giữa chừng
  async confirmMultiple(
    bookingIds: string[],
    passengers: { bookingId: string; passengerName: string; passengerPhone: string }[],
    userId: string,
  ): Promise<Booking[]> {
    if (bookingIds.length === 0) {
      throw new BadRequestException('Không có ghế nào để xác nhận');
    }

    const bookingCode = 'TL' + Math.random().toString(36).substring(2, 8).toUpperCase();

    return this.bookingsRepository.manager.transaction(async (manager) => {
      const confirmedBookings: Booking[] = [];

      for (const bookingId of bookingIds) {
        const booking = await manager.findOne(Booking, {
          where: { id: bookingId },
          relations: ['user', 'seat', 'seat.flight', 'fareClass'],
        });

        if (!booking) {
          throw new BadRequestException(`Không tìm thấy booking ${bookingId}`);
        }
        if (booking.user.id !== userId) {
          throw new ForbiddenException('Có booking không thuộc về bạn');
        }
        if (booking.status !== BookingStatus.PENDING) {
          throw new BadRequestException(`Ghế ${booking.seat.seatNumber} không ở trạng thái chờ thanh toán`);
        }
        if (new Date() > booking.lockExpiresAt) {
          throw new BadRequestException(`Đã hết thời gian giữ ghế ${booking.seat.seatNumber}`);
        }

        const passengerInfo = passengers.find((p) => p.bookingId === bookingId);
        if (!passengerInfo) {
          throw new BadRequestException(`Thiếu thông tin hành khách cho ghế ${booking.seat.seatNumber}`);
        }

        booking.status = BookingStatus.CONFIRMED;
        booking.passengerName = passengerInfo.passengerName;
        booking.passengerPhone = passengerInfo.passengerPhone;
        booking.bookingCode = bookingCode; // TẤT CẢ ghế trong 1 lần mua chung 1 mã

        await manager.save(booking);
        await manager.update('seats', booking.seat.id, { status: SeatStatus.BOOKED });

        confirmedBookings.push(booking);
      }

      // Việc dọn Redis lock + bắn WebSocket làm SAU khi transaction DB chắc chắn thành công,
      // tránh trường hợp báo real-time nhầm trong khi DB rollback
      for (const booking of confirmedBookings) {
        await this.redis.del(this.getLockKey(booking.seat.id));
        this.bookingsGateway.notifySeatBooked(
          booking.seat.flight.id,
          booking.seat.id,
          booking.seat.seatNumber,
        );
      }

      return confirmedBookings;
    });
  }

  async releaseSeat(bookingId: string): Promise<void> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
      relations: ['seat', 'seat.flight'],
    });
    if (!booking) return;

    booking.status = BookingStatus.EXPIRED;
    await this.bookingsRepository.save(booking);

    await this.flightsService.updateSeatStatus(booking.seat.id, SeatStatus.AVAILABLE);
    await this.redis.del(this.getLockKey(booking.seat.id));

    this.bookingsGateway.notifySeatReleased(
      booking.seat.flight.id,
      booking.seat.id,
      booking.seat.seatNumber,
    );
  }

  async findMyBookings(userId: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: { user: { id: userId } },
      relations: ['seat', 'seat.flight', 'fareClass'],
      order: { createdAt: 'DESC' },
    });
  }

    async cancelConfirmedBooking(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
      relations: ['user', 'seat', 'seat.flight', 'fareClass'],
    });

    if (!booking) {
      throw new BadRequestException('Không tìm thấy vé');
    }
    if (booking.user.id !== userId) {
      throw new ForbiddenException('Vé không thuộc về bạn');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Vé này không ở trạng thái có thể hủy');
    }
    if (!booking.fareClass.refundable) {
      throw new ForbiddenException('Hạng vé này không hỗ trợ hoàn hủy');
    }
    if (new Date() > booking.seat.flight.departureTime) {
      throw new BadRequestException('Không thể hủy vé cho chuyến bay đã khởi hành');
    }

    booking.status = BookingStatus.CANCELLED;
    await this.bookingsRepository.save(booking);

    await this.flightsService.updateSeatStatus(booking.seat.id, SeatStatus.AVAILABLE);

    this.bookingsGateway.notifySeatReleased(
      booking.seat.flight.id,
      booking.seat.id,
      booking.seat.seatNumber,
    );

    return booking;
  }
}