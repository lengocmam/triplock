import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Seat } from '../../flights/entities/seat.entity';
import { FareClass } from '../../flights/entities/fare-class.entity';
import { Payment } from './payment.entity';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.bookings)
  user!: User;

  @OneToOne(() => Seat, (seat) => seat.booking)
  @JoinColumn()
  seat!: Seat;

  @ManyToOne(() => FareClass)
  fareClass!: FareClass;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  @Column({ type: 'timestamp' })
  lockExpiresAt!: Date;

  @OneToOne(() => Payment, (payment) => payment.booking)
  payment!: Payment;

  @CreateDateColumn()
  createdAt!: Date;
}