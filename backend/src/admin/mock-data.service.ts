import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/entities/user.entity';
import { Flight } from '../flights/entities/flight.entity';
import { Seat, SeatStatus } from '../flights/entities/seat.entity';
import { FareClass } from '../flights/entities/fare-class.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
} from '../bookings/entities/payment.entity';

const FIRST_NAMES = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Ngô',
  'Dương',
  'Lý',
];
const MIDDLE_NAMES = [
  'Văn',
  'Thị',
  'Hữu',
  'Minh',
  'Ngọc',
  'Thành',
  'Đức',
  'Quang',
  'Anh',
  'Xuân',
];
const LAST_NAMES = [
  'An',
  'Bình',
  'Cường',
  'Dũng',
  'Em',
  'Phong',
  'Giang',
  'Hà',
  'Huy',
  'Khang',
  'Lan',
  'Mai',
  'Nam',
  'Oanh',
  'Phúc',
  'Quân',
  'Sơn',
  'Thảo',
  'Uyên',
  'Việt',
];
const CITIES = [
  'Hà Nội',
  'Hồ Chí Minh',
  'Đà Nẵng',
  'Nha Trang',
  'Phú Quốc',
  'Huế',
  'Đà Lạt',
  'Cần Thơ',
  'Hải Phòng',
  'Quy Nhơn',
];
const AIRLINE_PREFIXES = ['VN', 'VJ', 'QH', 'BL'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomVietnameseName(): string {
  return `${randomItem(FIRST_NAMES)} ${randomItem(MIDDLE_NAMES)} ${randomItem(LAST_NAMES)}`;
}
function randomPastOrFutureDate(daysBack: number, daysForward: number): Date {
  const offsetDays = randomInt(-daysBack, daysForward);
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(randomInt(5, 21), randomItem([0, 15, 30, 45]), 0, 0);
  return d;
}

// Insert theo lô bằng raw INSERT (không phụ thuộc thứ tự RETURNING của Postgres),
// vì ID đã được tự sinh sẵn trước khi insert -> luôn biết chính xác ID ứng với dòng nào
async function chunkInsert<T extends Record<string, any>>(
  repo: Repository<T>,
  rows: any[],
  chunkSize = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await repo.createQueryBuilder().insert().values(chunk).execute();
  }
}

