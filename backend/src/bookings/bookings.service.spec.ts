import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { Booking, BookingStatus } from './entities/booking.entity';
import { FlightsService } from '../flights/flights.service';
import { UsersService } from '../users/users.service';
import { BookingsGateway } from './bookings.gateway';
import { REDIS_CLIENT } from '../redis/redis.module';
import { SeatStatus } from '../flights/entities/seat.entity';
import { Payment } from './entities/payment.entity';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let mockRedis: any;
  let mockBookingRepo: any;
  let mockFlightsService: any;
  let mockUsersService: any;
  let mockGateway: any;
  let mockPaymentRepo: any;
  let mockActivityLogService: any;
  let mockMailService: any;

  const mockUserId = 'user-1';
  const mockSeatId = 'seat-1';
  const mockFareClassId = 'fare-1';
  const mockSeat = {
    id: mockSeatId,
    seatNumber: '1A',
    status: SeatStatus.AVAILABLE,
    flight: {
      id: 'flight-1',
      flightCode: 'VN123',
    },
  };

  beforeEach(async () => {
    // Mock Redis: mô phỏng hành vi SET NX thật
    // Dùng 1 biến giả lập "đã có key hay chưa" để test race condition
    mockRedis = {
      set: jest.fn(),
      del: jest.fn(),
    };

    mockBookingRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 'booking-1', ...data })),
      findOne: jest.fn(),
    };

    mockFlightsService = {
      getSeatById: jest.fn().mockResolvedValue(mockSeat),

      getFareClassById: jest.fn().mockResolvedValue({
        id: mockFareClassId,
        className: 'Economy',
        price: 100,
      }),

      updateSeatStatus: jest.fn().mockResolvedValue(undefined),

      countAvailableSeats: jest.fn().mockResolvedValue(25),
    };

    mockUsersService = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: mockUserId, isVerified: true }),
    };

    mockGateway = {
      notifySeatLocked: jest.fn(),
      notifySeatBooked: jest.fn(),
      notifySeatReleased: jest.fn(),
      notifyFlightSeatsChanged: jest.fn(),
    };

    mockPaymentRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    mockActivityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockMailService = {
      sendMail: jest.fn(),
      sendBookingConfirmation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: FlightsService, useValue: mockFlightsService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: BookingsGateway, useValue: mockGateway },
        { provide: ActivityLogService, useValue: mockActivityLogService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  describe('lockSeat', () => {
    it('nên giữ ghế thành công khi Redis SET NX trả về OK', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.lockSeat(mockSeatId, mockFareClassId, mockUserId);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `seat:lock:${mockSeatId}`,
        mockUserId,
        'EX',
        300,
        'NX',
      );
      expect(mockFlightsService.updateSeatStatus).toHaveBeenCalledWith(
        mockSeatId,
        SeatStatus.LOCKED,
      );
      expect(mockGateway.notifySeatLocked).toHaveBeenCalled();
      expect(result.status).toBe(BookingStatus.PENDING);
    });

    it('nên báo lỗi khi Redis SET NX trả về null (ghế đã bị lock trước đó)', async () => {
      // Đây chính là tình huống race condition: request thứ 2 đến sau, Redis trả null
      mockRedis.set.mockResolvedValue(null);

      await expect(service.lockSeat(mockSeatId, mockFareClassId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );

      // Đảm bảo KHÔNG có thao tác DB nào xảy ra khi lock thất bại
      expect(mockFlightsService.updateSeatStatus).not.toHaveBeenCalled();
      expect(mockGateway.notifySeatLocked).not.toHaveBeenCalled();
    });

    it('nên báo lỗi khi user chưa xác thực OTP (isVerified = false)', async () => {
      mockUsersService.findById.mockResolvedValue({
        id: mockUserId,
        isVerified: false,
      });

      await expect(service.lockSeat(mockSeatId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );

      // Không được gọi tới Redis nếu user chưa qua bước xác thực
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('nên báo lỗi khi ghế không ở trạng thái AVAILABLE', async () => {
      mockFlightsService.getSeatById.mockResolvedValue({
        ...mockSeat,
        status: SeatStatus.LOCKED,
      });

      await expect(service.lockSeat(mockSeatId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('nên rollback Redis lock nếu lưu DB thất bại', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockBookingRepo.save.mockRejectedValue(new Error('DB lỗi giả lập'));

      await expect(service.lockSeat(mockSeatId, mockUserId)).rejects.toThrow(
        'DB lỗi giả lập',
      );

      // Đây là điểm quan trọng: nếu DB lưu lỗi, phải xóa lock Redis
      // để tránh tình trạng "kẹt ghế" (ghế bị khóa vĩnh viễn dù không có booking nào)
      expect(mockRedis.del).toHaveBeenCalledWith(`seat:lock:${mockSeatId}`);
    });
  });

  describe('mô phỏng race condition: 2 request cùng lock 1 ghế', () => {
    it('chỉ 1 trong 2 request đồng thời được giữ ghế thành công', async () => {
      // Mô phỏng hành vi thật của Redis: chỉ request đầu tiên chạm vào "set"
      // nhận được OK, các request sau đó nhận null (giống SET NX thật)
      let seatIsLocked = false;
      mockRedis.set.mockImplementation(async () => {
        if (seatIsLocked) return null;
        seatIsLocked = true;
        return 'OK';
      });

      // Bắn 2 request "gần như đồng thời" bằng Promise.allSettled
      const results = await Promise.allSettled([
        service.lockSeat(mockSeatId,mockFareClassId, 'user-A'),
        service.lockSeat(mockSeatId,mockFareClassId, 'user-B'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
    });
  });
});
