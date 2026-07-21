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

  async lockSeat(seatId: string, userId: string): Promise<Booking> {
    const user = await this.usersService.findById(userId);
    if (!user.isVerified) {
      throw new ForbiddenException('Tài khoản chưa xác thực, vui lòng verify OTP trước');
    }

    const seat = await this.flightsService.getSeatById(seatId);
    if (seat.status !== SeatStatus.AVAILABLE) {
      throw new BadRequestException('Ghế đã được đặt hoặc đang bị giữ');
    }

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
        status: BookingStatus.PENDING,
        lockExpiresAt,
      });

      const saved = await this.bookingsRepository.save(booking);

      // Báo real-time cho các client khác đang xem cùng chuyến bay
      this.bookingsGateway.notifySeatLocked(seat.flight.id, seatId, seat.seatNumber);

      return saved;
    } catch (error) {
      await this.redis.del(lockKey);
      throw error;
    }
  }

  async confirmBooking(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
      relations: ['user', 'seat', 'seat.flight'],
    });

    if (!booking) {
      throw new BadRequestException('Không tìm thấy booking');
    }
    if (booking.user.id !== userId) {
      throw new ForbiddenException('Booking không thuộc về bạn');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Booking không ở trạng thái chờ thanh toán');
    }
    if (new Date() > booking.lockExpiresAt) {
      throw new BadRequestException('Đã hết thời gian giữ chỗ');
    }

    booking.status = BookingStatus.CONFIRMED;
    await this.bookingsRepository.save(booking);

    await this.flightsService.updateSeatStatus(booking.seat.id, SeatStatus.BOOKED);
    await this.redis.del(this.getLockKey(booking.seat.id));

    this.bookingsGateway.notifySeatBooked(
      booking.seat.flight.id,
      booking.seat.id,
      booking.seat.seatNumber,
    );

    return booking;
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
}