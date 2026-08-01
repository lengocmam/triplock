import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
} from 'typeorm';
import { Seat } from './seat.entity';
import { FareClass } from './fare-class.entity';

@Entity('flights')
@Index(['departureCity', 'arrivalCity']) // khớp đúng pattern search phổ biến nhất
@Index(['departureTime'])
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
  price!: number;

  @OneToMany(() => Seat, (seat) => seat.flight)
  seats!: Seat[];

  @OneToMany(() => FareClass, (fareClass) => fareClass.flight)
  fareClasses!: FareClass[];
}
