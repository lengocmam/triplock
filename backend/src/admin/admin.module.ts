import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../bookings/entities/payment.entity';
import { Flight } from '../flights/entities/flight.entity';
import { Seat } from '../flights/entities/seat.entity';
import { FareClass } from '../flights/entities/fare-class.entity';
import { User } from '../users/entities/user.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { MockDataService } from './mock-data.service';
import { FlightsModule } from '../flights/flights.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Payment, Flight, Seat, FareClass, User]),
    FlightsModule,
  ],
  providers: [AdminService, MockDataService],
  controllers: [AdminController],
})
export class AdminModule {}
