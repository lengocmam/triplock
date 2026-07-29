import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
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
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Booking, (booking) => booking.payment)
  @JoinColumn()
  booking!: Booking;

  // Mã giao dịch — dùng để tra cứu, đối soát, hiển thị cho khách khi cần khiếu nại
  @Column({ unique: true })
  transactionCode!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.QR })
  method!: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  // Tham chiếu tới sessionId của phiên QR — để trace lại nếu có tranh chấp
  @Column({ nullable: true })
  paymentSessionId!: string;

  @Column({ nullable: true, type: 'timestamp' })
  paidAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}