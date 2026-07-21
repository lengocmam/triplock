import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flight } from './entities/flight.entity';
import { Seat, SeatStatus } from './entities/seat.entity';

@Injectable()
export class FlightsService {
  constructor(
    @InjectRepository(Flight)
    private flightsRepository: Repository<Flight>,
    @InjectRepository(Seat)
    private seatsRepository: Repository<Seat>,
  ) {}

  async findOne(id: string): Promise<Flight> {
    const flight = await this.flightsRepository.findOne({
        where: { id },
        relations: ['seats'], // nếu Flight có relation seats
    });

    if (!flight) {
        throw new NotFoundException('Không tìm thấy chuyến bay');
    }

    return flight;
    }

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
        // So khớp theo đúng ngày (bỏ qua giờ phút)
        query.andWhere('DATE(flight.departureTime) = :date', { date: filters.date });
    }

    query.orderBy('flight.departureTime', 'ASC');

    return query.getMany();
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

  async clearAll(): Promise<{ message: string }> {
    await this.seatsRepository.query('TRUNCATE TABLE seats, flights, bookings, payments CASCADE');
    return { message: 'Đã xóa toàn bộ dữ liệu chuyến bay/ghế' };
  }

  // Dùng để seed dữ liệu mẫu — sẽ gọi 1 lần lúc setup
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

    return savedFlight;
  }
}