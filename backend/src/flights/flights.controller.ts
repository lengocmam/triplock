import { Controller, Get, Param, Post, Query, UseGuards, Request } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityAction } from '../activity-log/entities/activity-log.entity';
import { FlightsService } from './flights.service';

@Controller('flights')
export class FlightsController {
  constructor(
    private flightsService: FlightsService,
    private activityLogService: ActivityLogService,
  ) {}

  @Get()
  findAll(
    @Query('departureCity') departureCity?: string,
    @Query('arrivalCity') arrivalCity?: string,
    @Query('date') date?: string,
  ) {
    return this.flightsService.findAll({ departureCity, arrivalCity, date });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const flight = await this.flightsService.findOne(id);

    if (req.user) {
      await this.activityLogService.log(
        req.user.userId,
        ActivityAction.VIEW_FLIGHT,
        `Xem chi tiết chuyến ${flight.flightCode}`,
        { flightId: id, flightCode: flight.flightCode },
      );
    }

    return flight;
  }

  @Get(':id/fares')
  getFares(@Param('id') id: string) {
    return this.flightsService.getFareClasses(id);
  }

  @Post('seed')
  async seed() {
    // giữ nguyên
  }

  @Post('clear-seed')
  async clearSeed() {
    return this.flightsService.clearAll();
  }
}