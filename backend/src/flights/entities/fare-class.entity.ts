import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Flight } from './flight.entity';

@Entity('fare_classes')
export class FareClass {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Flight, (flight) => flight.fareClasses, {
    onDelete: 'CASCADE',
  })
  flight!: Flight;

  @Column()
  name!: string; // vd: "Economy", "Economy Saver"

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({ default: 7 })
  carryOnKg!: number; // hành lý xách tay

  @Column({ default: 0 })
  checkedBaggageKg!: number; // hành lý ký gửi

  @Column({ default: false })
  refundable!: boolean; // có được hoàn vé không

  @Column({ default: false })
  changeable!: boolean; // có được đổi lịch không

  @Column({ nullable: true })
  note!: string; // ghi chú thêm, vd "Vé điện tử phát hành trong 24h"
}
