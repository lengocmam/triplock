import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { Seat } from './seat.entity';

@Entity('flights')
export class Flight {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  flightCode!: string; // vd: VN123

  @Column()
  departureCity!: string;

  @Column()
  arrivalCity!: string;

  @Column({ type: 'timestamp' })
  departureTime!: Date;

  @Column({ type: 'timestamp' })
  arrivalTime!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @OneToMany(() => Seat, (seat) => seat.flight)
  seats!: Seat[];
}