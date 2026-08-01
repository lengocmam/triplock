import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  Index,
} from 'typeorm';
import { Flight } from './flight.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum SeatStatus {
  AVAILABLE = 'available',
  LOCKED = 'locked',
  BOOKED = 'booked',
}

@Entity('seats')
@Index(['flight', 'status']) // khớp đúng pattern "đếm ghế trống theo chuyến"
export class Seat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  seatNumber!: string;

  @Column({ type: 'enum', enum: SeatStatus, default: SeatStatus.AVAILABLE })
  status!: SeatStatus;

  @ManyToOne(() => Flight, (flight) => flight.seats, { onDelete: 'CASCADE' })
  flight!: Flight;

  @OneToOne(() => Booking, (booking) => booking.seat)
  booking!: Booking;
}
