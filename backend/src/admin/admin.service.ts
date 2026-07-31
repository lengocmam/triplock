import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Payment, PaymentStatus } from '../bookings/entities/payment.entity';
import { Flight } from '../flights/entities/flight.entity';
import { Seat, SeatStatus } from '../flights/entities/seat.entity';
import { User } from '../users/entities/user.entity';
import { FlightsService } from '../flights/flights.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const CACHE_TTL_SECONDS = 60; // dashboard không cần real-time tuyệt đối, cache 60s giảm tải DB đáng kể

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Booking) private bookingsRepository: Repository<Booking>,
    @InjectRepository(Payment) private paymentsRepository: Repository<Payment>,
    @InjectRepository(Flight) private flightsRepository: Repository<Flight>,
    @InjectRepository(Seat) private seatsRepository: Repository<Seat>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    private flightsService: FlightsService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  private async getCached<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    const result = await compute();
    await this.redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
    return result;
  }

  // ===== TỔNG QUAN DASHBOARD — dùng SQL SUM/COUNT thay vì load hết payment vào RAM =====
  async getDashboardStats() {
    return this.getCached('admin:dashboard-stats', async () => {
      const revenueRow = await this.paymentsRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
        .getRawOne();

      const todayRevenueRow = await this.paymentsRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
        .andWhere('payment."paidAt" >= CURRENT_DATE')
        .getRawOne();

      const refundedRow = await this.paymentsRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('payment.status = :status', { status: PaymentStatus.REFUNDED })
        .getRawOne();

      const totalBookings = await this.bookingsRepository.count({
        where: { status: BookingStatus.CONFIRMED },
      });
      const totalUsers = await this.usersRepository.count();
      const totalFlights = await this.flightsRepository.count();

      const seatStatsRow = await this.seatsRepository
        .createQueryBuilder('seat')
        .select('COUNT(*)', 'total')
        .addSelect(
          `COUNT(*) FILTER (WHERE seat.status = :bookedStatus)`,
          'booked',
        )
        .setParameter('bookedStatus', SeatStatus.BOOKED)
        .getRawOne();

      const totalRevenue = Number(revenueRow.total);
      const totalRefunded = Number(refundedRow.total);
      const totalSeats = Number(seatStatsRow.total);
      const bookedSeats = Number(seatStatsRow.booked);

      return {
        totalRevenue,
        todayRevenue: Number(todayRevenueRow.total),
        totalRefunded,
        netRevenue: totalRevenue - totalRefunded,
        totalBookings,
        totalUsers,
        totalFlights,
        occupancyRate: totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0,
      };
    });
  }

  // ===== BIỂU ĐỒ DOANH THU 14 NGÀY — 1 query SQL GROUP BY thay vì 14 query vòng lặp =====
  async getRevenueChart() {
    return this.getCached('admin:revenue-chart', async () => {
      const rows = await this.paymentsRepository
        .createQueryBuilder('payment')
        .select(`DATE(payment."paidAt")`, 'date')
        .addSelect('SUM(payment.amount)', 'revenue')
        .addSelect('COUNT(*)', 'bookingCount')
        .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
        .andWhere(`payment."paidAt" >= CURRENT_DATE - INTERVAL '13 days'`)
        .groupBy(`DATE(payment."paidAt")`)
        .orderBy(`DATE(payment."paidAt")`, 'ASC')
        .getRawMany();

      // Điền đủ 14 ngày kể cả ngày không có doanh thu (để biểu đồ không bị đứt đoạn)
      const map = new Map(rows.map((r) => [r.date, { revenue: Number(r.revenue), bookingCount: Number(r.bookingCount) }]));
      const result: { date: string; revenue: number; bookingCount: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const found = map.get(key);
        result.push({
          date: key,
          revenue: found?.revenue || 0,
          bookingCount: found?.bookingCount || 0,
        });
      }
      return result;
    });
  }

  // ===== TOP 5 TUYẾN BAY — SQL JOIN + GROUP BY, không load booking vào RAM =====
  async getTopRoutes() {
    return this.getCached('admin:top-routes', async () => {
      const rows = await this.bookingsRepository
        .createQueryBuilder('booking')
        .innerJoin('booking.seat', 'seat')
        .innerJoin('seat.flight', 'flight')
        .innerJoin('booking.fareClass', 'fareClass')
        .select(`flight."departureCity" || ' → ' || flight."arrivalCity"`, 'route')
        .addSelect('SUM(fareClass.price)', 'revenue')
        .addSelect('COUNT(*)', 'bookingCount')
        .where('booking.status = :status', { status: BookingStatus.CONFIRMED })
        .groupBy(`flight."departureCity" || ' → ' || flight."arrivalCity"`)
        .orderBy('revenue', 'DESC')
        .limit(5)
        .getRawMany();

      return rows.map((r) => ({
        route: r.route,
        revenue: Number(r.revenue),
        bookingCount: Number(r.bookingCount),
      }));
    });
  }

  // ===== TỶ LỆ HẠNG VÉ — SQL GROUP BY =====
  async getFareClassBreakdown() {
    return this.getCached('admin:fare-class-breakdown', async () => {
      const rows = await this.bookingsRepository
        .createQueryBuilder('booking')
        .innerJoin('booking.fareClass', 'fareClass')
        .select('fareClass.name', 'name')
        .addSelect('COUNT(*)', 'count')
        .where('booking.status = :status', { status: BookingStatus.CONFIRMED })
        .groupBy('fareClass.name')
        .getRawMany();

      return rows.map((r) => ({ name: r.name, count: Number(r.count) }));
    });
  }

  // ===== QUẢN LÝ CHUYẾN BAY — 1 query duy nhất với LEFT JOIN + GROUP BY thay vì N+1 =====
  async getAllFlightsWithStats(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const rows = await this.flightsRepository
      .createQueryBuilder('flight')
      .leftJoin('flight.seats', 'seat')
      .leftJoin(
        'bookings',
        'booking',
        'booking."seatId" = seat.id AND booking.status = :confirmedStatus',
        { confirmedStatus: BookingStatus.CONFIRMED },
      )
      .leftJoin('fare_classes', 'fareClass', 'fareClass.id = booking."fareClassId"')
      .select('flight.id', 'id')
      .addSelect('flight.flightCode', 'flightCode')
      .addSelect('flight.departureCity', 'departureCity')
      .addSelect('flight.arrivalCity', 'arrivalCity')
      .addSelect('flight.departureTime', 'departureTime')
      .addSelect('flight.arrivalTime', 'arrivalTime')
      .addSelect('flight.price', 'price')
      .addSelect('COUNT(DISTINCT seat.id)', 'totalSeats')
      .addSelect(
        `COUNT(DISTINCT seat.id) FILTER (WHERE seat.status = :bookedStatus)`,
        'bookedSeats',
      )
      .addSelect('COALESCE(SUM(fareClass.price), 0)', 'revenue')
      .setParameter('bookedStatus', SeatStatus.BOOKED)
      .groupBy('flight.id')
      .orderBy('flight.departureTime', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany();

      const totalCount = await this.flightsRepository.count();

    const items = rows.map((r) => ({
      id: r.id,
      flightCode: r.flightCode,
      departureCity: r.departureCity,
      arrivalCity: r.arrivalCity,
      departureTime: r.departureTime,
      arrivalTime: r.arrivalTime,
      price: Number(r.price),
      totalSeats: Number(r.totalSeats),
      bookedSeats: Number(r.bookedSeats),
      occupancyRate: Number(r.totalSeats) > 0 ? Math.round((Number(r.bookedSeats) / Number(r.totalSeats)) * 100) : 0,
      revenue: Number(r.revenue),
    }));

    return { items, totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) };
  }

  async createFlight(data: any) {
    await this.invalidateCache();
    return this.flightsService.createFlightWithSeats(data);
  }

  async updateFlight(flightId: string, data: any) {
    await this.flightsRepository.update(flightId, data);
    await this.invalidateCache();
    return this.flightsRepository.findOne({ where: { id: flightId } });
  }

  async deleteFlight(flightId: string) {
    await this.flightsRepository.delete(flightId);
    await this.invalidateCache();
    return { message: 'Đã xóa chuyến bay' };
  }

  async getFareClassesForFlight(flightId: string) {
    return this.flightsService.getFareClasses(flightId);
  }

  async updateFareClass(fareClassId: string, data: any) {
    await this.invalidateCache();
    return this.flightsService.updateFareClass(fareClassId, data);
  }

  // Xóa cache dashboard khi có thay đổi dữ liệu (tạo/sửa/xóa chuyến bay) để không hiện số liệu cũ
  private async invalidateCache() {
    const keys = [
      'admin:dashboard-stats',
      'admin:revenue-chart',
      'admin:top-routes',
      'admin:fare-class-breakdown',
    ];
    await Promise.all(keys.map((k) => this.redis.del(k)));
  }

  // ===== NGƯỜI DÙNG — có phân trang =====
  async getAllUsers(page = 1, limit = 20) {
    const [items, totalCount] = await this.usersRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'email', 'fullName', 'isVerified', 'role', 'createdAt'], // không bao giờ trả password
    });
    return { items, totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) };
  }

  // ===== ĐẶT VÉ — có phân trang, không lấy hết 1 lần =====
  async getAllBookings(page = 1, limit = 20) {
    const [items, totalCount] = await this.bookingsRepository.findAndCount({
      where: { status: BookingStatus.CONFIRMED },
      relations: ['user', 'seat', 'seat.flight', 'fareClass', 'payment'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) };
  }
}