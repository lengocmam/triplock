import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AdminService } from './admin.service';
import { MockDataService } from './mock-data.service';
import { Throttle } from '@nestjs/throttler';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private mockDataService: MockDataService,
  ) {}

  @Get('dashboard-stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('revenue-chart')
  getRevenueChart() {
    return this.adminService.getRevenueChart();
  }

  @Get('top-routes')
  getTopRoutes() {
    return this.adminService.getTopRoutes();
  }

  @Get('fare-class-breakdown')
  getFareClassBreakdown() {
    return this.adminService.getFareClassBreakdown();
  }

  @Get('flights')
  getAllFlights(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.adminService.getAllFlightsWithStats(Number(page), Number(limit));
  }

  @Post('flights')
  createFlight(@Body() body: any) {
    return this.adminService.createFlight(body);
  }

  @Put('flights/:id')
  updateFlight(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateFlight(id, body);
  }

  @Delete('flights/:id')
  deleteFlight(@Param('id') id: string) {
    return this.adminService.deleteFlight(id);
  }

  @Get('flights/:id/fares')
  getFares(@Param('id') id: string) {
    return this.adminService.getFareClassesForFlight(id);
  }

  @Put('fare-classes/:id')
  updateFareClass(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateFareClass(id, body);
  }

  @Get('users')
  getAllUsers(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.adminService.getAllUsers(Number(page), Number(limit));
  }

  @Get('bookings')
  getAllBookings(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.adminService.getAllBookings(Number(page), Number(limit));
  }

  @Throttle({ default: { limit: 2, ttl: 3600000 } }) // tối đa 2 lần/giờ
  @Post('seed-mock-data')
  seedMockData() {
    return this.mockDataService.seedAll();
  }
  
}