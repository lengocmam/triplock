import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Booking } from './booking.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  QR = 'qr',
}

@Entity('payments')
@Index(['status', 'paidAt']) // composite index — khớp đúng pattern query dashboard (WHERE status = ... AND paidAt >= ...)
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Booking, (booking) => booking.payment)
  @JoinColumn()
  booking!: Booking;

  @Column({ unique: true })
  transactionCode!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.QR })
  method!: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column({ nullable: true })
  paymentSessionId!: string;

  @Column({ nullable: true, type: 'timestamp' })
  paidAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
