import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { Payment } from './entities/payment.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingsGateway } from './bookings.gateway';
import { BookingsCleanupService } from './bookings-cleanup.service';
import { FlightsModule } from '../flights/flights.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Payment]),
    FlightsModule,
    UsersModule,
  ],
  providers: [BookingsService, BookingsGateway, BookingsCleanupService],
  controllers: [BookingsController],
})
export class BookingsModule {}