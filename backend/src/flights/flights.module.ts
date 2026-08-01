import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flight } from './entities/flight.entity';
import { Seat } from './entities/seat.entity';
import { FareClass } from './entities/fare-class.entity';
import { FlightsService } from './flights.service';
import { FlightsController } from './flights.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Flight, Seat, FareClass])],
  providers: [FlightsService],
  controllers: [FlightsController],
  exports: [TypeOrmModule, FlightsService],
})
export class FlightsModule {}
