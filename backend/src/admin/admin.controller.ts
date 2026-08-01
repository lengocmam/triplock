import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AdminService } from './admin.service';
import { MockDataService } from './mock-data.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { UpdateFareClassDto } from './dto/update-fare-class.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private mockDataService: MockDataService,
  ) {}

  @Get('dashboard-stats')
  getDashboardStats(): Promise<any> {
    return this.adminService.getDashboardStats();
  }

  @Get('revenue-chart')
  getRevenueChart(): Promise<any> {
    return this.adminService.getRevenueChart();
  }

  @Get('top-routes')
  getTopRoutes(): Promise<any> {
    return this.adminService.getTopRoutes();
  }

  @Get('fare-class-breakdown')
  getFareClassBreakdown(): Promise<any> {
    return this.adminService.getFareClassBreakdown();
  }

  @Get('flights')
  getAllFlights(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<any> {
    return this.adminService.getAllFlightsWithStats(
      Number(page),
      Number(limit),
    );
  }

  @Post('flights')
  createFlight(@Body() body: CreateFlightDto): Promise<any> {
    return this.adminService.createFlight(body);
  }

  @Put('flights/:id')
  updateFlight(
    @Param('id') id: string,
    @Body() body: UpdateFlightDto,
  ): Promise<any> {
    return this.adminService.updateFlight(id, body);
  }

  @Delete('flights/:id')
  deleteFlight(@Param('id') id: string): Promise<any> {
    return this.adminService.deleteFlight(id);
  }

  @Get('flights/:id/fares')
  getFares(@Param('id') id: string): Promise<any> {
    return this.adminService.getFareClassesForFlight(id);
  }

  @Put('fare-classes/:id')
  updateFareClass(
    @Param('id') id: string,
    @Body() body: UpdateFareClassDto,
  ): Promise<any> {
    return this.adminService.updateFareClass(id, body);
  }

  @Get('users')
  getAllUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<any> {
    return this.adminService.getAllUsers(Number(page), Number(limit));
  }

  @Get('bookings')
  getAllBookings(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<any> {
    return this.adminService.getAllBookings(Number(page), Number(limit));
  }

  @Throttle({ default: { limit: 2, ttl: 3600000 } })
  @Post('seed-mock-data')
  seedMockData(): Promise<any> {
    return this.mockDataService.seedAll();
  }
}
