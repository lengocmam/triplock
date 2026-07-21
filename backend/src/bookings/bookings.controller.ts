import {
  Controller,
  Post,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingsService } from './bookings.service';

@Controller('bookings')
@UseGuards(JwtAuthGuard) // toàn bộ route trong controller này bắt buộc phải login
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post('lock-seat/:seatId')
  lockSeat(@Param('seatId') seatId: string, @Request() req: any) {
    return this.bookingsService.lockSeat(seatId, req.user.userId);
  }

  @Post('confirm/:bookingId')
  confirmBooking(@Param('bookingId') bookingId: string, @Request() req: any) {
    return this.bookingsService.confirmBooking(bookingId, req.user.userId);
  }

  @Post('cancel/:bookingId')
  cancelBooking(@Param('bookingId') bookingId: string) {
    return this.bookingsService.releaseSeat(bookingId);
  }
}