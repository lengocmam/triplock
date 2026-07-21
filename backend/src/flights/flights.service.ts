import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flight } from './entities/flight.entity';
import { Seat, SeatStatus } from './entities/seat.entity';
import { FareClass } from './entities/fare-class.entity';

@Injectable()
export class FlightsService {
  constructor(
    @InjectRepository(Flight)
    private flightsRepository: Repository<Flight>,
    @InjectRepository(Seat)
    private seatsRepository: Repository<Seat>,
    @InjectRepository(FareClass)
    private fareClassRepository: Repository<FareClass>,
  ) {}

  async findAll(filters?: {
    departureCity?: string;
    arrivalCity?: string;
    date?: string;
  }): Promise<Flight[]> {
    const query = this.flightsRepository.createQueryBuilder('flight');

    if (filters?.departureCity) {
      query.andWhere('flight.departureCity ILIKE :dep', {
        dep: `%${filters.departureCity}%`,
      });
    }
    if (filters?.arrivalCity) {
      query.andWhere('flight.arrivalCity ILIKE :arr', {
        arr: `%${filters.arrivalCity}%`,
      });
    }
    if (filters?.date) {
      query.andWhere('DATE(flight.departureTime) = :date', { date: filters.date });
    }

    query.orderBy('flight.departureTime', 'ASC');
    return query.getMany();
  }

  async findOne(id: string): Promise<Flight> {
    const flight = await this.flightsRepository.findOne({
      where: { id },
      relations: ['seats'],
    });
    if (!flight) {
      throw new NotFoundException('Không tìm thấy chuyến bay');
    }
    return flight;
  }

  async getFareClasses(flightId: string): Promise<FareClass[]> {
    const fareClasses = await this.fareClassRepository.find({
      where: { flight: { id: flightId } },
      order: { price: 'ASC' },
    });
    return fareClasses;
  }

  async getFareClassById(fareClassId: string): Promise<FareClass> {
    const fareClass = await this.fareClassRepository.findOne({
      where: { id: fareClassId },
      relations: ['flight'],
    });
    if (!fareClass) {
      throw new NotFoundException('Không tìm thấy hạng vé');
    }
    return fareClass;
  }

  async getSeatById(seatId: string): Promise<Seat> {
    const seat = await this.seatsRepository.findOne({
      where: { id: seatId },
      relations: ['flight'],
    });
    if (!seat) {
      throw new NotFoundException('Không tìm thấy ghế');
    }
    return seat;
  }

  async updateSeatStatus(seatId: string, status: SeatStatus): Promise<void> {
    await this.seatsRepository.update(seatId, { status });
  }

  async createFlightWithSeats(data: {
    flightCode: string;
    departureCity: string;
    arrivalCity: string;
    departureTime: Date;
    arrivalTime: Date;
    price: number;
    seatCount: number;
  }): Promise<Flight> {
    const flight = this.flightsRepository.create({
      flightCode: data.flightCode,
      departureCity: data.departureCity,
      arrivalCity: data.arrivalCity,
      departureTime: data.departureTime,
      arrivalTime: data.arrivalTime,
      price: data.price,
    });
    const savedFlight = await this.flightsRepository.save(flight);

    const seats: Seat[] = [];
    const rows = Math.ceil(data.seatCount / 6);
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    let count = 0;
    for (let row = 1; row <= rows && count < data.seatCount; row++) {
      for (const letter of letters) {
        if (count >= data.seatCount) break;
        const seat = this.seatsRepository.create({
          seatNumber: `${row}${letter}`,
          status: SeatStatus.AVAILABLE,
          flight: savedFlight,
        });
        seats.push(seat);
        count++;
      }
    }
    await this.seatsRepository.save(seats);

    // Tạo 3 hạng vé mặc định cho mỗi chuyến bay, giá tính theo % giá gốc
    const fareClasses = [
      this.fareClassRepository.create({
        flight: savedFlight,
        name: 'Economy',
        price: data.price,
        carryOnKg: 7,
        checkedBaggageKg: 0,
        refundable: false,
        changeable: false,
        note: 'Vé điện tử phát hành trong 24 giờ sau khi thanh toán',
      }),
      this.fareClassRepository.create({
        flight: savedFlight,
        name: 'Economy Saver',
        price: Math.round(data.price * 1.15),
        carryOnKg: 7,
        checkedBaggageKg: 20,
        refundable: false,
        changeable: true,
        note: 'Đổi lịch có phí, bao gồm 20kg hành lý ký gửi',
      }),
      this.fareClassRepository.create({
        flight: savedFlight,
        name: 'Economy An toàn',
        price: Math.round(data.price * 1.35),
        carryOnKg: 7,
        checkedBaggageKg: 20,
        refundable: true,
        changeable: true,
        note: 'Hoàn 80% giá vé, bảo hiểm du lịch toàn diện kèm theo',
      }),
    ];
    await this.fareClassRepository.save(fareClasses);

    return savedFlight;
  }

  async clearAll(): Promise<{ message: string }> {
    await this.seatsRepository.query(
      'TRUNCATE TABLE seats, flights, bookings, payments, fare_classes CASCADE',
    );
    return { message: 'Đã xóa toàn bộ dữ liệu chuyến bay/ghế' };
  }
}