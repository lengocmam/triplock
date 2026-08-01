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
import { FareClass } from '../flights/entities/fare-class.entity';

const CACHE_TTL_SECONDS = 60;

// ===== Kiểu dữ liệu cho kết quả raw query — tránh lỗi lint "unsafe any access" =====
interface SumResult {
  total: string;
}

interface SeatStatsResult {
  total: string;
  booked: string;
}

interface RevenueChartRow {
  date: string;
  revenue: string;
  bookingcount: string;
}

interface TopRouteRow {
  route: string;
  revenue: string;
  bookingcount: string;
}

export interface FareClassBreakdownRow {
  name: string;
  count: string;
}

export interface FlightStatsRow {
  id: string;
  flightCode: string;
  departureCity: string;
  arrivalCity: string;
  departureTime: Date;
  arrivalTime: Date;
  price: string;
  totalSeats: string;
  bookedSeats: string;
  revenue: string;
}

export interface DashboardStats {
  totalRevenue: number;
  todayRevenue: number;
  totalRefunded: number;
  netRevenue: number;
  totalBookings: number;
  totalUsers: number;
  totalFlights: number;
  occupancyRate: number;
}

interface RevenueChartPoint {
  date: string;
  revenue: number;
  bookingCount: number;
}

interface TopRoute {
  route: string;
  revenue: number;
  bookingCount: number;
}

interface FareClassBreakdown {
  name: string;
  count: number;
}

interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

  private async getCached<T>(
    key: string,
    compute: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    const result = await compute();
    await this.redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
    return result;
  }

  // ===== TỔNG QUAN DASHBOARD =====
  async getDashboardStats(): Promise<DashboardStats> {
    return this.getCached<DashboardStats>('admin:dashboard-stats', async () => {
      const revenueRow = await this.paymentsRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
        .getRawOne<SumResult>();

      const todayRevenueRow = await this.paymentsRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
        .andWhere('payment."paidAt" >= CURRENT_DATE')
        .getRawOne<SumResult>();

      const refundedRow = await this.paymentsRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('payment.status = :status', { status: PaymentStatus.REFUNDED })
        .getRawOne<SumResult>();

      const totalBookings = await this.bookingsRepository.count({
        where: { status: BookingStatus.CONFIRMED },
      });
      const totalUsers = await this.usersRepository.count();
      const totalFlights = await this.flightsRepository.count();

      const seatStatsRow = await this.seatsRepository
        .createQueryBuilder('seat')
        .select('COUNT(*)', 'total')
        .addSelect(
          'COUNT(*) FILTER (WHERE seat.status = :bookedStatus)',
          'booked',
        )
        .setParameter('bookedStatus', SeatStatus.BOOKED)
        .getRawOne<SeatStatsResult>();

      const totalRevenue = Number(revenueRow?.total ?? 0);
      const totalRefunded = Number(refundedRow?.total ?? 0);
      const totalSeats = Number(seatStatsRow?.total ?? 0);
      const bookedSeats = Number(seatStatsRow?.booked ?? 0);

      return {
        totalRevenue,
        todayRevenue: Number(todayRevenueRow?.total ?? 0),
        totalRefunded,
        netRevenue: totalRevenue - totalRefunded,
        totalBookings,
        totalUsers,
        totalFlights,
        occupancyRate:
          totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0,
      };
    });
  }

  // ===== BIỂU ĐỒ DOANH THU 14 NGÀY =====
  async getRevenueChart(): Promise<RevenueChartPoint[]> {
    return this.getCached<RevenueChartPoint[]>(
      'admin:revenue-chart',
      async () => {
        const rows = await this.paymentsRepository
          .createQueryBuilder('payment')
          .select('DATE(payment."paidAt")', 'date')
          .addSelect('SUM(payment.amount)', 'revenue')
          .addSelect('COUNT(*)', 'bookingCount')
          .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
          .andWhere(`payment."paidAt" >= CURRENT_DATE - INTERVAL '13 days'`)
          .groupBy('DATE(payment."paidAt")')
          .orderBy('DATE(payment."paidAt")', 'ASC')
          .getRawMany<RevenueChartRow>();

        const map = new Map<
          string,
          { revenue: number; bookingCount: number }
        >();
        for (const r of rows) {
          const dateKey = new Date(r.date).toISOString().split('T')[0];
          map.set(dateKey, {
            revenue: Number(r.revenue),
            bookingCount: Number(r.bookingcount),
          });
        }

        const result: RevenueChartPoint[] = [];
        for (let i = 13; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split('T')[0];
          const found = map.get(key);
          result.push({
            date: key,
            revenue: found?.revenue ?? 0,
            bookingCount: found?.bookingCount ?? 0,
          });
        }
        return result;
      },
    );
  }

  // ===== TOP 5 TUYẾN BAY =====
  async getTopRoutes(): Promise<TopRoute[]> {
    return this.getCached<TopRoute[]>('admin:top-routes', async () => {
      const rows = await this.bookingsRepository
        .createQueryBuilder('booking')
        .innerJoin('booking.seat', 'seat')
        .innerJoin('seat.flight', 'flight')
        .innerJoin('booking.fareClass', 'fareClass')
        .select(
          `flight."departureCity" || ' → ' || flight."arrivalCity"`,
          'route',
        )
        .addSelect('SUM(fareClass.price)', 'revenue')
        .addSelect('COUNT(*)', 'bookingCount')
        .where('booking.status = :status', { status: BookingStatus.CONFIRMED })
        .groupBy(`flight."departureCity" || ' → ' || flight."arrivalCity"`)
        .orderBy('revenue', 'DESC')
        .limit(5)
        .getRawMany<TopRouteRow>();

      return rows.map((r) => ({
        route: r.route,
        revenue: Number(r.revenue),
        bookingCount: Number(r.bookingcount),
      }));
    });
  }

  // ===== TỶ LỆ HẠNG VÉ =====
  async getFareClassBreakdown(): Promise<FareClassBreakdown[]> {
    return this.getCached<FareClassBreakdown[]>(
      'admin:fare-class-breakdown',
      async () => {
        const rows = await this.bookingsRepository
          .createQueryBuilder('booking')
          .innerJoin('booking.fareClass', 'fareClass')
          .select('fareClass.name', 'name')
          .addSelect('COUNT(*)', 'count')
          .where('booking.status = :status', {
            status: BookingStatus.CONFIRMED,
          })
          .groupBy('fareClass.name')
          .getRawMany<FareClassBreakdownRow>();

        return rows.map((r) => ({ name: r.name, count: Number(r.count) }));
      },
    );
  }

  // ===== QUẢN LÝ CHUYẾN BAY (phân trang, 1 query duy nhất) =====
  async getAllFlightsWithStats(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
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
      .leftJoin(
        'fare_classes',
        'fareClass',
        'fareClass.id = booking."fareClassId"',
      )
      .select('flight.id', 'id')
      .addSelect('flight.flightCode', 'flightCode')
      .addSelect('flight.departureCity', 'departureCity')
      .addSelect('flight.arrivalCity', 'arrivalCity')
      .addSelect('flight.departureTime', 'departureTime')
      .addSelect('flight.arrivalTime', 'arrivalTime')
      .addSelect('flight.price', 'price')
      .addSelect('COUNT(DISTINCT seat.id)', 'totalSeats')
      .addSelect(
        'COUNT(DISTINCT seat.id) FILTER (WHERE seat.status = :bookedStatus)',
        'bookedSeats',
      )
      .addSelect('COALESCE(SUM(fareClass.price), 0)', 'revenue')
      .setParameter('bookedStatus', SeatStatus.BOOKED)
      .groupBy('flight.id')
      .orderBy('flight.departureTime', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany<FlightStatsRow>();

    const totalCount = await this.flightsRepository.count();

    const items = rows.map((r) => {
      const totalSeats = Number(r.totalSeats);
      const bookedSeats = Number(r.bookedSeats);
      return {
        id: r.id,
        flightCode: r.flightCode,
        departureCity: r.departureCity,
        arrivalCity: r.arrivalCity,
        departureTime: r.departureTime,
        arrivalTime: r.arrivalTime,
        price: Number(r.price),
        totalSeats,
        bookedSeats,
        occupancyRate:
          totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0,
        revenue: Number(r.revenue),
      };
    });

    return {
      items,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async createFlight(data: {
    flightCode: string;
    departureCity: string;
    arrivalCity: string;
    departureTime: Date | string;
    arrivalTime: Date | string;
    price: number;
    seatCount: number;
  }): Promise<Flight> {
    await this.invalidateCache();
    return this.flightsService.createFlightWithSeats({
      ...data,
      departureTime: new Date(data.departureTime),
      arrivalTime: new Date(data.arrivalTime),
    });
  }

  async updateFlight(
    flightId: string,
    data: Partial<Flight>,
  ): Promise<Flight | null> {
    await this.flightsRepository.update(flightId, data);
    await this.invalidateCache();
    return this.flightsRepository.findOne({ where: { id: flightId } });
  }

  async deleteFlight(flightId: string): Promise<{ message: string }> {
    await this.flightsRepository.delete(flightId);
    await this.invalidateCache();
    return { message: 'Đã xóa chuyến bay' };
  }

  async getFareClassesForFlight(flightId: string) {
    return this.flightsService.getFareClasses(flightId);
  }

  async updateFareClass(fareClassId: string, data: Partial<FareClass>) {
    await this.invalidateCache();
    return this.flightsService.updateFareClass(fareClassId, data);
  }

  private async invalidateCache(): Promise<void> {
    const keys = [
      'admin:dashboard-stats',
      'admin:revenue-chart',
      'admin:top-routes',
      'admin:fare-class-breakdown',
    ];
    await Promise.all(keys.map((k) => this.redis.del(k)));
  }

  // ===== NGƯỜI DÙNG (phân trang) =====
  async getAllUsers(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Partial<User>>> {
    const [items, totalCount] = await this.usersRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'email', 'fullName', 'isVerified', 'role', 'createdAt'],
    });
    return {
      items,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  // ===== ĐẶT VÉ (phân trang) =====
  async getAllBookings(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Booking>> {
    const [items, totalCount] = await this.bookingsRepository.findAndCount({
      where: { status: BookingStatus.CONFIRMED },
      relations: ['user', 'seat', 'seat.flight', 'fareClass', 'payment'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }
}
