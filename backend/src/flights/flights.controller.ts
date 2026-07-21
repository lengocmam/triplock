import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FlightsService } from './flights.service';
import { Flight } from './entities/flight.entity';
@Controller('flights')
export class FlightsController {
  constructor(private flightsService: FlightsService) {}

  @Get()
  findAll(
    @Query('departureCity') departureCity?: string,
    @Query('arrivalCity') arrivalCity?: string,
    @Query('date') date?: string,
  ) {
    return this.flightsService.findAll({ departureCity, arrivalCity, date });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.flightsService.findOne(id);
  }

  @Get(':id/fares')
  getFares(@Param('id') id: string) {
    return this.flightsService.getFareClasses(id);
  }

  @Post('seed')
  async seed() {
    const routes = [
      { code: 'VN123', from: 'Hà Nội', to: 'Hồ Chí Minh', price: 1590000, hours: 2 },
      { code: 'VJ456', from: 'Hồ Chí Minh', to: 'Đà Nẵng', price: 990000, hours: 1.3 },
      { code: 'QH789', from: 'Hà Nội', to: 'Đà Nẵng', price: 1190000, hours: 1.3 },
      { code: 'VN234', from: 'Hồ Chí Minh', to: 'Phú Quốc', price: 1290000, hours: 1 },
      { code: 'VJ567', from: 'Hà Nội', to: 'Nha Trang', price: 1450000, hours: 1.8 },
      { code: 'QH890', from: 'Đà Nẵng', to: 'Hồ Chí Minh', price: 1050000, hours: 1.3 },
      { code: 'VN345', from: 'Hà Nội', to: 'Phú Quốc', price: 2190000, hours: 2.2 },
      { code: 'VJ678', from: 'Hồ Chí Minh', to: 'Hà Nội', price: 1690000, hours: 2 },
    ];

    const created: Flight[] = [];
    for (let i = 0; i < routes.length; i++) {
      const r = routes[i];
      const departureTime = new Date();
      departureTime.setDate(departureTime.getDate() + i + 1);
      departureTime.setHours(6 + i * 2, 0, 0, 0);

      const arrivalTime = new Date(departureTime.getTime() + r.hours * 60 * 60 * 1000);

      const flight = await this.flightsService.createFlightWithSeats({
        flightCode: r.code,
        departureCity: r.from,
        arrivalCity: r.to,
        departureTime,
        arrivalTime,
        price: r.price,
        seatCount: 24,
      });
      created.push(flight);
    }

    return { message: `Đã tạo ${created.length} chuyến bay`, flights: created };
  }

  @Post('clear-seed')
  async clearSeed() {
    return this.flightsService.clearAll();
  }
}