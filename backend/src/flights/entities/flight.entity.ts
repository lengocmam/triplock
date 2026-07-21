import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { Seat } from './seat.entity';
import { FareClass } from './fare-class.entity';

@Entity('flights')
export class Flight {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  flightCode!: string;

  @Column()
  departureCity!: string;

  @Column()
  arrivalCity!: string;

  @Column({ type: 'timestamp' })
  departureTime!: Date;

  @Column({ type: 'timestamp' })
  arrivalTime!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number; // giá thấp nhất, hiển thị ở list — vẫn giữ để không phá vỡ code cũ

  @OneToMany(() => Seat, (seat) => seat.flight)
  seats!: Seat[];

  @OneToMany(() => FareClass, (fareClass) => fareClass.flight)
  fareClasses!: FareClass[];
}