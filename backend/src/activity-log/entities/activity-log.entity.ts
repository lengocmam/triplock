import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ActivityAction {
  REGISTER = 'register',
  LOGIN = 'login',
  VERIFY_OTP = 'verify_otp',
  VIEW_FLIGHT = 'view_flight',
  LOCK_SEAT = 'lock_seat',
  CANCEL_LOCK = 'cancel_lock',
  CONFIRM_BOOKING = 'confirm_booking',
  CANCEL_BOOKING = 'cancel_booking',
  VIEW_MY_BOOKINGS = 'view_my_bookings',
}

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Column({ type: 'enum', enum: ActivityAction })
  action!: ActivityAction;

  @Column({ nullable: true })
  description!: string;

  // Lưu thông tin phụ dạng JSON, linh hoạt cho từng loại hành động (vd: seatNumber, bookingCode...)
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  @Column({ nullable: true })
  ipAddress!: string;

  @CreateDateColumn()
  createdAt!: Date;
}