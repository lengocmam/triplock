import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Payment, PaymentStatus } from '../bookings/entities/payment.entity';
import { Flight } from '../flights/entities/flight.entity';
import { Seat, SeatStatus } from '../flights/entities/seat.entity';
import { User } from '../users/entities/user.entity';
import { FlightsService } from '../flights/flights.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Booking) private bookingsRepository: Repository<Booking>,
    @InjectRepository(Payment) private paymentsRepository: Repository<Payment>,
    @InjectRepository(Flight) private flightsRepository: Repository<Flight>,
    @InjectRepository(Seat) private seatsRepository: Repository<Seat>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    private flightsService: FlightsService,
  ) {}

  // ===== TỔNG QUAN DASHBOARD =====
  async getDashboardStats() {
    const successPayments = await this.paymentsRepository.find({
      where: { status: PaymentStatus.SUCCESS },
    });

    const totalRevenue = successPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRevenue = successPayments
      .filter((p) => new Date(p.paidAt) >= today)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const refundedPayments = await this.paymentsRepository.find({
      where: { status: PaymentStatus.REFUNDED },
    });
    const totalRefunded = refundedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const totalBookings = await this.bookingsRepository.count({
      where: { status: BookingStatus.CONFIRMED },
    });
    const totalUsers = await this.usersRepository.count();
    const totalFlights = await this.flightsRepository.count();

    const totalSeats = await this.seatsRepository.count();
    const bookedSeats = await this.seatsRepository.count({ where: { status: SeatStatus.BOOKED } });
    const occupancyRate = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;

    return {
      totalRevenue,
      todayRevenue,
      totalRefunded,
      netRevenue: totalRevenue - totalRefunded,
      totalBookings,
      totalUsers,
      totalFlights,
      occupancyRate,
    };
  }

  // ===== BIỂU ĐỒ DOANH THU 14 NGÀY GẦN NHẤT =====
  async getRevenueChart() {
    const days = 14;
    const result: { date: string; revenue: number; bookingCount: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const payments = await this.paymentsRepository.find({
        where: {
          status: PaymentStatus.SUCCESS,
          paidAt: Between(dayStart, dayEnd),
        },
      });

      const revenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

      result.push({
        date: dayStart.toISOString().split('T')[0],
        revenue,
        bookingCount: payments.length,
      });
    }

    return result;
  }

  // ===== TUYẾN BAY DOANH THU CAO NHẤT =====
  async getTopRoutes() {
    const bookings = await this.bookingsRepository.find({
      where: { status: BookingStatus.CONFIRMED },
      relations: ['seat', 'seat.flight', 'fareClass'],
    });

    const routeMap: Record<string, { route: string; revenue: number; bookingCount: number }> = {};
    let skippedCount = 0;

    for (const booking of bookings) {
      // Bỏ qua booking bị thiếu quan hệ (dữ liệu mồ côi/không toàn vẹn) thay vì crash cả API
      if (!booking.seat || !booking.seat.flight || !booking.fareClass) {
        skippedCount++;
        continue;
      }

      const route = `${booking.seat.flight.departureCity} → ${booking.seat.flight.arrivalCity}`;
      if (!routeMap[route]) {
        routeMap[route] = { route, revenue: 0, bookingCount: 0 };
      }
      routeMap[route].revenue += Number(booking.fareClass.price);
      routeMap[route].bookingCount += 1;
    }

    if (skippedCount > 0) {
      console.warn(`[getTopRoutes] Bỏ qua ${skippedCount} booking thiếu quan hệ dữ liệu`);
    }

    return Object.values(routeMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  // ===== TỶ LỆ HẠNG VÉ ĐƯỢC MUA NHIỀU NHẤT =====
  async getFareClassBreakdown() {
    const bookings = await this.bookingsRepository.find({
      where: { status: BookingStatus.CONFIRMED },
      relations: ['fareClass'],
    });

    const breakdown: Record<string, number> = {};
    for (const b of bookings) {
      if (!b.fareClass) continue; // bỏ qua booking thiếu quan hệ fareClass
      const name = b.fareClass.name;
      breakdown[name] = (breakdown[name] || 0) + 1;
    }

    return Object.entries(breakdown).map(([name, count]) => ({ name, count }));
  }

  // ===== QUẢN LÝ CHUYẾN BAY =====
  async getAllFlightsWithStats() {
    const flights = await this.flightsRepository.find({ order: { departureTime: 'DESC' } });

    return Promise.all(
      flights.map(async (f) => {
        const totalSeats = await this.seatsRepository.count({ where: { flight: { id: f.id } } });
        const bookedSeats = await this.seatsRepository.count({
          where: { flight: { id: f.id }, status: SeatStatus.BOOKED },
        });
        const revenue = await this.bookingsRepository
          .createQueryBuilder('booking')
          .innerJoin('booking.seat', 'seat')
          .innerJoin('booking.fareClass', 'fareClass')
          .where('seat.flightId = :flightId', { flightId: f.id })
          .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
          .select('SUM(fareClass.price)', 'total')
          .getRawOne();

        return {
          ...f,
          totalSeats,
          bookedSeats,
          occupancyRate: totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0,
          revenue: Number(revenue?.total) || 0,
        };
      }),
    );
  }

  async createFlight(data: {
    flightCode: string;
    departureCity: string;
    arrivalCity: string;
    departureTime: Date;
    arrivalTime: Date;
    price: number;
    seatCount: number;
  }) {
    return this.flightsService.createFlightWithSeats(data);
  }

  async deleteFlight(flightId: string) {
    await this.flightsRepository.delete(flightId);
    return { message: 'Đã xóa chuyến bay' };
  }

  // ===== QUẢN LÝ NGƯỜI DÙNG =====
  async getAllUsers() {
    const users = await this.usersRepository.find({ order: { createdAt: 'DESC' } });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      isVerified: u.isVerified,
      role: u.role,
      createdAt: u.createdAt,
    }));
  }

  // ===== QUẢN LÝ TẤT CẢ ĐẶT VÉ =====
  async getAllBookings() {
    return this.bookingsRepository.find({
      where: { status: BookingStatus.CONFIRMED },
      relations: ['user', 'seat', 'seat.flight', 'fareClass', 'payment'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async updateFlight(flightId: string, data: Partial<{
    flightCode: string; departureCity: string; arrivalCity: string;
    departureTime: Date; arrivalTime: Date; price: number;
  }>) {
    await this.flightsRepository.update(flightId, data);
    return this.flightsRepository.findOne({ where: { id: flightId } });
  }

  async getFareClassesForFlight(flightId: string) {
    return this.flightsService.getFareClasses(flightId);
  }

  async updateFareClass(fareClassId: string, data: Partial<{
    price: number; carryOnKg: number; checkedBaggageKg: number;
    refundable: boolean; changeable: boolean; note: string;
  }>) {
    return this.flightsService.updateFareClass(fareClassId, data);
  }
}