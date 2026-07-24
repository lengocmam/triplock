import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingsService } from './bookings.service';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post('lock-seat/:seatId')
  lockSeat(
    @Param('seatId') seatId: string,
    @Body('fareClassId') fareClassId: string,
    @Request() req: any,
  ) {
    return this.bookingsService.lockSeat(seatId, fareClassId, req.user.userId);
  }

  @Post('confirm-multiple')
  confirmMultiple(
    @Body()
    body: {
      bookingIds: string[];
      passengers: { bookingId: string; passengerName: string; passengerPhone: string }[];
    },
    @Request() req: any,
  ) {
    return this.bookingsService.confirmMultiple(body.bookingIds, body.passengers, req.user.userId);
  }

  @Post('cancel/:bookingId')
  cancelBooking(@Param('bookingId') bookingId: string) {
    return this.bookingsService.releaseSeat(bookingId);
  }

  @Get('my-bookings')
  myBookings(@Request() req: any) {
    return this.bookingsService.findMyBookings(req.user.userId);
  }

  @Post('cancel-confirmed/:bookingId')
  cancelConfirmedBooking(@Param('bookingId') bookingId: string, @Request() req: any) {
    return this.bookingsService.cancelConfirmedBooking(bookingId, req.user.userId);
  }

  @Post('price-breakdown')
  async priceBreakdown(@Body() body: { fareClassId: string; passengerCount: number }) {
    return this.bookingsService.getPriceBreakdown(body.fareClassId, body.passengerCount);
  }

  
}