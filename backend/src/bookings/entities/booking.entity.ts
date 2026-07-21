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
import { Payment } from './payment.entity';

export enum BookingStatus {
  PENDING = 'pending',     // vừa giữ chỗ, chờ thanh toán
  CONFIRMED = 'confirmed', // đã thanh toán xong
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',     // hết hạn giữ chỗ mà chưa thanh toán
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

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  @Column({ type: 'timestamp' })
  lockExpiresAt!: Date; // hết giờ này mà chưa thanh toán -> tự hủy

  @OneToOne(() => Payment, (payment) => payment.booking)
  payment!: Payment;

  @CreateDateColumn()
  createdAt!: Date;
}