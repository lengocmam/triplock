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
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityAction } from '../activity-log/entities/activity-log.entity';
import { MailService } from '../mail/mail.service';
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
} from './entities/payment.entity';

const LOCK_TTL_SECONDS = 300;

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingsRepository: Repository<Booking>,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private flightsService: FlightsService,
    private usersService: UsersService,
    @Inject(REDIS_CLIENT) private redis: Redis,
    private bookingsGateway: BookingsGateway,
    private activityLogService: ActivityLogService,
    private mailService: MailService,
  ) {}

  // Thuế + phí sân bay tính theo % giá vé, giống cách các hãng bay thật hiển thị tách riêng
  private calculateFees(fareBasePrice: number) {
    const airportTax = Math.round(fareBasePrice * 0.08); // phí sân bay 8%
    const serviceFee = 50000; // phí dịch vụ cố định
    const total = fareBasePrice + airportTax + serviceFee;
    return { fareBasePrice, airportTax, serviceFee, total };
  }

  private getLockKey(seatId: string): string {
    return `seat:lock:${seatId}`;
  }

  async lockSeat(
    seatId: string,
    fareClassId: string,
    userId: string,
  ): Promise<Booking> {
    const user = await this.usersService.findById(userId);
    if (!user.isVerified) {
      throw new ForbiddenException(
        'Tài khoản chưa xác thực, vui lòng verify OTP trước',
      );
    }

    const seat = await this.flightsService.getSeatById(seatId);
    if (seat.status !== SeatStatus.AVAILABLE) {
      throw new BadRequestException('Ghế đã được đặt hoặc đang bị giữ');
    }

    const fareClass = await this.flightsService.getFareClassById(fareClassId);

    const lockKey = this.getLockKey(seatId);
    const result = await this.redis.set(
      lockKey,
      userId,
      'EX',
      LOCK_TTL_SECONDS,
      'NX',
    );

    if (result !== 'OK') {
      throw new BadRequestException(
        'Ghế vừa bị người khác giữ, vui lòng chọn ghế khác',
      );
    }

    try {
      await this.flightsService.updateSeatStatus(seatId, SeatStatus.LOCKED);

      const lockExpiresAt = new Date(Date.now() + LOCK_TTL_SECONDS * 1000);

      const booking = this.bookingsRepository.create({
        user: { id: userId },
        seat: { id: seatId },
        fareClass: { id: fareClassId },
        status: BookingStatus.PENDING,
        lockExpiresAt,
      });

      const saved = await this.bookingsRepository.save(booking);

      this.bookingsGateway.notifySeatLocked(
        seat.flight.id,
        seatId,
        seat.seatNumber,
      );

      const availableCount = await this.flightsService.countAvailableSeats(
        seat.flight.id,
      );
      this.bookingsGateway.notifyFlightSeatsChanged(
        seat.flight.id,
        availableCount,
      );

      await this.activityLogService.log(
        userId,
        ActivityAction.LOCK_SEAT,
        `Giữ ghế ${seat.seatNumber} — chuyến ${seat.flight.flightCode}`,
        { seatId, seatNumber: seat.seatNumber, flightId: seat.flight.id },
      );

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
    passengers: {
      bookingId: string;
      passengerName: string;
      passengerPhone: string;
    }[],
    userId: string,
    paymentSessionId?: string,
  ): Promise<Booking[]> {
    if (bookingIds.length === 0) {
      throw new BadRequestException('Không có ghế nào để xác nhận');
    }

    const bookingCode =
      'TL' + Math.random().toString(36).substring(2, 8).toUpperCase();

    return this.bookingsRepository.manager.transaction(async (manager) => {
      const confirmedBookings: Booking[] = [];
      let totalAmount = 0;

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
          throw new BadRequestException(
            `Ghế ${booking.seat.seatNumber} không ở trạng thái chờ thanh toán`,
          );
        }
        if (new Date() > booking.lockExpiresAt) {
          throw new BadRequestException(
            `Đã hết thời gian giữ ghế ${booking.seat.seatNumber}`,
          );
        }

        const passengerInfo = passengers.find((p) => p.bookingId === bookingId);
        if (!passengerInfo) {
          throw new BadRequestException(
            `Thiếu thông tin hành khách cho ghế ${booking.seat.seatNumber}`,
          );
        }

        booking.status = BookingStatus.CONFIRMED;
        booking.passengerName = passengerInfo.passengerName;
        booking.passengerPhone = passengerInfo.passengerPhone;
        booking.bookingCode = bookingCode;

        await manager.save(booking);
        await manager.update('seats', booking.seat.id, {
          status: SeatStatus.BOOKED,
        });

        totalAmount += Number(booking.fareClass.price);
        confirmedBookings.push(booking);
      }

      // Tạo 1 bản ghi Payment cho MỖI booking — mỗi ghế có 1 giao dịch riêng, dễ đối soát/tra cứu
      // dù cùng nằm chung 1 lần thanh toán QR (paymentSessionId dùng để nhóm lại khi cần)
      for (const booking of confirmedBookings) {
        const transactionCode =
          'TXN' + Math.random().toString(36).substring(2, 10).toUpperCase();

        const payment = manager.create(Payment, {
          booking: { id: booking.id } as any,
          transactionCode,
          amount: booking.fareClass.price,
          method: PaymentMethod.QR,
          status: PaymentStatus.SUCCESS,
          paymentSessionId: paymentSessionId || undefined,
          paidAt: new Date(),
        });

        await manager.save(payment);
      }

      // Bắn WebSocket + cleanup Redis SAU khi transaction DB chắc chắn thành công
      for (const booking of confirmedBookings) {
        await this.redis.del(this.getLockKey(booking.seat.id));
        this.bookingsGateway.notifySeatBooked(
          booking.seat.flight.id,
          booking.seat.id,
          booking.seat.seatNumber,
        );
      }

      if (confirmedBookings.length > 0) {
        const flightId = confirmedBookings[0].seat.flight.id;
        const availableCount =
          await this.flightsService.countAvailableSeats(flightId);
        this.bookingsGateway.notifyFlightSeatsChanged(flightId, availableCount);

        await this.activityLogService.log(
          userId,
          ActivityAction.CONFIRM_BOOKING,
          `Đặt thành công ${confirmedBookings.length} vé — Mã: ${bookingCode}`,
          {
            bookingCode,
            seatCount: confirmedBookings.length,
            seats: confirmedBookings.map((b) => b.seat.seatNumber),
            totalAmount,
          },
        );

        const user = await this.usersService.findById(userId);
        const flight = confirmedBookings[0].seat.flight;
        this.mailService
          .sendBookingConfirmationEmail(
            user.email,
            bookingCode,
            confirmedBookings.length,
            `${flight.flightCode}: ${flight.departureCity} → ${flight.arrivalCity}`,
          )
          .catch(() => {});
      }

      const bookingsWithPayment = await manager.find(Booking, {
        where: confirmedBookings.map((b) => ({ id: b.id })),
        relations: ['seat', 'seat.flight', 'fareClass', 'payment'],
      });
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

    await this.flightsService.updateSeatStatus(
      booking.seat.id,
      SeatStatus.AVAILABLE,
    );
    await this.redis.del(this.getLockKey(booking.seat.id));

    this.bookingsGateway.notifySeatReleased(
      booking.seat.flight.id,
      booking.seat.id,
      booking.seat.seatNumber,
    );

    const availableCount = await this.flightsService.countAvailableSeats(
      booking.seat.flight.id,
    );
    this.bookingsGateway.notifyFlightSeatsChanged(
      booking.seat.flight.id,
      availableCount,
    );
  }

  async findMyBookings(userId: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: { user: { id: userId } },
      relations: ['seat', 'seat.flight', 'fareClass', 'payment'],
      order: { createdAt: 'DESC' },
    });
  }

  async cancelConfirmedBooking(
    bookingId: string,
    userId: string,
  ): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
      relations: ['user', 'seat', 'seat.flight', 'fareClass', 'payment'],
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
      throw new BadRequestException(
        'Không thể hủy vé cho chuyến bay đã khởi hành',
      );
    }

    booking.status = BookingStatus.CANCELLED;
    await this.bookingsRepository.save(booking);

    // Đánh dấu payment tương ứng là đã hoàn tiền — giữ lại lịch sử, không xóa bản ghi
    if (booking.payment) {
      booking.payment.status = PaymentStatus.REFUNDED;
      await this.paymentsRepository.save(booking.payment);
    }

    await this.flightsService.updateSeatStatus(
      booking.seat.id,
      SeatStatus.AVAILABLE,
    );

    this.bookingsGateway.notifySeatReleased(
      booking.seat.flight.id,
      booking.seat.id,
      booking.seat.seatNumber,
    );

    const availableCount = await this.flightsService.countAvailableSeats(
      booking.seat.flight.id,
    );
    this.bookingsGateway.notifyFlightSeatsChanged(
      booking.seat.flight.id,
      availableCount,
    );

    await this.activityLogService.log(
      userId,
      ActivityAction.CANCEL_BOOKING,
      `Hủy vé ghế ${booking.seat.seatNumber}`,
      {
        bookingId,
        seatNumber: booking.seat.seatNumber,
        bookingCode: booking.bookingCode,
      },
    );

    return booking;
  }

  async getPriceBreakdown(fareClassId: string, passengerCount: number) {
    const fareClass = await this.flightsService.getFareClassById(fareClassId);
    const perPax = this.calculateFees(Number(fareClass.price));

    return {
      perPassenger: perPax,
      passengerCount,
      grandTotal: perPax.total * passengerCount,
    };
  }

  // Tạo "phiên thanh toán QR" giả lập — trả về nội dung QR để frontend render
  async createQrPaymentSession(bookingIds: string[], userId: string) {
    const bookings = await this.bookingsRepository.find({
      where: bookingIds.map((id) => ({ id })),
      relations: ['user', 'fareClass'],
    });

    if (bookings.length === 0 || bookings.some((b) => b.user.id !== userId)) {
      throw new BadRequestException('Booking không hợp lệ');
    }

    const totalAmount = bookings.reduce(
      (sum, b) => sum + Number(b.fareClass.price),
      0,
    );
    const sessionId =
      'PAY' + Math.random().toString(36).substring(2, 10).toUpperCase();

    // Lưu tạm phiên thanh toán vào Redis, TTL 5 phút — khớp với thời gian giữ ghế
    await this.redis.set(
      `payment_session:${sessionId}`,
      JSON.stringify({ bookingIds, userId, totalAmount }),
      'EX',
      300,
    );

    return {
      sessionId,
      amount: totalAmount,
      // Nội dung QR mô phỏng theo chuẩn VietQR (dùng để hiển thị, không phải QR thanh toán thật)
      qrContent: `TRIPLOCK|${sessionId}|${totalAmount}|${new Date().getTime()}`,
    };
  }

  // Mô phỏng việc "đã quét xong" -> tiến hành confirm booking thật
  async confirmQrPayment(
    sessionId: string,
    passengers: {
      bookingId: string;
      passengerName: string;
      passengerPhone: string;
    }[],
    userId: string,
  ) {
    const raw = await this.redis.get(`payment_session:${sessionId}`);
    if (!raw) {
      throw new BadRequestException(
        'Phiên thanh toán đã hết hạn hoặc không tồn tại',
      );
    }

    const session = JSON.parse(raw);
    if (session.userId !== userId) {
      throw new ForbiddenException('Phiên thanh toán không thuộc về bạn');
    }

    const result = await this.confirmMultiple(
      session.bookingIds,
      passengers,
      userId,
      sessionId,
    );

    await this.redis.del(`payment_session:${sessionId}`);

    return result;
  }

  async findMyPayments(userId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { booking: { user: { id: userId } } },
      relations: ['booking', 'booking.seat', 'booking.seat.flight'],
      order: { createdAt: 'DESC' },
    });
  }
}