@Injectable()
export class MockDataService {
  private logger = new Logger('MockDataService');

  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(Flight) private flightsRepository: Repository<Flight>,
    @InjectRepository(Seat) private seatsRepository: Repository<Seat>,
    @InjectRepository(FareClass)
    private fareClassRepository: Repository<FareClass>,
    @InjectRepository(Booking) private bookingsRepository: Repository<Booking>,
    @InjectRepository(Payment) private paymentsRepository: Repository<Payment>,
  ) {}

  async seedAll() {
    const startedAt = Date.now();

    // Tự động dọn dữ liệu mock cũ (nếu có) trước khi seed lại, tránh lỗi trùng khóa
    this.logger.log('Đang dọn dữ liệu mock cũ (nếu có)...');
    await this.usersRepository
      .createQueryBuilder()
      .delete()
      .where('email LIKE :pattern', { pattern: 'user%@demo.com' })
      .execute();

    // ===== 1. TẠO 100 USER — tự sinh ID trước =====
    this.logger.log('Đang tạo 100 user...');
    const hashedPassword = await bcrypt.hash('Demo@123456', 10);
    const userRows = Array.from({ length: 100 }, (_, i) => ({
      id: randomUUID(),
      email: `user${i + 1}@demo.com`,
      password: hashedPassword,
      fullName: randomVietnameseName(),
      isVerified: true,
      role: UserRole.USER,
    }));
    await chunkInsert(this.usersRepository, userRows);
    const userIds: string[] = userRows.map((u) => u.id);
    this.logger.log(`Đã tạo ${userIds.length} user`);

    // ===== 2. TẠO 100 CHUYẾN BAY =====
    this.logger.log('Đang tạo 100 chuyến bay...');
    const flightRows = Array.from({ length: 100 }, () => {
      const departureCity = randomItem(CITIES);
      let arrivalCity = randomItem(CITIES);
      while (arrivalCity === departureCity) arrivalCity = randomItem(CITIES);

      const departureTime = randomPastOrFutureDate(45, 45);
      const durationHours = randomInt(1, 3);
      const arrivalTime = new Date(
        departureTime.getTime() + durationHours * 60 * 60 * 1000,
      );
      const price = randomInt(80, 350) * 10000;

      return {
        id: randomUUID(),
        flightCode: `${randomItem(AIRLINE_PREFIXES)}${randomInt(100, 999)}`,
        departureCity,
        arrivalCity,
        departureTime,
        arrivalTime,
        price,
      };
    });
    await chunkInsert(this.flightsRepository, flightRows);
    this.logger.log(`Đã tạo ${flightRows.length} chuyến bay`);

    // ===== 3. TẠO 3 HẠNG VÉ CHO MỖI CHUYẾN =====
    this.logger.log('Đang tạo hạng vé...');
    const fareClassRows: any[] = [];
    const fareClassByFlight: Record<string, { id: string; price: number }[]> =
      {};

    flightRows.forEach((flight) => {
      const basePrice = flight.price;
      const classes = [
        {
          id: randomUUID(),
          flightId: flight.id,
          name: 'Economy',
          price: basePrice,
          carryOnKg: 7,
          checkedBaggageKg: 0,
          refundable: false,
          changeable: false,
          note: 'Vé điện tử phát hành trong 24 giờ',
        },
        {
          id: randomUUID(),
          flightId: flight.id,
          name: 'Economy Saver',
          price: Math.round(basePrice * 1.15),
          carryOnKg: 7,
          checkedBaggageKg: 20,
          refundable: false,
          changeable: true,
          note: 'Đổi lịch có phí, bao gồm 20kg ký gửi',
        },
        {
          id: randomUUID(),
          flightId: flight.id,
          name: 'Economy An toàn',
          price: Math.round(basePrice * 1.35),
          carryOnKg: 7,
          checkedBaggageKg: 20,
          refundable: true,
          changeable: true,
          note: 'Hoàn 80% giá vé, bảo hiểm kèm theo',
        },
      ];
      fareClassRows.push(...classes);
      fareClassByFlight[flight.id] = classes.map((c) => ({
        id: c.id,
        price: c.price,
      }));
    });

    await chunkInsert(this.fareClassRepository, fareClassRows);
    this.logger.log(`Đã tạo ${fareClassRows.length} hạng vé`);

    // ===== 4. TẠO GHẾ (150/chuyến) =====
    this.logger.log('Đang tạo 15,000 ghế...');
    const SEATS_PER_FLIGHT = 150;
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const seatRows: {
      id: string;
      seatNumber: string;
      status: SeatStatus;
      flightId: string;
    }[] = [];

    flightRows.forEach((flight) => {
      const rows = SEATS_PER_FLIGHT / 6;
      for (let row = 1; row <= rows; row++) {
        for (const letter of letters) {
          seatRows.push({
            id: randomUUID(),
            seatNumber: `${row}${letter}`,
            status: SeatStatus.AVAILABLE, // sẽ cập nhật lại sau khi biết booking nào confirmed
            flightId: flight.id,
          });
        }
      }
    });
    await chunkInsert(this.seatsRepository, seatRows);
    this.logger.log(`Đã tạo ${seatRows.length} ghế`);

    // ===== 5. TẠO BOOKING CHO ~80% SỐ GHẾ =====
    this.logger.log('Đang tạo booking...');
    const bookingRows: any[] = [];
    const bookedSeatIds: string[] = []; // ghế nào cuối cùng có booking CONFIRMED -> set BOOKED

    seatRows.forEach((seat) => {
      if (Math.random() >= 0.8) return; // 20% để trống thật

      const userId = randomItem(userIds);
      const fareClasses = fareClassByFlight[seat.flightId];
      const fareClass = randomItem(fareClasses);

      const roll = Math.random();
      let status: BookingStatus;
      if (roll < 0.85) status = BookingStatus.CONFIRMED;
      else if (roll < 0.95) status = BookingStatus.CANCELLED;
      else status = BookingStatus.EXPIRED;

      const bookingId = randomUUID();
      const bookingCode =
        status === BookingStatus.CONFIRMED || status === BookingStatus.CANCELLED
          ? 'TL' + Math.random().toString(36).substring(2, 8).toUpperCase()
          : null;

      bookingRows.push({
        id: bookingId,
        userId,
        seatId: seat.id,
        fareClassId: fareClass.id,
        status,
        lockExpiresAt: new Date(),
        passengerName:
          status !== BookingStatus.EXPIRED ? randomVietnameseName() : null,
        passengerPhone:
          status !== BookingStatus.EXPIRED
            ? `09${randomInt(10000000, 99999999)}`
            : null,
        bookingCode,
        _amount: fareClass.price, // field tạm, không insert, dùng để tạo payment bên dưới
        _status: status,
      });

      if (status === BookingStatus.CONFIRMED) {
        bookedSeatIds.push(seat.id);
      }
    });

    // Tách field tạm ra trước khi insert thật (Postgres sẽ báo lỗi cột lạ nếu để nguyên)
    const cleanBookingRows = bookingRows.map(
      ({ _amount, _status, ...rest }) => rest,
    );
    await chunkInsert(this.bookingsRepository, cleanBookingRows);
    this.logger.log(`Đã tạo ${cleanBookingRows.length} booking`);

    // ===== 6. CẬP NHẬT GHẾ ĐÃ CONFIRMED THÀNH BOOKED =====
    this.logger.log('Đang đồng bộ trạng thái ghế...');
    for (let i = 0; i < bookedSeatIds.length; i += 500) {
      const chunk = bookedSeatIds.slice(i, i + 500);
      await this.seatsRepository
        .createQueryBuilder()
        .update()
        .set({ status: SeatStatus.BOOKED })
        .where('id IN (:...ids)', { ids: chunk })
        .execute();
    }

    // ===== 7. TẠO PAYMENT CHO BOOKING CONFIRMED/CANCELLED =====
    this.logger.log('Đang tạo payment...');
    const paymentRows = bookingRows
      .filter((b) => b._status !== BookingStatus.EXPIRED)
      .map((b) => {
        const paidDaysAgo = randomInt(0, 45);
        const paidAt = new Date();
        paidAt.setDate(paidAt.getDate() - paidDaysAgo);

        return {
          id: randomUUID(),
          bookingId: b.id,
          transactionCode:
            'TXN' + Math.random().toString(36).substring(2, 10).toUpperCase(),
          amount: b._amount,
          method: PaymentMethod.QR,
          status:
            b._status === BookingStatus.CONFIRMED
              ? PaymentStatus.SUCCESS
              : PaymentStatus.REFUNDED,
          paidAt,
        };
      });

    await chunkInsert(this.paymentsRepository, paymentRows);
    this.logger.log(`Đã tạo ${paymentRows.length} payment`);

    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

    return {
      message: 'Đã tạo dữ liệu mock thành công',
      summary: {
        users: userIds.length,
        flights: flightRows.length,
        fareClasses: fareClassRows.length,
        seats: seatRows.length,
        bookings: cleanBookingRows.length,
        payments: paymentRows.length,
        elapsedSeconds: Number(elapsedSec),
      },
    };
  }
}
